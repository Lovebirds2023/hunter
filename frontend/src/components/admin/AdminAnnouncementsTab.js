import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert, ScrollView, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

const emptyOptions = {
    target_groups: [],
    roles: [],
    events: [],
    case_types: [],
    case_statuses: [],
    item_types: [],
    registration_statuses: [],
    payment_statuses: [],
};

const newBroadcastForm = () => ({
    title: '',
    message: '',
    target_group: 'event_registrants',
    role: 'buyer',
    event_id: '',
    registration_status: 'all',
    payment_status: 'all',
    ticket_tier_id: 'all',
    booking_slot_id: 'all',
    case_type: 'all',
    case_status: 'all',
    item_type: 'all',
    published_only: true,
    approved_only: false,
});

const setIfSpecific = (filters, key, value) => {
    if (value && value !== 'all') filters[key] = value;
};

const groupIcon = (group) => {
    switch (group) {
        case 'event_registrants': return 'calendar-number-outline';
        case 'case_reporters': return 'alert-circle-outline';
        case 'listing_publishers':
        case 'product_publishers': return 'storefront-outline';
        case 'sellers_with_sales': return 'cash-outline';
        case 'role_users': return 'people-outline';
        default: return 'notifications-outline';
    }
};

export const AdminAnnouncementsTab = ({ onBack }) => {
    const [campaigns, setCampaigns] = useState([]);
    const [options, setOptions] = useState(emptyOptions);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [form, setForm] = useState(newBroadcastForm());
    const [submitting, setSubmitting] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [previewCount, setPreviewCount] = useState(null);

    const selectedEvent = useMemo(
        () => (options.events || []).find(event => event.id === form.event_id),
        [options.events, form.event_id]
    );

    const groupLabels = useMemo(() => {
        const map = {};
        (options.target_groups || []).forEach(group => { map[group.id] = group.label; });
        return map;
    }, [options.target_groups]);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [campaignRes, optionRes] = await Promise.all([
                client.get('/admin/notification-campaigns'),
                client.get('/admin/notification-target-options'),
            ]);
            const nextOptions = { ...emptyOptions, ...(optionRes.data || {}) };
            setCampaigns(campaignRes.data || []);
            setOptions(nextOptions);
            setForm(prev => ({
                ...prev,
                event_id: prev.event_id || nextOptions.events?.[0]?.id || '',
            }));
        } catch (e) {
            console.error('Broadcast fetch error:', e);
            Alert.alert('Error', 'Could not load broadcast tools.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        setPreviewCount(null);
    }, [form]);

    const buildFilters = () => {
        const filters = {};
        if (form.target_group === 'role_users') {
            filters.role = form.role;
        }
        if (form.target_group === 'event_registrants') {
            filters.event_id = form.event_id;
            setIfSpecific(filters, 'registration_status', form.registration_status);
            setIfSpecific(filters, 'payment_status', form.payment_status);
            setIfSpecific(filters, 'ticket_tier_id', form.ticket_tier_id);
            setIfSpecific(filters, 'booking_slot_id', form.booking_slot_id);
        }
        if (form.target_group === 'case_reporters') {
            setIfSpecific(filters, 'case_type', form.case_type);
            setIfSpecific(filters, 'case_status', form.case_status);
        }
        if (form.target_group === 'listing_publishers') {
            setIfSpecific(filters, 'item_type', form.item_type);
            filters.published_only = form.published_only;
            filters.approved_only = form.approved_only;
        }
        if (form.target_group === 'product_publishers') {
            filters.item_type = 'products';
            filters.published_only = form.published_only;
            filters.approved_only = form.approved_only;
        }
        if (form.target_group === 'sellers_with_sales') {
            setIfSpecific(filters, 'item_type', form.item_type);
        }
        return filters;
    };

    const buildPayload = () => ({
        title: form.title.trim(),
        message: form.message.trim(),
        target_group: form.target_group,
        filters: buildFilters(),
        type: 'admin_broadcast',
    });

    const validateForm = () => {
        if (form.title.trim().length < 3 || form.message.trim().length < 3) {
            Alert.alert('Add message', 'Add a clear title and message first.');
            return false;
        }
        if (form.target_group === 'event_registrants' && !form.event_id) {
            Alert.alert('Choose event', 'Select the event whose registrants should receive this message.');
            return false;
        }
        return true;
    };

    const handlePreview = async () => {
        if (!validateForm()) return null;
        setPreviewing(true);
        try {
            const res = await client.post('/admin/notification-campaigns/preview', buildPayload());
            setPreviewCount(res.data.recipient_count);
            return res.data.recipient_count;
        } catch (e) {
            Alert.alert('Preview failed', e.response?.data?.detail || 'Could not calculate recipients.');
            return null;
        } finally {
            setPreviewing(false);
        }
    };

    const sendNow = async (expectedCount) => {
        setSubmitting(true);
        try {
            await client.post('/admin/notification-campaigns/send', buildPayload());
            setForm(prev => ({ ...newBroadcastForm(), event_id: prev.event_id }));
            setPreviewCount(null);
            await fetchData(true);
            Alert.alert('Sent', `Broadcast delivered to ${expectedCount} inbox${expectedCount === 1 ? '' : 'es'}.`);
        } catch (e) {
            Alert.alert('Send failed', e.response?.data?.detail || 'Could not send broadcast.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSend = async () => {
        const count = previewCount ?? await handlePreview();
        if (count === null) return;
        if (count <= 0) {
            Alert.alert('No recipients', 'No users match this target group.');
            return;
        }
        Alert.alert(
            'Send broadcast?',
            `This will send an inbox notification to ${count} user${count === 1 ? '' : 's'}.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Send', onPress: () => sendNow(count) },
            ]
        );
    };

    const Chip = ({ label, active, onPress, icon }) => (
        <TouchableOpacity
            style={[s.filterChip, active && s.filterChipActive, { marginRight: 8, marginBottom: 8 }]}
            onPress={onPress}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {icon && <Ionicons name={icon} size={14} color={active ? ADMIN_COLORS.bg : ADMIN_COLORS.textSecondary} />}
                <Text style={[s.filterChipText, active && s.filterChipTextActive, icon && { marginLeft: 6 }]}>
                    {label}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const optionRow = (label, items, value, setter, includeAll = true) => (
        <View style={{ marginTop: 12 }}>
            <Text style={s.inputLabel}>{label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {includeAll && <Chip label="All" active={value === 'all'} onPress={() => setter('all')} />}
                {(items || []).map(item => (
                    <Chip
                        key={item.id}
                        label={item.label || item.title || item.id}
                        active={value === item.id}
                        onPress={() => setter(item.id)}
                    />
                ))}
            </ScrollView>
        </View>
    );

    const renderFilters = () => {
        if (form.target_group === 'role_users') {
            return optionRow('Role', options.roles, form.role, role => setForm(prev => ({ ...prev, role })), false);
        }
        if (form.target_group === 'event_registrants') {
            return (
                <View>
                    {optionRow('Event', (options.events || []).map(event => ({
                        id: event.id,
                        label: event.title,
                    })), form.event_id, event_id => setForm(prev => ({
                        ...prev,
                        event_id,
                        ticket_tier_id: 'all',
                        booking_slot_id: 'all',
                    })), false)}
                    {optionRow('Registration status', options.registration_statuses, form.registration_status, registration_status => setForm(prev => ({ ...prev, registration_status })))}
                    {optionRow('Payment status', options.payment_statuses, form.payment_status, payment_status => setForm(prev => ({ ...prev, payment_status })))}
                    {selectedEvent?.ticket_tiers?.length > 0 && optionRow('Ticket category', selectedEvent.ticket_tiers.map(tier => ({
                        id: tier.id,
                        label: tier.label,
                    })), form.ticket_tier_id, ticket_tier_id => setForm(prev => ({ ...prev, ticket_tier_id })))}
                    {selectedEvent?.available_slots?.length > 0 && optionRow('Booking slot', selectedEvent.available_slots.map(slot => ({
                        id: slot.id,
                        label: slot.label,
                    })), form.booking_slot_id, booking_slot_id => setForm(prev => ({ ...prev, booking_slot_id })))}
                </View>
            );
        }
        if (form.target_group === 'case_reporters') {
            return (
                <View>
                    {optionRow('Case type', options.case_types, form.case_type, case_type => setForm(prev => ({ ...prev, case_type })))}
                    {optionRow('Case status', options.case_statuses, form.case_status, case_status => setForm(prev => ({ ...prev, case_status })))}
                </View>
            );
        }
        if (form.target_group === 'listing_publishers' || form.target_group === 'product_publishers') {
            return (
                <View>
                    {form.target_group === 'listing_publishers' && optionRow('Listing type', options.item_types, form.item_type, item_type => setForm(prev => ({ ...prev, item_type })))}
                    <View style={{ marginTop: 12, gap: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.inputLabel}>Published listings only</Text>
                            <Switch value={form.published_only} onValueChange={published_only => setForm(prev => ({ ...prev, published_only }))} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.inputLabel}>Approved listings only</Text>
                            <Switch value={form.approved_only} onValueChange={approved_only => setForm(prev => ({ ...prev, approved_only }))} />
                        </View>
                    </View>
                </View>
            );
        }
        if (form.target_group === 'sellers_with_sales') {
            return optionRow('Sold item type', options.item_types, form.item_type, item_type => setForm(prev => ({ ...prev, item_type })));
        }
        return null;
    };

    const renderHeader = () => (
        <View>
            <View style={[s.card, { marginBottom: 16, padding: 16 }]}>
                <Text style={[s.sectionTitle, { fontSize: 16 }]}>Targeted Inbox Broadcast</Text>
                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                    Send tailored support, updates, reminders, or follow-ups directly to selected user inboxes.
                </Text>

                <Text style={s.inputLabel}>Title</Text>
                <View style={s.inputContainer}>
                    <TextInput
                        style={s.textInput}
                        placeholder="e.g. Event reminder, seller support, case follow-up"
                        placeholderTextColor={ADMIN_COLORS.textMuted}
                        value={form.title}
                        onChangeText={title => setForm(prev => ({ ...prev, title }))}
                    />
                </View>

                <Text style={s.inputLabel}>Message</Text>
                <View style={[s.inputContainer, { height: 112, paddingTop: 8 }]}>
                    <TextInput
                        style={[s.textInput, { height: 92, textAlignVertical: 'top' }]}
                        placeholder="Write the inbox notification message..."
                        placeholderTextColor={ADMIN_COLORS.textMuted}
                        multiline
                        value={form.message}
                        onChangeText={message => setForm(prev => ({ ...prev, message }))}
                    />
                </View>

                <Text style={s.inputLabel}>Target group</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                    {(options.target_groups || []).map(group => (
                        <Chip
                            key={group.id}
                            icon={groupIcon(group.id)}
                            label={group.label}
                            active={form.target_group === group.id}
                            onPress={() => setForm(prev => ({ ...prev, target_group: group.id }))}
                        />
                    ))}
                </View>
                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 11, lineHeight: 16 }}>
                    {(options.target_groups || []).find(group => group.id === form.target_group)?.description || ''}
                </Text>

                <View style={{ backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 12, padding: 12, marginTop: 12 }}>
                    <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Audience filters</Text>
                    {renderFilters() || (
                        <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 12, marginTop: 8 }}>
                            No extra filters needed for this audience.
                        </Text>
                    )}
                </View>

                {previewCount !== null && (
                    <View style={{ marginTop: 12, backgroundColor: ADMIN_COLORS.infoBg, borderRadius: 12, padding: 12 }}>
                        <Text style={{ color: ADMIN_COLORS.info, fontSize: 22, fontWeight: '900' }}>{previewCount}</Text>
                        <Text style={{ color: ADMIN_COLORS.textSecondary, fontSize: 12 }}>matching inbox recipient{previewCount === 1 ? '' : 's'}</Text>
                    </View>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.infoBg }]}
                        onPress={handlePreview}
                        disabled={previewing || submitting}
                    >
                        {previewing ? <ActivityIndicator size="small" color={ADMIN_COLORS.info} /> : <Ionicons name="eye-outline" size={16} color={ADMIN_COLORS.info} />}
                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.info }]}>Preview count</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.successBg }]}
                        onPress={handleSend}
                        disabled={previewing || submitting}
                    >
                        {submitting ? <ActivityIndicator size="small" color={ADMIN_COLORS.success} /> : <Ionicons name="send-outline" size={16} color={ADMIN_COLORS.success} />}
                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.success }]}>Send broadcast</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Broadcast History</Text>
                <Text style={s.sectionAction}>{campaigns.length} recent</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={s.screen}>
                <View style={s.loadingContainer}><ActivityIndicator size="large" color={ADMIN_COLORS.accent} /></View>
            </View>
        );
    }

    return (
        <View style={s.screen}>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: ADMIN_COLORS.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 14 }}>
                        <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>Inbox Broadcasts</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>Targeted updates and support</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={campaigns}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={ADMIN_COLORS.accent} />}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={
                    <View style={s.emptyContainer}>
                        <Ionicons name="notifications-outline" size={48} color={ADMIN_COLORS.textMuted} />
                        <Text style={s.emptyText}>No broadcasts sent yet</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={s.listCard}>
                        <View style={s.listCardHeader}>
                            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: ADMIN_COLORS.infoBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Ionicons name={groupIcon(item.target_group)} size={20} color={ADMIN_COLORS.info} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.listCardTitle}>{item.title}</Text>
                                <Text style={s.listCardSub}>
                                    {new Date(item.created_at).toLocaleString()} - {groupLabels[item.target_group] || item.target_group}
                                </Text>
                            </View>
                            <View style={[s.badge, { backgroundColor: ADMIN_COLORS.successBg }]}>
                                <Text style={[s.badgeText, { color: ADMIN_COLORS.success }]}>{item.recipient_count} sent</Text>
                            </View>
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
