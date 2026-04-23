import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

export const AdminAnnouncementsTab = ({ onBack }) => {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [form, setForm] = useState({ title: '', message: '', target: 'all' });
    const [submitting, setSubmitting] = useState(false);

    const fetchAnnouncements = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/announcements');
            setAnnouncements(res.data);
        } catch (e) {
            console.error('Announcements fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

    const handleCreate = async () => {
        if (!form.title || !form.message) {
            Alert.alert('Error', 'Please fill in both title and message.');
            return;
        }
        setSubmitting(true);
        try {
            await client.post('/admin/announcements', {
                title: form.title,
                message: form.message,
                target_audience: form.target
            });
            setForm({ title: '', message: '', target: 'all' });
            fetchAnnouncements(true);
            Alert.alert('Success', 'Announcement posted successfully.');
        } catch (e) {
            Alert.alert('Error', 'Failed to post announcement.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Announcement', 'Are you sure you want to delete this announcement?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await client.delete(`/admin/announcements/${id}`);
                        setAnnouncements(prev => prev.filter(a => a.id !== id));
                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete announcement');
                    }
                }
            }
        ]);
    };

    return (
        <View style={s.screen}>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: ADMIN_COLORS.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 14 }}>
                        <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>Announcements</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{announcements.length} posted</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={announcements}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAnnouncements(true); }} tintColor={ADMIN_COLORS.accent} />}
                ListHeaderComponent={
                    <View style={[s.card, { marginBottom: 24, padding: 16 }]}>
                        <Text style={[s.sectionTitle, { fontSize: 16, marginBottom: 10 }]}>Post New Announcement</Text>
                        
                        <Text style={s.inputLabel}>Title</Text>
                        <View style={s.inputContainer}>
                            <TextInput 
                                style={s.textInput}
                                placeholder="e.g. System Update or Event Reminder"
                                placeholderTextColor={ADMIN_COLORS.textMuted}
                                value={form.title}
                                onChangeText={t => setForm(f => ({ ...f, title: t }))}
                            />
                        </View>

                        <Text style={s.inputLabel}>Message</Text>
                        <View style={[s.inputContainer, { height: 100, paddingTop: 8 }]}>
                            <TextInput 
                                style={[s.textInput, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="Write your message here..."
                                placeholderTextColor={ADMIN_COLORS.textMuted}
                                multiline
                                value={form.message}
                                onChangeText={t => setForm(f => ({ ...f, message: t }))}
                            />
                        </View>

                        <Text style={s.inputLabel}>Target Audience</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            {['all', 'buyer', 'provider'].map(t => (
                                <TouchableOpacity 
                                    key={t}
                                    style={[s.filterChip, form.target === t && s.filterChipActive]}
                                    onPress={() => setForm(f => ({ ...f, target: t }))}
                                >
                                    <Text style={[s.filterChipText, form.target === t && s.filterChipTextActive]}>
                                        {t.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity 
                            style={[s.primaryButton, submitting && { opacity: 0.7 }]} 
                            onPress={handleCreate}
                            disabled={submitting}
                        >
                            {submitting ? <ActivityIndicator color={ADMIN_COLORS.bg} /> : (
                                <>
                                    <Ionicons name="send" size={18} color={ADMIN_COLORS.bg} />
                                    <Text style={s.primaryButtonText}>Post Announcement</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                }
                ListEmptyComponent={
                    <View style={s.emptyContainer}>
                        <Ionicons name="megaphone-outline" size={48} color={ADMIN_COLORS.textMuted} />
                        <Text style={s.emptyText}>No announcements yet</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={s.listCard}>
                        <View style={s.listCardHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.listCardTitle}>{item.title}</Text>
                                <Text style={s.listCardSub}>{new Date(item.created_at).toLocaleString()} • Target: {item.target_audience}</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}>
                                <Ionicons name="trash-outline" size={20} color={ADMIN_COLORS.danger} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: ADMIN_COLORS.textSecondary, marginTop: 10, fontSize: 13, lineHeight: 18 }}>
                            {item.message}
                        </Text>
                    </View>
                )}
            />
        </View>
    );
};
