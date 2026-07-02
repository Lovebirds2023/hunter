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
import { runtimeConfig } from '../../config/runtimeConfig';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';
import { DistributionBar } from './ChartComponents';
import {
    ImageFrameGuide,
    getImageFrameAspectRatio,
    getImagePickerAspect,
} from '../ImageFrameGuide';

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
        tiered_ticketing: false,
        free_tier_label: 'Community Access',
        free_tier_description: 'Free registration for participants the program is designed to support.',
        paid_tier_label: 'Paid Access',
        paid_tier_description: 'Paid registration for organizations, teams, companies, or sponsored participants.',
        paid_ticket_price: '0',
        attendee_type_question: 'Briefly explain why this registration category applies to you.',
        schedule_enabled: false,
        available_slots: [],
        scorecard_title: 'Community Impact Assessment',
        scorecard_description: 'Collect baseline and follow-up data for M&E, outcome tracking, and partner reporting.',
        is_public: true,
        scorecard_enabled: true,
    };
};

const defaultTierQuestion = 'Briefly explain why this registration category applies to you.';
const defaultFreeTierLabel = 'Community Access';
const defaultFreeTierDescription = 'Free registration for participants the program is designed to support.';
const defaultPaidTierLabel = 'Paid Access';
const defaultPaidTierDescription = 'Paid registration for organizations, teams, companies, or sponsored participants.';
const defaultScorecardTitle = 'Community Impact Assessment';
const defaultScorecardDescription = 'Collect baseline and follow-up data for M&E, outcome tracking, and partner reporting.';

const requestErrorMessage = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (Array.isArray(detail) && detail.length > 0) return detail.map(item => item?.msg || item).join('\n');
    if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
    return fallback;
};

const toDatetimeLocal = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    return date.toISOString().slice(0, 16);
};

const makeSlot = (startTime, endTime, index = 0) => ({
    id: `slot_${Date.now()}_${index + 1}`,
    label: `Available slot ${index + 1}`,
    start_time: toDatetimeLocal(startTime || new Date()),
    end_time: toDatetimeLocal(endTime || new Date(Date.now() + 60 * 60 * 1000)),
    capacity: '',
    location: '',
    notes: '',
});

const toSlotPayload = (slots = []) => {
    const payload = [];
    slots.forEach((slot, index) => {
        const hasContent = slot.label || slot.start_time || slot.end_time || slot.capacity || slot.location || slot.notes;
        if (!hasContent) return;
        if (!slot.start_time || !slot.end_time) throw new Error('Missing slot time');

        const start = new Date(slot.start_time);
        const end = new Date(slot.end_time);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            throw new Error('Invalid slot time');
        }

        const capacity = Number(slot.capacity || 0);
        if (Number.isNaN(capacity) || capacity < 0) throw new Error('Invalid slot capacity');

        payload.push({
            id: slot.id || `slot_${index + 1}`,
            label: (slot.label || `Available slot ${index + 1}`).trim(),
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            capacity: Math.floor(capacity),
            location: (slot.location || '').trim(),
            notes: (slot.notes || '').trim(),
        });
    });
    return payload;
};

const normalizeSlotsForForm = (slots, startTime, endTime) => {
    if (Array.isArray(slots) && slots.length > 0) {
        return slots.map((slot, index) => ({
            id: slot.id || `slot_${index + 1}`,
            label: slot.label || `Available slot ${index + 1}`,
            start_time: toDatetimeLocal(slot.start_time),
            end_time: toDatetimeLocal(slot.end_time),
            capacity: slot.capacity ? String(slot.capacity) : '',
            location: slot.location || '',
            notes: slot.notes || '',
        }));
    }
    return [makeSlot(startTime, endTime, 0)];
};

export const AdminEventsTab = ({ onBack, navigation, onOpenScorecard }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState(newEventForm());
    const [posterFrameRatio, setPosterFrameRatio] = useState('16:9');
    const [pinningId, setPinningId] = useState(null);
    const [ticketingEvent, setTicketingEvent] = useState(null);
    const [savingTicketing, setSavingTicketing] = useState(false);
    const [ticketingForm, setTicketingForm] = useState({
        enabled: false,
        free_tier_label: defaultFreeTierLabel,
        free_tier_description: defaultFreeTierDescription,
        paid_tier_label: defaultPaidTierLabel,
        paid_tier_description: defaultPaidTierDescription,
        paid_ticket_price: '0',
        standard_ticket_price: '0',
        currency: 'KES',
        attendee_type_question: defaultTierQuestion,
    });
    const [scorecardEvent, setScorecardEvent] = useState(null);
    const [savingScorecard, setSavingScorecard] = useState(false);
    const [scorecardForm, setScorecardForm] = useState({
        enabled: true,
        title: defaultScorecardTitle,
        description: defaultScorecardDescription,
    });
    const [scheduleEvent, setScheduleEvent] = useState(null);
    const [savingSchedule, setSavingSchedule] = useState(false);
    const [scheduleSlots, setScheduleSlots] = useState([]);
    const [deleteReasons, setDeleteReasons] = useState({});

    const uploadPosterIfNeeded = async (uri) => {
        if (!uri || /^https?:\/\//i.test(uri)) return uri;

        const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
        const safeExtension = extension.length <= 5 ? extension : 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExtension}`;
        const filePath = `event-posters/${fileName}`;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

        const { error } = await supabase.storage
            .from(runtimeConfig.storageBuckets.eventImages)
            .upload(filePath, decode(base64), {
                contentType: `image/${safeExtension === 'jpg' ? 'jpeg' : safeExtension}`,
                upsert: true,
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from(runtimeConfig.storageBuckets.eventImages)
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
                allowsEditing: true,
                aspect: getImagePickerAspect(posterFrameRatio, '16:9'),
                quality: 0.85,
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
        let availableSlots = [];
        if (form.schedule_enabled) {
            try {
                availableSlots = toSlotPayload(form.available_slots);
            } catch {
                Alert.alert('Check schedule', 'Use valid start and end times for every booking slot.');
                return;
            }
            if (availableSlots.length === 0) {
                Alert.alert('Add dates', 'Add at least one available date/time slot, or turn booking schedule off.');
                return;
            }
        }
        if (form.tiered_ticketing) {
            if (!form.free_tier_label.trim() || !form.paid_tier_label.trim()) {
                Alert.alert('Category names required', 'Name both the free and paid registration categories.');
                return;
            }
            if (Number(form.paid_ticket_price || 0) <= 0) {
                Alert.alert('Paid price required', 'Set a paid ticket price greater than zero.');
                return;
            }
            if (!form.attendee_type_question.trim()) {
                Alert.alert('Question required', 'Add the justification question for the registration categories.');
                return;
            }
        }

        setCreating(true);
        try {
            const posterUrl = await uploadPosterIfNeeded(form.poster_url);
            const ticketTiers = form.tiered_ticketing ? [
                {
                    id: 'free',
                    label: form.free_tier_label.trim(),
                    price: 0,
                    currency: form.currency || 'KES',
                    description: form.free_tier_description.trim(),
                    requires_justification: true,
                },
                {
                    id: 'paid',
                    label: form.paid_tier_label.trim(),
                    price: Number(form.paid_ticket_price || 0),
                    currency: form.currency || 'KES',
                    description: form.paid_tier_description.trim(),
                    requires_justification: true,
                },
            ] : null;
            const baseTicketPrice = form.tiered_ticketing ? Number(form.paid_ticket_price || 0) : Number(form.ticket_price || 0);
            await client.post('/events', {
                title: form.title.trim(),
                description: form.description.trim(),
                location: form.location.trim(),
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                capacity: Number(form.capacity || 0),
                poster_url: posterUrl || null,
                images: posterUrl ? [posterUrl] : [],
                ticket_price: baseTicketPrice,
                currency: form.currency || 'KES',
                ticket_tiers: ticketTiers,
                attendee_type_question: form.tiered_ticketing ? form.attendee_type_question : null,
                available_slots: availableSlots,
                category: form.category.trim() || 'outreach',
                is_public: form.is_public ? 1 : 0,
                scorecard_enabled: form.scorecard_enabled,
                scorecard_title: form.scorecard_enabled ? (form.scorecard_title.trim() || defaultScorecardTitle) : null,
                scorecard_description: form.scorecard_enabled ? (form.scorecard_description.trim() || defaultScorecardDescription) : null,
            });
            setForm(newEventForm());
            setShowCreate(false);
            await fetchEvents(true);
            Alert.alert('Created', 'Event created and pinned by default.');
        } catch (e) {
            console.error('Create event error:', e);
            Alert.alert('Event not created', requestErrorMessage(e, 'Failed to create event.'));
        } finally {
            setCreating(false);
        }
    };

    const openTicketingEditor = (item) => {
        const tiers = Array.isArray(item.ticket_tiers) ? item.ticket_tiers : [];
        const freeTier = tiers.find(t => t.id === 'free') || tiers.find(t => Number(t.price || 0) === 0);
        const paidTier = tiers.find(t => t.id === 'paid') || tiers.find(t => Number(t.price || 0) > 0);
        setTicketingEvent(item);
        setTicketingForm({
            enabled: tiers.length > 0,
            free_tier_label: freeTier?.label || defaultFreeTierLabel,
            free_tier_description: freeTier?.description || defaultFreeTierDescription,
            paid_tier_label: paidTier?.label || defaultPaidTierLabel,
            paid_tier_description: paidTier?.description || defaultPaidTierDescription,
            paid_ticket_price: String(paidTier?.price ?? item.ticket_price ?? 0),
            standard_ticket_price: String(item.ticket_price || 0),
            currency: item.currency || 'KES',
            attendee_type_question: item.attendee_type_question || defaultTierQuestion,
        });
        setShowCreate(false);
        setScorecardEvent(null);
        setScheduleEvent(null);
    };

    const handleSaveTicketing = async () => {
        if (!ticketingEvent) return;
        if (ticketingForm.enabled) {
            if (!ticketingForm.free_tier_label.trim() || !ticketingForm.paid_tier_label.trim()) {
                Alert.alert('Category names required', 'Name both the free and paid registration categories.');
                return;
            }
            if (Number(ticketingForm.paid_ticket_price || 0) <= 0) {
                Alert.alert('Paid price required', 'Set a paid ticket price greater than zero.');
                return;
            }
            if (!ticketingForm.attendee_type_question.trim()) {
                Alert.alert('Question required', 'Add the justification question for the registration categories.');
                return;
            }
        }

        setSavingTicketing(true);
        try {
            const ticketTiers = ticketingForm.enabled ? [
                {
                    id: 'free',
                    label: ticketingForm.free_tier_label.trim(),
                    price: 0,
                    currency: ticketingForm.currency || 'KES',
                    description: ticketingForm.free_tier_description.trim(),
                    requires_justification: true,
                },
                {
                    id: 'paid',
                    label: ticketingForm.paid_tier_label.trim(),
                    price: Number(ticketingForm.paid_ticket_price || 0),
                    currency: ticketingForm.currency || 'KES',
                    description: ticketingForm.paid_tier_description.trim(),
                    requires_justification: true,
                },
            ] : [];
            await client.put(`/admin/events/${ticketingEvent.id}/ticketing`, {
                ticket_price: ticketingForm.enabled ? Number(ticketingForm.paid_ticket_price || 0) : Number(ticketingForm.standard_ticket_price || 0),
                currency: ticketingForm.currency || 'KES',
                ticket_tiers: ticketTiers,
                attendee_type_question: ticketingForm.enabled ? ticketingForm.attendee_type_question : null,
            });
            setTicketingEvent(null);
            await fetchEvents(true);
            Alert.alert('Saved', 'Event ticketing settings updated.');
        } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || 'Failed to update ticketing.');
        } finally {
            setSavingTicketing(false);
        }
    };

    const openScorecardEditor = (item) => {
        setScorecardEvent(item);
        setScorecardForm({
            enabled: item.scorecard_enabled !== false,
            title: item.scorecard_title || defaultScorecardTitle,
            description: item.scorecard_description || defaultScorecardDescription,
        });
        setShowCreate(false);
        setTicketingEvent(null);
        setScheduleEvent(null);
    };

    const handleSaveScorecardSettings = async () => {
        if (!scorecardEvent) return;
        if (scorecardForm.enabled && !scorecardForm.title.trim()) {
            Alert.alert('Impact template name required', 'Name this impact assessment/template.');
            return;
        }

        setSavingScorecard(true);
        try {
            await client.put(`/admin/events/${scorecardEvent.id}/scorecard-settings`, {
                scorecard_enabled: scorecardForm.enabled,
                scorecard_title: scorecardForm.enabled ? (scorecardForm.title.trim() || defaultScorecardTitle) : null,
                scorecard_description: scorecardForm.enabled ? (scorecardForm.description.trim() || defaultScorecardDescription) : null,
            });
            setScorecardEvent(null);
            await fetchEvents(true);
            Alert.alert('Saved', 'Impact tracking settings updated.');
        } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || 'Failed to update impact tracking settings.');
        } finally {
            setSavingScorecard(false);
        }
    };

    const updateFormSlot = (index, key, value) => {
        setForm(prev => ({
            ...prev,
            available_slots: (prev.available_slots || []).map((slot, idx) => (
                idx === index ? { ...slot, [key]: value } : slot
            )),
        }));
    };

    const addFormSlot = () => {
        setForm(prev => ({
            ...prev,
            schedule_enabled: true,
            available_slots: [
                ...(prev.available_slots || []),
                makeSlot(prev.start_time, prev.end_time, (prev.available_slots || []).length),
            ],
        }));
    };

    const removeFormSlot = (index) => {
        setForm(prev => ({
            ...prev,
            available_slots: (prev.available_slots || []).filter((_, idx) => idx !== index),
        }));
    };

    const openScheduleEditor = (item) => {
        setScheduleEvent(item);
        setScheduleSlots(normalizeSlotsForForm(item.available_slots, item.start_time, item.end_time));
        setShowCreate(false);
        setTicketingEvent(null);
        setScorecardEvent(null);
    };

    const updateScheduleSlot = (index, key, value) => {
        setScheduleSlots(prev => prev.map((slot, idx) => (
            idx === index ? { ...slot, [key]: value } : slot
        )));
    };

    const addScheduleSlot = () => {
        setScheduleSlots(prev => [
            ...prev,
            makeSlot(scheduleEvent?.start_time, scheduleEvent?.end_time, prev.length),
        ]);
    };

    const removeScheduleSlot = (index) => {
        setScheduleSlots(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleSaveSchedule = async () => {
        if (!scheduleEvent) return;
        let slots = [];
        try {
            slots = toSlotPayload(scheduleSlots);
        } catch {
            Alert.alert('Check schedule', 'Use valid start and end times for every booking slot.');
            return;
        }

        setSavingSchedule(true);
        try {
            await client.put(`/admin/events/${scheduleEvent.id}/schedule`, {
                available_slots: slots,
            });
            setScheduleEvent(null);
            await fetchEvents(true);
            Alert.alert('Saved', 'Event booking schedule updated.');
        } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || 'Failed to update booking schedule.');
        } finally {
            setSavingSchedule(false);
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

    const updateDeleteReason = (id, reason) => {
        setDeleteReasons(prev => ({ ...prev, [id]: reason }));
    };

    const handleDelete = (item) => {
        const reason = (deleteReasons[item.id] || '').trim();
        if (!reason) {
            Alert.alert('Reason required', 'Add a short reason before deleting this event.');
            return;
        }
        const title = item.title || 'this event';
        Alert.alert('Delete Event', `Delete "${title}"? This will remove all registrations.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await client.delete(`/admin/events/${item.id}`, { data: { reason } });
                        setEvents(prev => prev.filter(e => e.id !== item.id));
                        Alert.alert('Deleted', 'Event and registrations removed.');
                    } catch (e) { Alert.alert('Error', e.response?.data?.detail || 'Failed to delete event'); }
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
    const posterPreviewAspectRatio = getImageFrameAspectRatio(posterFrameRatio, '16:9');

    const listHeader = (
        <View>
            {showCreate && (
                <View style={[s.card, { marginTop: 10, marginBottom: 12, backgroundColor: ADMIN_COLORS.surfaceLight }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: ADMIN_COLORS.textPrimary }}>Create admin event</Text>
                            <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginTop: 4 }}>
                                Posters, paid tickets, forms, pins, and impact tracking are available here.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowCreate(false)} style={{ padding: 8 }}>
                            <Ionicons name="close" size={22} color={ADMIN_COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ marginTop: 16 }}>
                        <ImageFrameGuide
                            title="Event poster frame"
                            guidance="Event posters work best as a wide banner. Choose the ratio before selecting the poster, then zoom and move the artwork so names, dates, and logos stay inside the frame."
                            ratios={['16:9', '1:1', '2:3']}
                            selectedRatio={posterFrameRatio}
                            onSelectRatio={setPosterFrameRatio}
                        />
                    </View>

                    <TouchableOpacity
                        style={{ width: '100%', aspectRatio: posterPreviewAspectRatio, borderRadius: 14, overflow: 'hidden', backgroundColor: `${ADMIN_COLORS.info}12`, borderWidth: 1, borderColor: ADMIN_COLORS.surfaceBorder, alignItems: 'center', justifyContent: 'center' }}
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

                    <View style={{ backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 12, marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Booking schedule</Text>
                                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 11, marginTop: 3 }}>
                                    Add available dates/times users can choose when booking this event.
                                </Text>
                            </View>
                            <Switch
                                value={form.schedule_enabled}
                                onValueChange={(value) => setForm(prev => ({
                                    ...prev,
                                    schedule_enabled: value,
                                    available_slots: value && (prev.available_slots || []).length === 0
                                        ? [makeSlot(prev.start_time, prev.end_time, 0)]
                                        : prev.available_slots,
                                }))}
                            />
                        </View>
                        {form.schedule_enabled && (
                            <View style={{ marginTop: 12 }}>
                                {(form.available_slots || []).map((slot, index) => (
                                    <View key={slot.id || index} style={{ backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: ADMIN_COLORS.surfaceBorder }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Slot {index + 1}</Text>
                                            <TouchableOpacity onPress={() => removeFormSlot(index)} style={{ padding: 4 }}>
                                                <Ionicons name="trash-outline" size={16} color={ADMIN_COLORS.danger} />
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={s.inputLabel}>Label</Text>
                                        <TextInput
                                            style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                            value={slot.label}
                                            onChangeText={(value) => updateFormSlot(index, 'label', value)}
                                        />
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.inputLabel}>Starts</Text>
                                                <TextInput
                                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                                    value={slot.start_time}
                                                    onChangeText={(value) => updateFormSlot(index, 'start_time', value)}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.inputLabel}>Ends</Text>
                                                <TextInput
                                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                                    value={slot.end_time}
                                                    onChangeText={(value) => updateFormSlot(index, 'end_time', value)}
                                                />
                                            </View>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.inputLabel}>Slot capacity</Text>
                                                <TextInput
                                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                                    keyboardType="numeric"
                                                    value={slot.capacity}
                                                    onChangeText={(value) => updateFormSlot(index, 'capacity', value)}
                                                />
                                            </View>
                                            <View style={{ flex: 2 }}>
                                                <Text style={s.inputLabel}>Location override</Text>
                                                <TextInput
                                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                                    value={slot.location}
                                                    onChangeText={(value) => updateFormSlot(index, 'location', value)}
                                                />
                                            </View>
                                        </View>
                                        <Text style={s.inputLabel}>Notes</Text>
                                        <TextInput
                                            style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12, minHeight: 58, textAlignVertical: 'top' }]}
                                            multiline
                                            value={slot.notes}
                                            onChangeText={(value) => updateFormSlot(index, 'notes', value)}
                                        />
                                    </View>
                                ))}
                                <TouchableOpacity style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.infoBg, alignSelf: 'flex-start' }]} onPress={addFormSlot}>
                                    <Ionicons name="add-circle-outline" size={15} color={ADMIN_COLORS.info} />
                                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.info }]}>Add another slot</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

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
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Free / paid registration categories</Text>
                                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 11, marginTop: 3 }}>
                                    Name the free and paid categories for this event, then set the paid price.
                                </Text>
                            </View>
                            <Switch value={form.tiered_ticketing} onValueChange={(value) => setForm(prev => ({ ...prev, tiered_ticketing: value }))} />
                        </View>
                        {form.tiered_ticketing && (
                            <View style={{ marginTop: 12 }}>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                    <View style={[s.badge, { backgroundColor: ADMIN_COLORS.surfaceBorder }]}>
                                        <Text style={[s.badgeText, { color: ADMIN_COLORS.textSecondary }]}>{(form.free_tier_label || 'Free').toUpperCase()}: FREE</Text>
                                    </View>
                                    <View style={[s.badge, { backgroundColor: ADMIN_COLORS.successBg }]}>
                                        <Text style={[s.badgeText, { color: ADMIN_COLORS.success }]}>{(form.paid_tier_label || 'Paid').toUpperCase()}: PAID</Text>
                                    </View>
                                </View>
                                <Text style={s.inputLabel}>Free category name</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    value={form.free_tier_label}
                                    onChangeText={(value) => setForm(prev => ({ ...prev, free_tier_label: value }))}
                                />
                                <Text style={s.inputLabel}>Free category description</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, minHeight: 62, textAlignVertical: 'top' }]}
                                    multiline
                                    value={form.free_tier_description}
                                    onChangeText={(value) => setForm(prev => ({ ...prev, free_tier_description: value }))}
                                />
                                <Text style={s.inputLabel}>Paid category name</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    value={form.paid_tier_label}
                                    onChangeText={(value) => setForm(prev => ({ ...prev, paid_tier_label: value }))}
                                />
                                <Text style={s.inputLabel}>Paid category description</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, minHeight: 62, textAlignVertical: 'top' }]}
                                    multiline
                                    value={form.paid_tier_description}
                                    onChangeText={(value) => setForm(prev => ({ ...prev, paid_tier_description: value }))}
                                />
                                <Text style={s.inputLabel}>Paid category ticket price</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    keyboardType="numeric"
                                    value={form.paid_ticket_price}
                                    onChangeText={(value) => setForm(prev => ({ ...prev, paid_ticket_price: value }))}
                                />
                                <Text style={s.inputLabel}>Justification question</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, minHeight: 72, textAlignVertical: 'top' }]}
                                    multiline
                                    value={form.attendee_type_question}
                                    onChangeText={(value) => setForm(prev => ({ ...prev, attendee_type_question: value }))}
                                />
                            </View>
                        )}
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
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Enable impact tracking</Text>
                                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 11 }}>Collect M&E baseline and follow-up data for this program</Text>
                            </View>
                            <Switch value={form.scorecard_enabled} onValueChange={(value) => setForm(prev => ({ ...prev, scorecard_enabled: value }))} />
                        </View>
                        {form.scorecard_enabled && (
                            <View style={{ marginTop: 12 }}>
                                <Text style={s.inputLabel}>Impact assessment/template name</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    value={form.scorecard_title}
                                    onChangeText={(value) => setForm(prev => ({ ...prev, scorecard_title: value }))}
                                />
                                <Text style={s.inputLabel}>M&E purpose/description</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, minHeight: 72, textAlignVertical: 'top' }]}
                                    multiline
                                    value={form.scorecard_description}
                                    onChangeText={(value) => setForm(prev => ({ ...prev, scorecard_description: value }))}
                                />
                            </View>
                        )}
                    </View>

                    <TouchableOpacity style={s.primaryButton} onPress={handleCreate} disabled={creating}>
                        {creating ? <ActivityIndicator color={ADMIN_COLORS.bg} /> : <Ionicons name="calendar-outline" size={18} color={ADMIN_COLORS.bg} />}
                        <Text style={s.primaryButtonText}>{creating ? 'Creating...' : 'Create, publish, and pin event'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {ticketingEvent && (
                <View style={[s.card, { marginTop: 10, marginBottom: 12, backgroundColor: ADMIN_COLORS.surfaceLight }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: ADMIN_COLORS.textPrimary }}>Ticketing: {ticketingEvent.title}</Text>
                            <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginTop: 4 }}>
                                Configure custom free and paid registration categories.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setTicketingEvent(null)} style={{ padding: 8 }}>
                            <Ionicons name="close" size={22} color={ADMIN_COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 12, marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Use free / paid category split</Text>
                                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 11, marginTop: 3 }}>
                                    Off keeps the event as one standard ticket price.
                                </Text>
                            </View>
                            <Switch value={ticketingForm.enabled} onValueChange={(value) => setTicketingForm(prev => ({ ...prev, enabled: value }))} />
                        </View>

                        {ticketingForm.enabled ? (
                            <View style={{ marginTop: 12 }}>
                                <Text style={s.inputLabel}>Free category name</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    value={ticketingForm.free_tier_label}
                                    onChangeText={(value) => setTicketingForm(prev => ({ ...prev, free_tier_label: value }))}
                                />
                                <Text style={s.inputLabel}>Free category description</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, minHeight: 62, textAlignVertical: 'top' }]}
                                    multiline
                                    value={ticketingForm.free_tier_description}
                                    onChangeText={(value) => setTicketingForm(prev => ({ ...prev, free_tier_description: value }))}
                                />
                                <Text style={s.inputLabel}>Paid category name</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    value={ticketingForm.paid_tier_label}
                                    onChangeText={(value) => setTicketingForm(prev => ({ ...prev, paid_tier_label: value }))}
                                />
                                <Text style={s.inputLabel}>Paid category description</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, minHeight: 62, textAlignVertical: 'top' }]}
                                    multiline
                                    value={ticketingForm.paid_tier_description}
                                    onChangeText={(value) => setTicketingForm(prev => ({ ...prev, paid_tier_description: value }))}
                                />
                                <Text style={s.inputLabel}>Paid category ticket price</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    keyboardType="numeric"
                                    value={ticketingForm.paid_ticket_price}
                                    onChangeText={(value) => setTicketingForm(prev => ({ ...prev, paid_ticket_price: value }))}
                                />
                                <Text style={s.inputLabel}>Currency</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    value={ticketingForm.currency}
                                    autoCapitalize="characters"
                                    onChangeText={(value) => setTicketingForm(prev => ({ ...prev, currency: value.toUpperCase() }))}
                                />
                                <Text style={s.inputLabel}>Justification question</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, minHeight: 72, textAlignVertical: 'top' }]}
                                    multiline
                                    value={ticketingForm.attendee_type_question}
                                    onChangeText={(value) => setTicketingForm(prev => ({ ...prev, attendee_type_question: value }))}
                                />
                            </View>
                        ) : (
                            <View style={{ marginTop: 12 }}>
                                <Text style={s.inputLabel}>Standard ticket price</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    keyboardType="numeric"
                                    value={ticketingForm.standard_ticket_price}
                                    onChangeText={(value) => setTicketingForm(prev => ({ ...prev, standard_ticket_price: value }))}
                                />
                            </View>
                        )}
                    </View>

                    <TouchableOpacity style={s.primaryButton} onPress={handleSaveTicketing} disabled={savingTicketing}>
                        {savingTicketing ? <ActivityIndicator color={ADMIN_COLORS.bg} /> : <Ionicons name="save-outline" size={18} color={ADMIN_COLORS.bg} />}
                        <Text style={s.primaryButtonText}>{savingTicketing ? 'Saving...' : 'Save ticketing settings'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {scorecardEvent && (
                <View style={[s.card, { marginTop: 10, marginBottom: 12, backgroundColor: ADMIN_COLORS.surfaceLight }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: ADMIN_COLORS.textPrimary }}>Impact tracking: {scorecardEvent.title}</Text>
                            <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginTop: 4 }}>
                                Name the impact assessment shown to participants for this event.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setScorecardEvent(null)} style={{ padding: 8 }}>
                            <Ionicons name="close" size={22} color={ADMIN_COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 12, marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Enable impact tracking</Text>
                                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 11, marginTop: 3 }}>
                                    Participants can submit baseline and follow-up assessments when this is on.
                                </Text>
                            </View>
                            <Switch value={scorecardForm.enabled} onValueChange={(value) => setScorecardForm(prev => ({ ...prev, enabled: value }))} />
                        </View>

                        {scorecardForm.enabled && (
                            <View style={{ marginTop: 12 }}>
                                <Text style={s.inputLabel}>Impact assessment/template name</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    value={scorecardForm.title}
                                    onChangeText={(value) => setScorecardForm(prev => ({ ...prev, title: value }))}
                                />
                                <Text style={s.inputLabel}>Purpose/description</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, minHeight: 76, textAlignVertical: 'top' }]}
                                    multiline
                                    value={scorecardForm.description}
                                    onChangeText={(value) => setScorecardForm(prev => ({ ...prev, description: value }))}
                                />
                            </View>
                        )}
                    </View>

                    <TouchableOpacity style={s.primaryButton} onPress={handleSaveScorecardSettings} disabled={savingScorecard}>
                        {savingScorecard ? <ActivityIndicator color={ADMIN_COLORS.bg} /> : <Ionicons name="save-outline" size={18} color={ADMIN_COLORS.bg} />}
                        <Text style={s.primaryButtonText}>{savingScorecard ? 'Saving...' : 'Save impact settings'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {scheduleEvent && (
                <View style={[s.card, { marginTop: 10, marginBottom: 12, backgroundColor: ADMIN_COLORS.surfaceLight }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: ADMIN_COLORS.textPrimary }}>Schedule: {scheduleEvent.title}</Text>
                            <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginTop: 4 }}>
                                Set the dates/times users can choose when booking this event.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setScheduleEvent(null)} style={{ padding: 8 }}>
                            <Ionicons name="close" size={22} color={ADMIN_COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 12, marginTop: 12 }}>
                        {scheduleSlots.map((slot, index) => (
                            <View key={slot.id || index} style={{ backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: ADMIN_COLORS.surfaceBorder }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>Booking slot {index + 1}</Text>
                                    <TouchableOpacity onPress={() => removeScheduleSlot(index)} style={{ padding: 4 }}>
                                        <Ionicons name="trash-outline" size={16} color={ADMIN_COLORS.danger} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={s.inputLabel}>Label</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                    value={slot.label}
                                    onChangeText={(value) => updateScheduleSlot(index, 'label', value)}
                                />
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.inputLabel}>Starts</Text>
                                        <TextInput
                                            style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                            value={slot.start_time}
                                            onChangeText={(value) => updateScheduleSlot(index, 'start_time', value)}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.inputLabel}>Ends</Text>
                                        <TextInput
                                            style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                            value={slot.end_time}
                                            onChangeText={(value) => updateScheduleSlot(index, 'end_time', value)}
                                        />
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.inputLabel}>Capacity</Text>
                                        <TextInput
                                            style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                            keyboardType="numeric"
                                            value={slot.capacity}
                                            onChangeText={(value) => updateScheduleSlot(index, 'capacity', value)}
                                        />
                                    </View>
                                    <View style={{ flex: 2 }}>
                                        <Text style={s.inputLabel}>Location override</Text>
                                        <TextInput
                                            style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12 }]}
                                            value={slot.location}
                                            onChangeText={(value) => updateScheduleSlot(index, 'location', value)}
                                        />
                                    </View>
                                </View>
                                <Text style={s.inputLabel}>Notes</Text>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surface, borderRadius: 10, paddingHorizontal: 12, minHeight: 58, textAlignVertical: 'top' }]}
                                    multiline
                                    value={slot.notes}
                                    onChangeText={(value) => updateScheduleSlot(index, 'notes', value)}
                                />
                            </View>
                        ))}

                        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                            <TouchableOpacity style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.infoBg }]} onPress={addScheduleSlot}>
                                <Ionicons name="add-circle-outline" size={15} color={ADMIN_COLORS.info} />
                                <Text style={[s.actionBtnText, { color: ADMIN_COLORS.info }]}>Add slot</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.warningBg }]}
                                onPress={() => setScheduleSlots([])}
                            >
                                <Ionicons name="close-circle-outline" size={15} color={ADMIN_COLORS.warning} />
                                <Text style={[s.actionBtnText, { color: ADMIN_COLORS.warning }]}>Clear schedule</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={s.primaryButton} onPress={handleSaveSchedule} disabled={savingSchedule}>
                        {savingSchedule ? <ActivityIndicator color={ADMIN_COLORS.bg} /> : <Ionicons name="save-outline" size={18} color={ADMIN_COLORS.bg} />}
                        <Text style={s.primaryButtonText}>{savingSchedule ? 'Saving...' : 'Save booking schedule'}</Text>
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
                    keyboardShouldPersistTaps="handled"
                    removeClippedSubviews={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(true); }} tintColor={ADMIN_COLORS.accent} />}
                    ListHeaderComponent={listHeader}
                    ListEmptyComponent={
                        <View style={s.emptyContainer}>
                            <Ionicons name="calendar-outline" size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>No events yet</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const status = getEventStatus(item.start_time, item.end_time);
                        const capacity = item.capacity || 0;
                        const hasTiers = Array.isArray(item.ticket_tiers) && item.ticket_tiers.length > 0;
                        const slotCount = Array.isArray(item.available_slots) ? item.available_slots.length : 0;
                        const priceLabel = hasTiers
                            ? 'FREE + PAID'
                            : (Number(item.ticket_price || 0) > 0 ? `${item.currency || 'KES'} ${Number(item.ticket_price || 0).toLocaleString()}` : 'FREE');
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
                                            <View style={[s.badge, { backgroundColor: (hasTiers || Number(item.ticket_price || 0) > 0) ? ADMIN_COLORS.successBg : ADMIN_COLORS.surfaceBorder }]}>
                                                <Text style={[s.badgeText, { color: (hasTiers || Number(item.ticket_price || 0) > 0) ? ADMIN_COLORS.success : ADMIN_COLORS.textSecondary }]}>
                                                    {priceLabel}
                                                </Text>
                                            </View>
                                            {item.scorecard_enabled && (
                                                <View style={[s.badge, { backgroundColor: ADMIN_COLORS.infoBg }]}>
                                                    <Text style={[s.badgeText, { color: ADMIN_COLORS.info }]}>IMPACT</Text>
                                                </View>
                                            )}
                                            {slotCount > 0 && (
                                                <View style={[s.badge, { backgroundColor: ADMIN_COLORS.warningBg }]}>
                                                    <Text style={[s.badgeText, { color: ADMIN_COLORS.warning }]}>{slotCount} SLOT{slotCount === 1 ? '' : 'S'}</Text>
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
                                    {slotCount > 0 && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="calendar-number-outline" size={13} color={ADMIN_COLORS.textMuted} />
                                            <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary, marginLeft: 4 }}>
                                                {slotCount} booking slot{slotCount === 1 ? '' : 's'}
                                            </Text>
                                        </View>
                                    )}
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
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.successBg, marginRight: 10 }]}
                                        onPress={() => openTicketingEditor(item)}
                                    >
                                        <Ionicons name="ticket-outline" size={14} color={ADMIN_COLORS.success} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.success }]}>Ticketing</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.warningBg, marginRight: 10 }]}
                                        onPress={() => openScheduleEditor(item)}
                                    >
                                        <Ionicons name="calendar-number-outline" size={14} color={ADMIN_COLORS.warning} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.warning }]}>Schedule</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.infoBg, marginRight: 10 }]}
                                        onPress={() => openScorecardEditor(item)}
                                    >
                                        <Ionicons name="clipboard-outline" size={14} color={ADMIN_COLORS.info} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.info }]}>Measure</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.infoBg, marginRight: 10 }]}
                                        onPress={() => onOpenScorecard?.(item.id)}
                                    >
                                        <Ionicons name="analytics-outline" size={14} color={ADMIN_COLORS.info} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.info }]}>Impact</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.dangerBg }]}
                                        onPress={() => handleDelete(item)}
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
