import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput, Image,
    ActivityIndicator, RefreshControl, Alert, Switch
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { supabase } from '../../../supabase';
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

const newEventForm = () => {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return {
        title: '',
        description: '',
        location: '',
        start_time: start.toISOString().slice(0, 16),
        end_time: end.toISOString().slice(0, 16),
        category: 'outreach',
        capacity: '0',
        poster_url: '',
        images: [],
        ticket_price: '0',
        currency: 'KES',
        is_public: true,
        scorecard_enabled: true,
    };
};

export const AdminEventsTab = ({ onBack, navigation, onOpenScorecard }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState(newEventForm());
    const [pinningId, setPinningId] = useState(null);

    const uploadPosterIfNeeded = async (uri) => {
        if (!uri || /^https?:\/\//i.test(uri)) return uri;

        const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
        const safeExtension = extension.length <= 5 ? extension : 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExtension}`;
        const filePath = `event-posters/${fileName}`;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

        const { error } = await supabase.storage
            .from('support_images')
            .upload(filePath, decode(base64), {
                contentType: `image/${safeExtension === 'jpg' ? 'jpeg' : safeExtension}`,
                upsert: true,
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('support_images')
            .getPublicUrl(filePath);

        return publicUrl;
    };

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

    const pickPoster = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.75,
            });
            if (!result.canceled && result.assets?.length > 0) {
                const uri = result.assets[0].uri;
                setForm(prev => ({ ...prev, poster_url: uri, images: [uri] }));
            }
        } catch (error) {
            Alert.alert('Error', 'Could not select an event poster.');
        }
    };

    const handleCreate = async () => {
        if (!form.title.trim()) {
            Alert.alert('Required', 'Add an event title.');
            return;
        }
        const start = new Date(form.start_time);
        const end = new Date(form.end_time);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            Alert.alert('Check dates', 'Use valid start and end times, with the end after the start.');
            return;
        }

        setCreating(true);
        try {
            const posterUrl = await uploadPosterIfNeeded(form.poster_url);
            await client.post('/events', {
                title: form.title.trim(),
                description: form.description.trim(),
                location: form.location.trim(),
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                capacity: Number(form.capacity || 0),
                poster_url: posterUrl || null,
                images: posterUrl ? [posterUrl] : [],
                ticket_price: Number(form.ticket_price || 0),
                currency: form.currency || 'KES',
                category: form.category.trim() || 'outreach',
                is_public: form.is_public ? 1 : 0,
                scorecard_enabled: form.scorecard_enabled,
            });
            setForm(newEventForm());
            setShowCreate(false);
            await fetchEvents(true);
            Alert.alert('Created', 'Event created and pinned by default.');
        } catch (e) {
            console.error('Create event error:', e);
            Alert.alert('Error', e.response?.data?.detail || 'Failed to create event.');
        } finally {
            setCreating(false);
        }
    };

    const handleTogglePin = async (item) => {
        setPinningId(item.id);
        try {
            if (item.is_pinned) {
                await client.delete(`/admin/pins/event/${item.id}`);
            } else {
                await client.post('/admin/pins', {
                    target_type: 'event',
                    target_id: item.id,
                    title: item.title,
                    description: item.description,
                    priority: 150,
                });
            }
            await fetchEvents(true);
        } catch (e) {
            Alert.alert('Error', 'Failed to update pin status.');
        } finally {
            setPinningId(null);
        }
    };

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
    const pendingPayments = events.reduce((sum, e) => sum + (e.pending_payment_count || 0), 0);
    const totalRevenue = events.reduce((sum, e) => sum + (Number(e.event_revenue) || 0), 0);
    const upcoming = events.filter(e => new Date(e.start_time) > new Date()).length;

    const renderListHeader = () => (
        <View>
            {showCreate && (
                <View style={[s.card, { marginTop: 10, marginBottom: 12, backgroundColor: ADMIN_COLORS.surfaceLight }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: ADMIN_COLORS.textPrimary }}>Create admin event</Text>
                            <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginTop: 4 }}>
                                Posters, paid tickets, forms, pins, and Scorecard are all available here.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowCreate(false)} style={{ padding: 8 }}>
                            <Ionicons name="close" size={22} color={ADMIN_COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={{ marginTop: 16, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: `${ADMIN_COLORS.info}12`, borderWidth: 1, borderColor: ADMIN_COLORS.surfaceBorder, alignItems: 'center', justifyContent: 'center' }}
                        onPress={pickPoster}
                    >
                        {form.poster_url ? (
                            <Image source={{ uri: form.poster_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <Ionicons name="image-outline" size={34} color={ADMIN_COLORS.info} />
                                <Text style={{ marginTop: 8, color: ADMIN_COLORS.info, fontWeight: '800' }}>Add event poster</Text>
                                <Text style={{ marginTop: 2, color: ADMIN_COLORS.textMuted, fontSize: 11 }}>This appears in upcoming events and spotlight cards</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {[
                        ['title', 'Title'],
                        ['description', 'Description'],
                        ['location', 'Location'],
                        ['category', 'Category'],
                        ['start_time', 'Start time, e.g. 2026-07-01T10:00'],
                        ['end_time', 'End time, e.g. 2026-07-01T12:00'],
                    ].map(([key, label]) => (
                        <View key={key}>
                            <Text style={s.inputLabel}>{label}</Text>
                            <TextInput
                                style={[s.textInput, {
                                    backgroundColor: ADMIN_COLORS.surface,
                                    borderRadius: 10,
                                    paddingHorizontal: 12,
                                    minHeight: key === 'description' ? 82 : 48,
                                    textAlignVertical: 'top',
                                }]}
                                multiline={key === 'description'}
                                value={form[key]}
                                onChangeText={(value) => setForm(prev => ({ ...prev, [key]: value }))}
                            />
                        </View>
                    ))}

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.inputLabel}>Capacity</Text>
                            <TextInput
                                style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                keyboardType="numeric"
                                value={form.capacity}
                                onChangeText={(value) => setForm(prev => ({ ...prev, capacity: value }))}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.inputLabel}>Ticket price</Text>
                            <TextInput
                                style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                keyboardType="numeric"
                                value={form.ticket_price}
                                onChangeText={(value) => setForm(prev => ({ ...prev, ticket_price: value }))}
                            />
                        </View>
                        <View style={{ width: 82 }}>
                            <Text style={s.inputLabel}>Currency</Text>
                            <TextInput
                                style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                value={form.currency}
                                autoCapitalize="characters"
                                onChangeText={(value) => setForm(prev => ({ ...prev, currency: value.toUpperCase() }))}
                            />
                        </View>
                    </View>

                    <View style={{ backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 12, marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Public event</Text>
                                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 11 }}>Show in every user's upcoming events</Text>
                            </View>
                            <Switch value={form.is_public} onValueChange={(value) => setForm(prev => ({ ...prev, is_public: value }))} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                            <View>
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Enable Scorecard</Text>
                                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 11 }}>Collect Mbwa Rafiki baseline and follow-up data</Text>
                            </View>
                            <Switch value={form.scorecard_enabled} onValueChange={(value) => setForm(prev => ({ ...prev, scorecard_enabled: value }))} />
                        </View>
                    </View>

                    <TouchableOpacity style={s.primaryButton} onPress={handleCreate} disabled={creating}>
                        {creating ? <ActivityIndicator color={ADMIN_COLORS.bg} /> : <Ionicons name="calendar-outline" size={18} color={ADMIN_COLORS.bg} />}
                        <Text style={s.primaryButtonText}>{creating ? 'Creating...' : 'Create, publish, and pin event'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[
                    ['Upcoming', upcoming, ADMIN_COLORS.info],
                    ['Registrations', totalRegs, ADMIN_COLORS.chart2],
                    ['Check-ins', totalCheckins, ADMIN_COLORS.accent],
                    ['Pending pay', pendingPayments, ADMIN_COLORS.warning],
                ].map(([label, value, color]) => (
                    <View key={label} style={[s.card, { flexGrow: 1, flexBasis: '47%', alignItems: 'center', paddingVertical: 12, marginBottom: 0 }]}>
                        <Text style={{ fontSize: 20, fontWeight: '800', color }}>{value}</Text>
                        <Text style={{ fontSize: 10, color: ADMIN_COLORS.textMuted }}>{label}</Text>
                    </View>
                ))}
                <View style={[s.card, { width: '100%', paddingVertical: 12, marginBottom: 0, backgroundColor: `${ADMIN_COLORS.success}12` }]}>
                    <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, fontWeight: '700' }}>Paid event revenue</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: ADMIN_COLORS.success, marginTop: 3 }}>
                        KES {totalRevenue.toLocaleString()}
                    </Text>
                </View>
            </View>
        </View>
    );

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
                    <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.successBg }]}
                        onPress={() => setShowCreate(prev => !prev)}
                    >
                        <Ionicons name={showCreate ? 'close-outline' : 'add-circle-outline'} size={15} color={ADMIN_COLORS.success} />
                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.success }]}>{showCreate ? 'Close' : 'Create'}</Text>
                    </TouchableOpacity>
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
                    ListHeaderComponent={renderListHeader}
                    ListEmptyComponent={
                        <View style={s.emptyContainer}>
                            <Ionicons name="calendar-outline" size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>No events yet</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const status = getEventStatus(item.start_time, item.end_time);
                        const capacity = item.capacity || 0;
                        return (
                            <View style={s.listCard}>
                                <View style={s.listCardHeader}>
                                    {item.poster_url ? (
                                        <Image source={{ uri: item.poster_url }} style={{ width: 58, height: 58, borderRadius: 12, marginRight: 12, backgroundColor: ADMIN_COLORS.surfaceBorder }} />
                                    ) : (
                                        <View style={{ width: 58, height: 58, borderRadius: 12, marginRight: 12, backgroundColor: `${ADMIN_COLORS.info}14`, alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="calendar-outline" size={24} color={ADMIN_COLORS.info} />
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.listCardTitle}>{item.title}</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7, marginBottom: 2 }}>
                                            <View style={[s.badge, { backgroundColor: (Number(item.ticket_price || 0) > 0) ? ADMIN_COLORS.successBg : ADMIN_COLORS.surfaceBorder }]}>
                                                <Text style={[s.badgeText, { color: (Number(item.ticket_price || 0) > 0) ? ADMIN_COLORS.success : ADMIN_COLORS.textSecondary }]}>
                                                    {Number(item.ticket_price || 0) > 0 ? `${item.currency || 'KES'} ${Number(item.ticket_price || 0).toLocaleString()}` : 'FREE'}
                                                </Text>
                                            </View>
                                            {item.scorecard_enabled && (
                                                <View style={[s.badge, { backgroundColor: ADMIN_COLORS.infoBg }]}>
                                                    <Text style={[s.badgeText, { color: ADMIN_COLORS.info }]}>SCORECARD</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={s.listCardSub}>by {item.organizer_name} - {item.category}</Text>
                                    </View>
                                    <View style={[s.badge, { backgroundColor: `${status.color}20` }]}>
                                        <Text style={[s.badgeText, { color: status.color }]}>{status.label}</Text>
                                    </View>
                                    {item.is_pinned && (
                                        <View style={[s.badge, { backgroundColor: ADMIN_COLORS.accent, marginLeft: 6 }]}>
                                            <Text style={[s.badgeText, { color: ADMIN_COLORS.bg }]}>PINNED</Text>
                                        </View>
                                    )}
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

                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                    <View style={{ flex: 1, backgroundColor: `${ADMIN_COLORS.success}12`, borderRadius: 10, padding: 10 }}>
                                        <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 10, fontWeight: '700' }}>PAID REVENUE</Text>
                                        <Text style={{ color: ADMIN_COLORS.success, fontSize: 15, fontWeight: '900', marginTop: 2 }}>
                                            {item.currency || 'KES'} {Number(item.event_revenue || 0).toLocaleString()}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: `${ADMIN_COLORS.warning}12`, borderRadius: 10, padding: 10 }}>
                                        <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 10, fontWeight: '700' }}>PENDING PAYMENTS</Text>
                                        <Text style={{ color: ADMIN_COLORS.warning, fontSize: 15, fontWeight: '900', marginTop: 2 }}>
                                            {item.pending_payment_count || 0}
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
                                        style={[s.actionBtn, { backgroundColor: item.is_pinned ? ADMIN_COLORS.dangerBg : ADMIN_COLORS.successBg, marginRight: 10 }]}
                                        onPress={() => handleTogglePin(item)}
                                        disabled={pinningId === item.id}
                                    >
                                        {pinningId === item.id ? (
                                            <ActivityIndicator size="small" color={item.is_pinned ? ADMIN_COLORS.danger : ADMIN_COLORS.success} />
                                        ) : (
                                            <Ionicons name={item.is_pinned ? 'remove-circle-outline' : 'pin-outline'} size={14} color={item.is_pinned ? ADMIN_COLORS.danger : ADMIN_COLORS.success} />
                                        )}
                                        <Text style={[s.actionBtnText, { color: item.is_pinned ? ADMIN_COLORS.danger : ADMIN_COLORS.success }]}>
                                            {item.is_pinned ? 'Unpin' : 'Pin'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: '#4a90e220', marginRight: 10 }]}
                                        onPress={() => navigation.navigate('EventResponses', { eventId: item.id, eventTitle: item.title })}
                                    >
                                        <Ionicons name="people-outline" size={14} color="#4a90e2" />
                                        <Text style={[s.actionBtnText, { color: '#4a90e2' }]}>Responses</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.warningBg, marginRight: 10 }]}
                                        onPress={() => navigation.navigate('EventFormBuilder', { eventId: item.id, eventTitle: item.title })}
                                    >
                                        <Ionicons name="document-text-outline" size={14} color={ADMIN_COLORS.warning} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.warning }]}>Questions</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.infoBg, marginRight: 10 }]}
                                        onPress={onOpenScorecard}
                                    >
                                        <Ionicons name="clipboard-outline" size={14} color={ADMIN_COLORS.info} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.info }]}>Scorecard</Text>
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
