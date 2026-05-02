import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import client from '../api/client';

export const InboxScreen = ({ navigation }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchInbox = useCallback(async () => {
        try {
            const [annRes, notifRes] = await Promise.all([
                client.get('/announcements'),
                client.get('/notifications')
            ]);
            
            // Combine and sort by date
            const combined = [
                ...annRes.data.map(a => ({ ...a, itemType: 'announcement' })),
                ...notifRes.data.map(n => ({ ...n, itemType: 'notification' }))
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setItems(combined);
        } catch (e) {
            console.warn("Failed to load inbox items", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

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
        switch (item.type) {
            case 'rejection': return "close-circle";
            case 'approval': return "checkmark-circle";
            case 'feedback': return "chatbubble-ellipses";
            default: return "notifications";
        }
    };

    const getIconColor = (item) => {
        if (item.itemType === 'announcement') return COLORS.accent;
        switch (item.type) {
            case 'rejection': return "#ff4d4d";
            case 'approval': return "#2ecc71";
            case 'feedback': return "#3498db";
            default: return COLORS.primary;
        }
    };

    const renderItem = ({ item }) => {
        const isUnread = item.itemType === 'notification' && !item.is_read;

        return (
            <TouchableOpacity 
                style={[styles.card, isUnread && styles.unreadCard]}
                onPress={() => item.itemType === 'notification' && !item.is_read && markAsRead(item.id)}
                disabled={item.itemType === 'announcement' || item.is_read}
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
                <Text style={styles.headerTitle}>Inbox & Notifications</Text>
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
                            <Text style={styles.emptyText}>Your inbox is empty.</Text>
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
    unreadBadge: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#999', marginTop: 10, fontSize: 16 }
});
