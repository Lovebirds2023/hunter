import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export const InboxScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { userInfo } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchInbox = useCallback(async () => {
        try {
            const [annRes, notifRes, dmRes] = await Promise.all([
                client.get('/announcements'),
                client.get('/notifications'),
                userInfo?.id ? client.get('/chat/dms') : Promise.resolve({ data: [] })
            ]);

            const conversations = new Map();
            (dmRes.data || []).forEach(dm => {
                const isMine = dm.sender_id === userInfo?.id;
                const targetId = isMine ? dm.receiver_id : dm.sender_id;
                const target = isMine ? dm.receiver : dm.sender;
                const existing = conversations.get(targetId);

                if (!existing) {
                    conversations.set(targetId, {
                        id: `dm-${targetId}`,
                        itemType: 'direct_message',
                        title: target?.full_name || t('messages.private_message'),
                        message: dm.content,
                        created_at: dm.created_at,
                        targetId,
                        targetName: target?.full_name || t('messages.private_message'),
                        unread_count: !isMine && !dm.read_at ? 1 : 0,
                    });
                    return;
                }

                if (!isMine && !dm.read_at) {
                    existing.unread_count += 1;
                }
            });
            
            // Combine and sort by date
            const combined = [
                ...annRes.data.map(a => ({ ...a, itemType: 'announcement' })),
                ...notifRes.data.map(n => ({ ...n, itemType: 'notification' })),
                ...Array.from(conversations.values())
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setItems(combined);
        } catch (e) {
            console.warn("Failed to load inbox items", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [t, userInfo?.id]);

    useEffect(() => {
        fetchInbox();
    }, [fetchInbox]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchInbox();
    };

    const markAsRead = async (id) => {
        try {
            await client.post(`/notifications/${id}/read`);
            setItems(prev => prev.map(item => 
                item.itemType === 'notification' && item.id === id 
                ? { ...item, is_read: true } 
                : item
            ));
        } catch (e) {
            console.warn("Failed to mark as read");
        }
    };

    const getIcon = (item) => {
        if (item.itemType === 'announcement') return "megaphone";
        if (item.itemType === 'direct_message') return "chatbubble-ellipses";
        switch (item.type) {
            case 'rejection': return "close-circle";
            case 'approval': return "checkmark-circle";
            case 'feedback': return "chatbubble-ellipses";
            case 'pet_match': return "git-compare";
            case 'purchase': return "bag-check";
            case 'sale': return "cash";
            case 'delivery': return "checkmark-done";
            default: return "notifications";
        }
    };

    const getIconColor = (item) => {
        if (item.itemType === 'announcement') return COLORS.accent;
        if (item.itemType === 'direct_message') return "#3498db";
        switch (item.type) {
            case 'rejection': return "#ff4d4d";
            case 'approval': return "#2ecc71";
            case 'feedback': return "#3498db";
            case 'pet_match': return COLORS.accent;
            case 'purchase': return "#2E7D32";
            case 'sale': return COLORS.accent;
            case 'delivery': return "#1565C0";
            default: return COLORS.primary;
        }
    };

    const renderItem = ({ item }) => {
        const isUnread = (item.itemType === 'notification' && !item.is_read) ||
            (item.itemType === 'direct_message' && item.unread_count > 0);

        const handlePress = () => {
            if (item.itemType === 'direct_message') {
                navigation.navigate('DirectMessage', {
                    targetId: item.targetId,
                    targetName: item.targetName
                });
                return;
            }

            if (item.itemType === 'notification' && !item.is_read) {
                markAsRead(item.id);
            }

            if (item.itemType === 'notification' && item.target_route === 'CaseDetail' && item.target_id) {
                navigation.navigate('Main', {
                    screen: 'Report',
                    params: {
                        screen: 'CaseDetail',
                        params: { reportId: item.target_id },
                    },
                });
            }
        };

        return (
            <TouchableOpacity 
                style={[styles.card, isUnread && styles.unreadCard]}
                onPress={handlePress}
                disabled={item.itemType === 'announcement' || (item.itemType === 'notification' && item.is_read && !item.target_id)}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Ionicons 
                            name={getIcon(item)} 
                            size={18} 
                            color={getIconColor(item)} 
                            style={{ marginRight: 8 }} 
                        />
                        <Text style={[styles.title, isUnread && { fontWeight: '900' }]} numberOfLines={1}>
                            {item.title}
                        </Text>
                    </View>
                    <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.message}>{item.message}</Text>
                {item.itemType === 'direct_message' && item.unread_count > 0 && (
                    <Text style={styles.unreadText}>{item.unread_count} unread</Text>
                )}
                {isUnread && <View style={styles.unreadBadge} />}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('inbox.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item, index) => item.id || `item-${index}`}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="mail-open-outline" size={60} color="#ddd" />
                            <Text style={styles.emptyText}>{t('inbox.empty')}</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', ...SHADOWS.light },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 20, paddingBottom: 100 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 15, ...SHADOWS.light, position: 'relative' },
    unreadCard: { backgroundColor: '#f0f7ff', borderColor: '#d0e8ff', borderLeftWidth: 4 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 },
    date: { fontSize: 12, color: '#999' },
    message: { fontSize: 14, color: '#666', lineHeight: 22 },
    unreadText: { fontSize: 12, color: COLORS.primary, fontWeight: '700', marginTop: 8 },
    unreadBadge: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#999', marginTop: 10, fontSize: 16 }
});
