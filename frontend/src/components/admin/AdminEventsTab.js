import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';
import { DistributionBar } from './ChartComponents';

const getEventStatus = (startTime, endTime) => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (now < start) return { label: 'Upcoming', color: ADMIN_COLORS.info, icon: 'time-outline' };
    if (now >= start && now <= end) return { label: 'Live', color: ADMIN_COLORS.success, icon: 'radio-outline' };
    return { label: 'Past', color: ADMIN_COLORS.textMuted, icon: 'checkmark-circle-outline' };
};

export const AdminEventsTab = ({ onBack }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchEvents = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/events');
            setEvents(res.data);
        } catch (e) {
            console.error('Events fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const handleDelete = (id, title) => {
        Alert.alert('Delete Event', `Delete "${title}"? This will remove all registrations.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await client.delete(`/admin/events/${id}`);
                        setEvents(prev => prev.filter(e => e.id !== id));
                        Alert.alert('Deleted', 'Event and registrations removed.');
                    } catch (e) { Alert.alert('Error', 'Failed to delete event'); }
                }
            }
        ]);
    };

    // Quick stats
    const totalRegs = events.reduce((sum, e) => sum + (e.registration_count || 0), 0);
    const totalCheckins = events.reduce((sum, e) => sum + (e.checkin_count || 0), 0);
    const upcoming = events.filter(e => new Date(e.start_time) > new Date()).length;

    return (
        <View style={s.screen}>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: ADMIN_COLORS.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 14 }}>
                        <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>Event Management</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{events.length} events</Text>
                    </View>
                </View>
                {/* Summary stats */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 12, marginBottom: 4 }]}>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: ADMIN_COLORS.info }}>{upcoming}</Text>
                        <Text style={{ fontSize: 10, color: ADMIN_COLORS.textMuted }}>Upcoming</Text>
                    </View>
                    <View style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 12, marginBottom: 4 }]}>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: ADMIN_COLORS.chart2 }}>{totalRegs}</Text>
                        <Text style={{ fontSize: 10, color: ADMIN_COLORS.textMuted }}>Registrations</Text>
                    </View>
                    <View style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 12, marginBottom: 4 }]}>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: ADMIN_COLORS.accent }}>{totalCheckins}</Text>
                        <Text style={{ fontSize: 10, color: ADMIN_COLORS.textMuted }}>Check-ins</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={s.loadingContainer}><ActivityIndicator size="large" color={ADMIN_COLORS.accent} /></View>
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(true); }} tintColor={ADMIN_COLORS.accent} />}
                    ListEmptyComponent={
                        <View style={s.emptyContainer}>
                            <Ionicons name="calendar-outline" size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>No events yet</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const status = getEventStatus(item.start_time, item.end_time);
                        const capacity = item.capacity || 0;
                        const regPct = capacity > 0 ? Math.round((item.registration_count / capacity) * 100) : 0;
                        const checkinPct = item.registration_count > 0 ? Math.round((item.checkin_count / item.registration_count) * 100) : 0;
                        return (
                            <View style={s.listCard}>
                                <View style={s.listCardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.listCardTitle}>{item.title}</Text>
                                        <Text style={s.listCardSub}>by {item.organizer_name} • {item.category}</Text>
                                    </View>
                                    <View style={[s.badge, { backgroundColor: `${status.color}20` }]}>
                                        <Text style={[s.badgeText, { color: status.color }]}>{status.label}</Text>
                                    </View>
                                </View>

                                <View style={{ marginTop: 10, flexDirection: 'row', gap: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="location-outline" size={13} color={ADMIN_COLORS.textMuted} />
                                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary, marginLeft: 4 }} numberOfLines={1}>{item.location || 'TBD'}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="time-outline" size={13} color={ADMIN_COLORS.textMuted} />
                                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary, marginLeft: 4 }}>
                                            {new Date(item.start_time).toLocaleDateString()}
                                        </Text>
                                    </View>
                                </View>

                                {/* Registration bar */}
                                <View style={{ marginTop: 12 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>
                                            Registrations: {item.registration_count}{capacity > 0 ? ` / ${capacity}` : ''}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>Check-ins: {item.checkin_count}</Text>
                                    </View>
                                    <DistributionBar
                                        segments={[
                                            { value: item.checkin_count, color: ADMIN_COLORS.success },
                                            { value: Math.max(0, item.registration_count - item.checkin_count), color: ADMIN_COLORS.chart1 },
                                        ]}
                                        total={capacity > 0 ? capacity : Math.max(item.registration_count, 1)}
                                        height={6}
                                    />
                                </View>

                                <View style={s.actionRow}>
                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: '#4a90e220', marginRight: 10 }]}
                                        onPress={() => navigation.navigate('EventResponses', { eventId: item.id, eventTitle: item.title })}
                                    >
                                        <Ionicons name="people-outline" size={14} color="#4a90e2" />
                                        <Text style={[s.actionBtnText, { color: '#4a90e2' }]}>Responses</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.dangerBg }]}
                                        onPress={() => handleDelete(item.id, item.title)}
                                    >
                                        <Ionicons name="trash-outline" size={14} color={ADMIN_COLORS.danger} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.danger }]}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
};
