import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput, Image,
    ActivityIndicator, RefreshControl, Alert, Switch, Platform
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
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
    ImageFrameGuide,
    getImageFrameAspectRatio,
    getImagePickerAspect,
} from '../ImageFrameGuide';
import { usePersistentDraft } from '../../hooks/usePersistentDraft';

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
        start_time: toLocalDatetimeValue(start),
        end_time: toLocalDatetimeValue(end),
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

const pad2 = (value) => String(value).padStart(2, '0');

const toLocalDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toLocalDatetimeValue = (date) => `${toLocalDateKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const parseDateKey = (dateKey) => {
    const [year, month, day] = String(dateKey || '').split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day);
};

const formatShortDate = (dateKey) => {
    const date = parseDateKey(dateKey);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatReadableDate = (dateKey) => {
    const date = parseDateKey(dateKey);
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const getDatePart = (value) => {
    if (!value) return toLocalDateKey(new Date());
    const text = String(value);
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? toLocalDateKey(new Date()) : toLocalDateKey(date);
};

const getTimePart = (value, fallback = '09:00') => {
    if (!value) return fallback;
    const text = String(value);
    const match = text.match(/T([^Z+-]*)/);
    if (match) return match[1].slice(0, 5);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const normalizeClockTime = (value, fallback = '09:00') => {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return fallback;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return fallback;
    return `${pad2(hours)}:${pad2(minutes)}`;
};

const combineDateTime = (dateKey, time, fallback = '09:00') => `${dateKey}T${normalizeClockTime(time, fallback)}`;

const combineDateTimeRaw = (dateKey, time) => `${dateKey}T${time}`;

const parseDateTimeValue = (value) => {
    const text = String(value || '');
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})/);
    if (match) {
        return new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
        );
    }
    return new Date(value);
};

const buildMonthCells = (monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let index = 0; index < firstDay; index += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
};

const DateCalendar = ({ selectedDates = [], onDatePress, multi = false }) => {
    const initialDate = parseDateKey(selectedDates[0] || toLocalDateKey(new Date()));
    const [monthDate, setMonthDate] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
    const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);
    const cells = useMemo(() => buildMonthCells(monthDate), [monthDate]);

    const shiftMonth = (delta) => {
        setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    return (
        <View style={{ backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: ADMIN_COLORS.surfaceBorder }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <TouchableOpacity onPress={() => shiftMonth(-1)} style={{ padding: 8 }}>
                    <Ionicons name="chevron-back" size={18} color={ADMIN_COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>
                    {monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={() => shiftMonth(1)} style={{ padding: 8 }}>
                    <Ionicons name="chevron-forward" size={18} color={ADMIN_COLORS.textSecondary} />
                </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row' }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <Text key={`${day}-${index}`} style={{ width: `${100 / 7}%`, textAlign: 'center', color: ADMIN_COLORS.textMuted, fontSize: 11, fontWeight: '800' }}>
                        {day}
                    </Text>
                ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                {cells.map((date, index) => {
                    const dateKey = date ? toLocalDateKey(date) : '';
                    const isSelected = selectedSet.has(dateKey);
                    return (
                        <View key={dateKey || `empty-${index}`} style={{ width: `${100 / 7}%`, padding: 3 }}>
                            {date ? (
                                <TouchableOpacity
                                    onPress={() => onDatePress(dateKey)}
                                    style={{
                                        aspectRatio: 1,
                                        borderRadius: 10,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isSelected ? ADMIN_COLORS.info : ADMIN_COLORS.surface,
                                        borderWidth: 1,
                                        borderColor: isSelected ? ADMIN_COLORS.info : ADMIN_COLORS.surfaceBorder,
                                    }}
                                >
                                    <Text style={{ color: isSelected ? '#fff' : ADMIN_COLORS.textPrimary, fontWeight: isSelected ? '800' : '600' }}>
                                        {date.getDate()}
                                    </Text>
                                    {multi && isSelected && (
                                        <Ionicons name="checkmark-circle" size={12} color="#fff" style={{ position: 'absolute', top: 3, right: 3 }} />
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View style={{ aspectRatio: 1 }} />
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const DateTimeCalendarField = ({ label, value, onChange, fallbackTime = '09:00' }) => {
    const [showCalendar, setShowCalendar] = useState(false);
    const dateKey = getDatePart(value);
    const time = getTimePart(value, fallbackTime);

    const selectDate = (nextDateKey) => {
        onChange(combineDateTime(nextDateKey, time, fallbackTime));
        setShowCalendar(false);
    };

    return (
        <View>
            <Text style={s.inputLabel}>{label}</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TouchableOpacity
                    onPress={() => setShowCalendar(prev => !prev)}
                    style={{
                        flex: 1,
                        minHeight: 48,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        backgroundColor: ADMIN_COLORS.surface,
                        borderWidth: 1,
                        borderColor: ADMIN_COLORS.surfaceBorder,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                >
                    <Ionicons name="calendar-outline" size={18} color={ADMIN_COLORS.info} />
                    <Text style={{ marginLeft: 8, color: ADMIN_COLORS.textPrimary, fontWeight: '700', flexShrink: 1 }}>
                        {formatReadableDate(dateKey)}
                    </Text>
                </TouchableOpacity>
                <TextInput
                    style={[s.textInput, {
                        width: 88,
                        backgroundColor: ADMIN_COLORS.surface,
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        borderWidth: 1,
                        borderColor: ADMIN_COLORS.surfaceBorder,
                        textAlign: 'center',
                    }]}
                    placeholder="09:00"
                    keyboardType="numbers-and-punctuation"
                    value={time}
                    onChangeText={(nextTime) => onChange(combineDateTimeRaw(dateKey, nextTime))}
                    onBlur={() => onChange(combineDateTime(dateKey, time, fallbackTime))}
                />
            </View>
            {showCalendar && (
                <View style={{ marginTop: 8 }}>
                    <DateCalendar selectedDates={[dateKey]} onDatePress={selectDate} />
                </View>
            )}
        </View>
    );
};

const MultiDateSlotPicker = ({ startValue, endValue, onAddSlots }) => {
    const [selectedDates, setSelectedDates] = useState([]);
    const [startTime, setStartTime] = useState(getTimePart(startValue, '09:00'));
    const [endTime, setEndTime] = useState(getTimePart(endValue, '10:00'));
    const [label, setLabel] = useState('Available slot');
    const [capacity, setCapacity] = useState('');
    const [location, setLocation] = useState('');
    const [notes, setNotes] = useState('');

    const toggleDate = (dateKey) => {
        setSelectedDates(prev => (
            prev.includes(dateKey)
                ? prev.filter(item => item !== dateKey)
                : [...prev, dateKey].sort()
        ));
    };

    const addSelectedSlots = () => {
        if (selectedDates.length === 0) {
            Alert.alert('Select dates', 'Choose one or more dates from the calendar.');
            return;
        }

        const normalizedStart = normalizeClockTime(startTime, '09:00');
        const normalizedEnd = normalizeClockTime(endTime, '10:00');
        const baseLabel = label.trim() || 'Available slot';

        const slots = selectedDates.map((dateKey, index) => ({
            id: `slot_${Date.now()}_${index + 1}`,
            label: selectedDates.length > 1 ? `${baseLabel} - ${formatShortDate(dateKey)}` : baseLabel,
            start_time: `${dateKey}T${normalizedStart}`,
            end_time: `${dateKey}T${normalizedEnd}`,
            capacity,
            location,
            notes,
        }));

        if (slots.some(slot => parseDateTimeValue(slot.end_time) <= parseDateTimeValue(slot.start_time))) {
            Alert.alert('Check times', 'The end time should be after the start time for each selected date.');
            return;
        }

        onAddSlots(slots);
        setSelectedDates([]);
    };

    return (
        <View style={{ backgroundColor: ADMIN_COLORS.infoBg, borderRadius: 12, padding: 10, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="calendar-number-outline" size={16} color={ADMIN_COLORS.info} />
                <Text style={{ marginLeft: 6, color: ADMIN_COLORS.textPrimary, fontWeight: '800' }}>
                    Add several booking dates
                </Text>
            </View>
            <DateCalendar selectedDates={selectedDates} onDatePress={toggleDate} multi />
            <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 11, marginTop: 8 }}>
                {selectedDates.length > 0
                    ? `${selectedDates.length} date${selectedDates.length === 1 ? '' : 's'} selected`
                    : 'Tap dates to check them, then add them as booking slots.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                    <Text style={s.inputLabel}>Start</Text>
                    <TextInput
                        style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                        keyboardType="numbers-and-punctuation"
                        value={startTime}
                        onChangeText={setStartTime}
                        onBlur={() => setStartTime(prev => normalizeClockTime(prev, '09:00'))}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.inputLabel}>End</Text>
                    <TextInput
                        style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                        keyboardType="numbers-and-punctuation"
                        value={endTime}
                        onChangeText={setEndTime}
                        onBlur={() => setEndTime(prev => normalizeClockTime(prev, '10:00'))}
                    />
                </View>
            </View>
            <Text style={s.inputLabel}>Slot label</Text>
            <TextInput
                style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                value={label}
                onChangeText={setLabel}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                    <Text style={s.inputLabel}>Capacity</Text>
                    <TextInput
                        style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                        keyboardType="numeric"
                        value={capacity}
                        onChangeText={setCapacity}
                    />
                </View>
                <View style={{ flex: 2 }}>
                    <Text style={s.inputLabel}>Location</Text>
                    <TextInput
                        style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                        value={location}
                        onChangeText={setLocation}
                    />
                </View>
            </View>
            <Text style={s.inputLabel}>Notes</Text>
            <TextInput
                style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, minHeight: 58, textAlignVertical: 'top' }]}
                multiline
                value={notes}
                onChangeText={setNotes}
            />
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.info, alignSelf: 'flex-start', marginTop: 10 }]} onPress={addSelectedSlots}>
                <Ionicons name="add-circle-outline" size={15} color="#fff" />
                <Text style={[s.actionBtnText, { color: '#fff' }]}>Add selected dates</Text>
            </TouchableOpacity>
        </View>
    );
};

const hasAdminEventDraftContent = (draft) => {
    const form = draft?.form || {};
    return (
        Boolean(String(form.title || '').trim()) ||
        Boolean(String(form.description || '').trim()) ||
        Boolean(String(form.location || '').trim()) ||
        Boolean(String(form.poster_url || '').trim()) ||
        String(form.category || 'outreach') !== 'outreach' ||
        String(form.capacity || '0') !== '0' ||
        String(form.ticket_price || '0') !== '0' ||
        Boolean(form.tiered_ticketing) ||
        Boolean(form.schedule_enabled) ||
        (Array.isArray(form.available_slots) && form.available_slots.length > 0) ||
        String(form.scorecard_title || defaultScorecardTitle) !== defaultScorecardTitle ||
        String(form.scorecard_description || defaultScorecardDescription) !== defaultScorecardDescription ||
        draft?.posterFrameRatio !== '16:9'
    );
};

const toDatetimeLocal = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    return toLocalDatetimeValue(date);
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

        const start = parseDateTimeValue(slot.start_time);
        const end = parseDateTimeValue(slot.end_time);
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
    const [createError, setCreateError] = useState('');
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
    const adminEventDraftData = useMemo(() => ({
        form,
        posterFrameRatio,
    }), [form, posterFrameRatio]);

    const restoreAdminEventDraft = useCallback((draft) => {
        if (!hasAdminEventDraftContent(draft)) return;
        setForm({
            ...newEventForm(),
            ...(draft.form || {}),
        });
        setPosterFrameRatio(draft.posterFrameRatio || '16:9');
        setShowCreate(true);
    }, []);

    const { clearDraft: clearAdminEventDraft } = usePersistentDraft({
        key: 'ld360:draft:admin-event-create',
        data: adminEventDraftData,
        restore: restoreAdminEventDraft,
        enabled: showCreate && hasAdminEventDraftContent(adminEventDraftData),
    });

    const uploadPosterIfNeeded = async (uri) => {
        if (!uri || /^https?:\/\//i.test(uri)) return uri;

        const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
        const safeExtension = extension.length <= 5 ? extension : 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExtension}`;
        const filePath = `event-posters/${fileName}`;
        let body;

        if (Platform.OS === 'web') {
            const response = await fetch(uri);
            body = await response.arrayBuffer();
        } else {
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            body = decode(base64);
        }

        const { error } = await supabase.storage
            .from(runtimeConfig.storageBuckets.eventImages)
            .upload(filePath, body, {
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
        setCreateError('');
        if (!form.title.trim()) {
            const message = 'Add an event title.';
            setCreateError(message);
            Alert.alert('Required', message);
            return;
        }
        const start = parseDateTimeValue(form.start_time);
        const end = parseDateTimeValue(form.end_time);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            const message = 'Use valid start and end times, with the end after the start.';
            setCreateError(message);
            Alert.alert('Check dates', message);
            return;
        }
        let availableSlots = [];
        if (form.schedule_enabled) {
            try {
                availableSlots = toSlotPayload(form.available_slots);
            } catch {
                const message = 'Use valid start and end times for every booking slot.';
                setCreateError(message);
                Alert.alert('Check schedule', message);
                return;
            }
            if (availableSlots.length === 0) {
                const message = 'Add at least one available date/time slot, or turn booking schedule off.';
                setCreateError(message);
                Alert.alert('Add dates', message);
                return;
            }
        }
        if (form.tiered_ticketing) {
            if (!form.free_tier_label.trim() || !form.paid_tier_label.trim()) {
                const message = 'Name both the free and paid registration categories.';
                setCreateError(message);
                Alert.alert('Category names required', message);
                return;
            }
            if (Number(form.paid_ticket_price || 0) <= 0) {
                const message = 'Set a paid ticket price greater than zero.';
                setCreateError(message);
                Alert.alert('Paid price required', message);
                return;
            }
            if (!form.attendee_type_question.trim()) {
                const message = 'Add the justification question for the registration categories.';
                setCreateError(message);
                Alert.alert('Question required', message);
                return;
            }
        }

        setCreating(true);
        try {
            let posterUrl = null;
            try {
                posterUrl = await uploadPosterIfNeeded(form.poster_url);
            } catch (uploadError) {
                throw new Error(`Poster upload failed. ${getApiErrorMessage(uploadError, 'Could not upload the event poster.')}`);
            }
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
            const res = await client.post('/events', {
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
            await clearAdminEventDraft();
            setForm(newEventForm());
            setShowCreate(false);
            await fetchEvents(true);
            if (res.data?.pin_error) {
                const warning = `Event created, but it could not be pinned automatically: ${res.data.pin_error}`;
                setCreateError(warning);
                Alert.alert('Created with pin warning', warning);
            } else {
                Alert.alert('Created', 'Event created and pinned by default.');
            }
        } catch (e) {
            console.error('Create event error:', e);
            const message = getApiErrorMessage(e, 'Failed to create event.');
            setCreateError(message);
            Alert.alert('Event not created', message);
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

    const addFormSlots = (slots) => {
        setForm(prev => ({
            ...prev,
            schedule_enabled: true,
            available_slots: [
                ...(prev.available_slots || []),
                ...slots,
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

    const addScheduleSlots = (slots) => {
        setScheduleSlots(prev => [...prev, ...slots]);
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

                    <DateTimeCalendarField
                        label="Start time"
                        value={form.start_time}
                        fallbackTime="09:00"
                        onChange={(value) => setForm(prev => ({ ...prev, start_time: value }))}
                    />
                    <DateTimeCalendarField
                        label="End time"
                        value={form.end_time}
                        fallbackTime="11:00"
                        onChange={(value) => setForm(prev => ({ ...prev, end_time: value }))}
                    />

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
                                <MultiDateSlotPicker
                                    startValue={form.start_time}
                                    endValue={form.end_time}
                                    onAddSlots={addFormSlots}
                                />
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
                                        <DateTimeCalendarField
                                            label="Starts"
                                            value={slot.start_time}
                                            fallbackTime="09:00"
                                            onChange={(value) => updateFormSlot(index, 'start_time', value)}
                                        />
                                        <DateTimeCalendarField
                                            label="Ends"
                                            value={slot.end_time}
                                            fallbackTime="10:00"
                                            onChange={(value) => updateFormSlot(index, 'end_time', value)}
                                        />
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

                    {createError ? (
                        <View style={{ backgroundColor: ADMIN_COLORS.dangerBg, borderColor: ADMIN_COLORS.danger, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12 }}>
                            <Text style={{ color: ADMIN_COLORS.danger, fontWeight: '800', marginBottom: 4 }}>Last create error</Text>
                            <Text selectable style={{ color: ADMIN_COLORS.textPrimary, fontSize: 12, lineHeight: 17 }}>{createError}</Text>
                        </View>
                    ) : null}

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
                        <MultiDateSlotPicker
                            startValue={toDatetimeLocal(scheduleEvent.start_time)}
                            endValue={toDatetimeLocal(scheduleEvent.end_time)}
                            onAddSlots={addScheduleSlots}
                        />
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
                                <DateTimeCalendarField
                                    label="Starts"
                                    value={slot.start_time}
                                    fallbackTime="09:00"
                                    onChange={(value) => updateScheduleSlot(index, 'start_time', value)}
                                />
                                <DateTimeCalendarField
                                    label="Ends"
                                    value={slot.end_time}
                                    fallbackTime="10:00"
                                    onChange={(value) => updateScheduleSlot(index, 'end_time', value)}
                                />
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
