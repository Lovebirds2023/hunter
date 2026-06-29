import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

const SECTIONS = [
    { id: 'events', label: 'Events', targetType: 'event', icon: 'calendar-outline' },
    { id: 'services', label: 'Marketplace', targetType: 'service', icon: 'cart-outline' },
    { id: 'cases', label: 'Case Reports', targetType: 'case', icon: 'alert-circle-outline' },
    { id: 'community', label: 'Community', targetType: 'community', icon: 'chatbubbles-outline' },
];

export const AdminPinsTab = ({ onBack }) => {
    const [content, setContent] = useState(null);
    const [activeSection, setActiveSection] = useState('events');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actioningId, setActioningId] = useState(null);
    const [deleteReasons, setDeleteReasons] = useState({});

    const fetchContent = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/pinnable-content');
            setContent(res.data);
        } catch (error) {
            console.error('Pinnable content fetch error:', error);
            Alert.alert('Error', 'Could not load pinnable content.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchContent(); }, [fetchContent]);

    const section = SECTIONS.find(item => item.id === activeSection) || SECTIONS[0];
    const rows = content?.[activeSection] || [];

    const togglePin = async (item) => {
        setActioningId(item.id);
        try {
            if (item.is_pinned) {
                await client.delete(`/admin/pins/${section.targetType}/${item.id}`);
            } else {
                await client.post('/admin/pins', {
                    target_type: section.targetType,
                    target_id: item.id,
                    title: item.title,
                    description: item.description,
                    priority: 100,
                });
            }
            await fetchContent(true);
        } catch (error) {
            console.error('Pin toggle error:', error);
            Alert.alert('Error', 'Could not update the priority pin.');
        } finally {
            setActioningId(null);
        }
    };

    const updateDeleteReason = (id, reason) => {
        setDeleteReasons(prev => ({ ...prev, [id]: reason }));
    };

    const getDeletePath = (item) => {
        switch (section.targetType) {
            case 'event': return `/admin/events/${item.id}`;
            case 'service': return `/admin/services/${item.id}`;
            case 'case': return `/admin/cases/${item.id}`;
            case 'community': return `/admin/community/${item.id}`;
            default: return null;
        }
    };

    const deleteContent = async (item) => {
        const reason = (deleteReasons[item.id] || '').trim();
        const path = getDeletePath(item);
        if (!path) return;
        if (!reason) {
            Alert.alert('Reason required', 'Add a short reason before deleting this content.');
            return;
        }
        Alert.alert('Delete Content', `Delete "${item.title}"? The owner will be notified with your reason.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    setActioningId(`delete-${item.id}`);
                    try {
                        await client.delete(path, { data: { reason } });
                        await fetchContent(true);
                        Alert.alert('Deleted', 'Content removed and owner notified.');
                    } catch (error) {
                        Alert.alert('Error', error.response?.data?.detail || 'Could not delete content.');
                    } finally {
                        setActioningId(null);
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
                        <Text style={s.sectionTitle}>Priority Pins</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                            Promote urgent or paid content to the top of feeds
                        </Text>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                    {SECTIONS.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            style={[s.filterChip, activeSection === item.id && s.filterChipActive]}
                            onPress={() => setActiveSection(item.id)}
                        >
                            <Text style={[s.filterChipText, activeSection === item.id && s.filterChipTextActive]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={s.loadingContainer}><ActivityIndicator size="large" color={ADMIN_COLORS.accent} /></View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchContent(true); }} />}
                >
                    {rows.length === 0 ? (
                        <View style={s.emptyContainer}>
                            <Ionicons name={section.icon} size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>No published content in this section yet.</Text>
                        </View>
                    ) : rows.map(item => (
                        <View key={item.id} style={[s.listCard, item.is_pinned && { borderColor: ADMIN_COLORS.accent, borderWidth: 1 }]}>
                            <View style={s.listCardHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.listCardTitle}>{item.title}</Text>
                                    <Text style={s.listCardSub}>{item.meta || section.label}</Text>
                                </View>
                                {item.is_pinned && (
                                    <View style={[s.badge, { backgroundColor: ADMIN_COLORS.accent }]}>
                                        <Text style={[s.badgeText, { color: ADMIN_COLORS.bg }]}>PINNED</Text>
                                    </View>
                                )}
                            </View>
                            {item.description ? (
                                <Text style={{ color: ADMIN_COLORS.textSecondary, marginTop: 10, fontSize: 13 }} numberOfLines={3}>
                                    {item.description}
                                </Text>
                            ) : null}
                            <TextInput
                                style={[s.textInput, {
                                    height: 42,
                                    marginTop: 12,
                                    borderWidth: 1,
                                    borderColor: ADMIN_COLORS.surfaceBorder,
                                    borderRadius: 10,
                                    paddingHorizontal: 12,
                                    backgroundColor: ADMIN_COLORS.surfaceLight,
                                }]}
                                placeholder="Reason if deleting..."
                                placeholderTextColor={ADMIN_COLORS.textMuted}
                                value={deleteReasons[item.id] || ''}
                                onChangeText={(reason) => updateDeleteReason(item.id, reason)}
                            />
                            <View style={s.actionRow}>
                                <TouchableOpacity
                                    style={[s.actionBtn, { backgroundColor: item.is_pinned ? ADMIN_COLORS.dangerBg : ADMIN_COLORS.successBg }]}
                                    onPress={() => togglePin(item)}
                                    disabled={actioningId === item.id}
                                >
                                    {actioningId === item.id ? (
                                        <ActivityIndicator size="small" color={item.is_pinned ? ADMIN_COLORS.danger : ADMIN_COLORS.success} />
                                    ) : (
                                        <Ionicons name={item.is_pinned ? 'remove-circle-outline' : 'pin-outline'} size={14} color={item.is_pinned ? ADMIN_COLORS.danger : ADMIN_COLORS.success} />
                                    )}
                                    <Text style={[s.actionBtnText, { color: item.is_pinned ? ADMIN_COLORS.danger : ADMIN_COLORS.success }]}>
                                        {item.is_pinned ? 'Unpin' : 'Pin to top'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.dangerBg }]}
                                    onPress={() => deleteContent(item)}
                                    disabled={actioningId === `delete-${item.id}`}
                                >
                                    {actioningId === `delete-${item.id}` ? (
                                        <ActivityIndicator size="small" color={ADMIN_COLORS.danger} />
                                    ) : (
                                        <Ionicons name="trash-outline" size={14} color={ADMIN_COLORS.danger} />
                                    )}
                                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.danger }]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};
