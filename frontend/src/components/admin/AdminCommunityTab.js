import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

export const AdminCommunityTab = ({ onBack }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPosts = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/community');
            setPosts(res.data);
        } catch (e) {
            console.error('Community fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    const handleToggleHide = async (id, currentHidden) => {
        try {
            await client.post(`/admin/community/${id}/hide`);
            setPosts(prev => prev.map(p => p.id === id ? { ...p, is_hidden: !currentHidden } : p));
        } catch (e) {
            Alert.alert('Error', 'Failed to toggle visibility');
        }
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Post', 'Are you sure you want to permanently delete this post?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await client.delete(`/admin/community/${id}`);
                        setPosts(prev => prev.filter(p => p.id !== id));
                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete post');
                    }
                }
            }
        ]);
    };

    const flaggedCount = posts.filter(p => p.flag_count > 0).length;

    return (
        <View style={s.screen}>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: ADMIN_COLORS.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 14 }}>
                        <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>Community Moderation</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{posts.length} posts • {flaggedCount} flagged</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={s.loadingContainer}><ActivityIndicator size="large" color={ADMIN_COLORS.accent} /></View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(true); }} tintColor={ADMIN_COLORS.accent} />}
                    ListEmptyComponent={
                        <View style={s.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>No community posts yet</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[s.listCard, item.flag_count > 0 && { borderColor: ADMIN_COLORS.danger, borderWidth: 1 }]}>
                            <View style={s.listCardHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.listCardTitle}>{item.author_name}</Text>
                                    <Text style={s.listCardSub}>{new Date(item.created_at).toLocaleString()}</Text>
                                </View>
                                {item.flag_count > 0 && (
                                    <View style={[s.badge, { backgroundColor: ADMIN_COLORS.danger }]}>
                                        <Text style={s.badgeText}>{item.flag_count} FLAGS</Text>
                                    </View>
                                )}
                                {item.is_hidden && (
                                    <View style={[s.badge, { backgroundColor: ADMIN_COLORS.textMuted, marginLeft: 6 }]}>
                                        <Text style={s.badgeText}>HIDDEN</Text>
                                    </View>
                                )}
                            </View>
                            
                            <Text style={{ color: ADMIN_COLORS.textPrimary, marginTop: 10, fontSize: 14, lineHeight: 20 }}>
                                {item.content}
                            </Text>

                            <View style={s.actionRow}>
                                <TouchableOpacity 
                                    style={s.actionBtn}
                                    onPress={() => handleToggleHide(item.id, item.is_hidden)}
                                >
                                    <Ionicons name={item.is_hidden ? "eye-outline" : "eye-off-outline"} size={14} color={ADMIN_COLORS.info} />
                                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.info }]}>{item.is_hidden ? 'Show' : 'Hide'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.dangerBg }]}
                                    onPress={() => handleDelete(item.id)}
                                >
                                    <Ionicons name="trash-outline" size={14} color={ADMIN_COLORS.danger} />
                                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.danger }]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
};
