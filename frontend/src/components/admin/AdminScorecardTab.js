import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { encode as encodeBase64 } from 'base64-arraybuffer';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

const EVIDENCE_TYPES = [
    'photo',
    'attendance_sheet',
    'screenshot',
    'audio_link',
    'podcast_analytics',
    'testimonial',
];

const REPORTING_LABELS = {
    community_members_engaged: 'Community members engaged',
    trainings_story_labs_conducted: 'Programme sessions conducted',
    animals_indirectly_benefiting: 'Animals indirectly benefiting',
    materials_tools_produced: 'Materials/tools produced',
    human_wellbeing_outcome_notes: 'Human wellbeing outcome notes',
    animal_welfare_outcome_notes: 'Animal welfare outcome notes',
    environmental_benefit_notes: 'Environmental benefit notes',
    social_cohesion_notes: 'Social cohesion notes',
    evidence_links_or_uploaded_files: 'Evidence links or uploaded files',
};

const numberFields = new Set([
    'community_members_engaged',
    'trainings_story_labs_conducted',
    'animals_indirectly_benefiting',
]);

const safeExportSlug = (value) => {
    const slug = String(value || 'impact')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
    return slug || 'impact';
};

const MetricCard = ({ label, value, color = ADMIN_COLORS.info }) => (
    <View style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 12, marginBottom: 4 }]}>
        <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Text>
        <Text style={{ fontSize: 10, color: ADMIN_COLORS.textMuted, textAlign: 'center' }}>{label}</Text>
    </View>
);

const Breakdown = ({ title, data }) => {
    const rows = Object.entries(data || {});
    if (!rows.length) return null;
    const total = rows.reduce((sum, [, value]) => sum + Number(value || 0), 0) || 1;
    return (
        <View style={[s.card, { marginTop: 12 }]}>
            <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800', marginBottom: 10 }}>{title}</Text>
            {rows.map(([label, value]) => (
                <View key={label} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: ADMIN_COLORS.textSecondary, fontSize: 12 }}>{label}</Text>
                        <Text style={{ color: ADMIN_COLORS.textPrimary, fontSize: 12, fontWeight: '700' }}>{value}</Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: ADMIN_COLORS.surfaceBorder, overflow: 'hidden' }}>
                        <View style={{ height: 6, width: `${Math.round((Number(value || 0) / total) * 100)}%`, backgroundColor: ADMIN_COLORS.accent }} />
                    </View>
                </View>
            ))}
        </View>
    );
};

export const AdminScorecardTab = ({ onBack, initialEventId = null }) => {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(initialEventId);
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [evidence, setEvidence] = useState({ evidence_type: 'photo', url: '', notes: '' });
    const [reporting, setReporting] = useState({});

    const fetchEvents = useCallback(async () => {
        const res = await client.get('/admin/scorecard/events');
        const eventRows = res.data || [];
        setEvents(eventRows);
        if (!selectedEventId && eventRows.length > 0) {
            setSelectedEventId(eventRows[0].id);
        }
        return eventRows;
    }, [selectedEventId]);

    const fetchDashboard = useCallback(async (eventId) => {
        if (!eventId) return null;
        const res = await client.get(`/admin/scorecard/${eventId}/dashboard`);
        setDashboard(res.data);
        setReporting(res.data.reporting_fields || {});
        return res.data;
    }, []);

    const refreshAll = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const eventRows = await fetchEvents();
            const eventId = selectedEventId || eventRows[0]?.id;
            if (eventId) await fetchDashboard(eventId);
        } catch (error) {
            console.error('Impact fetch error:', error);
            Alert.alert('Error', 'Could not load impact data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fetchDashboard, fetchEvents, selectedEventId]);

    useEffect(() => { refreshAll(); }, []);

    useEffect(() => {
        if (initialEventId && initialEventId !== selectedEventId) {
            setSelectedEventId(initialEventId);
        }
    }, [initialEventId, selectedEventId]);

    useEffect(() => {
        if (selectedEventId) fetchDashboard(selectedEventId).catch(() => {});
    }, [selectedEventId, fetchDashboard]);

    const selectedEvent = events.find(event => event.id === selectedEventId);

    const promptFollowup = async () => {
        if (!selectedEventId) return;
        setSaving(true);
        try {
            const res = await client.post(`/admin/scorecard/${selectedEventId}/prompt-followup`);
            Alert.alert('Follow-up prompted', `${res.data.notified_registrants || 0} registered user(s) notified.`);
            await fetchDashboard(selectedEventId);
        } catch (error) {
            Alert.alert('Error', 'Could not prompt follow-up.');
        } finally {
            setSaving(false);
        }
    };

    const addEvidence = async () => {
        if (!selectedEventId || !evidence.url.trim()) {
            Alert.alert('Required', 'Add an evidence link or file URL.');
            return;
        }
        setSaving(true);
        try {
            await client.post(`/admin/scorecard/${selectedEventId}/evidence`, evidence);
            setEvidence({ evidence_type: evidence.evidence_type, url: '', notes: '' });
            await fetchDashboard(selectedEventId);
            Alert.alert('Saved', 'Evidence added.');
        } catch (error) {
            Alert.alert('Error', 'Could not save evidence.');
        } finally {
            setSaving(false);
        }
    };

    const saveReporting = async () => {
        if (!selectedEventId) return;
        setSaving(true);
        try {
            const payload = Object.keys(REPORTING_LABELS).reduce((acc, key) => {
                acc[key] = numberFields.has(key) ? Number(reporting[key] || 0) : (reporting[key] || '');
                return acc;
            }, {});
            await client.post(`/admin/scorecard/${selectedEventId}/reporting`, payload);
            await fetchDashboard(selectedEventId);
            Alert.alert('Saved', 'Reporting fields updated.');
        } catch (error) {
            Alert.alert('Error', 'Could not save reporting fields.');
        } finally {
            setSaving(false);
        }
    };

    const exportScorecard = async () => {
        if (!selectedEventId) return;
        setExporting(true);
        try {
            const response = await client.get('/admin/export', {
                params: { type: 'scorecard', event_id: selectedEventId },
                responseType: 'arraybuffer',
            });
            const exportName = safeExportSlug(selectedEvent?.scorecard_title || selectedEvent?.title || 'impact');
            const fileName = `${exportName}_impact_${new Date().toISOString().split('T')[0]}.csv`;

            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const blob = new Blob([response.data], {
                    type: 'text/csv;charset=utf-8',
                });
                const blobUrl = window.URL.createObjectURL(blob);
                const link = window.document.createElement('a');
                link.href = blobUrl;
                link.download = fileName;
                window.document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
                return;
            }

            const fileRoot = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            const fileUri = `${fileRoot}${fileName}`;
            await FileSystem.writeAsStringAsync(fileUri, encodeBase64(response.data), {
                encoding: FileSystem.EncodingType.Base64,
            });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert('Export ready', `File saved to ${fileUri}`);
            }
        } catch (error) {
            Alert.alert('Export failed', 'Could not generate the partner-ready impact export.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <View style={s.screen}>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: ADMIN_COLORS.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 14 }}>
                        <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>Community Impact Engine</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>M&E, outcomes, evidence, and partner reporting</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={s.loadingContainer}><ActivityIndicator size="large" color={ADMIN_COLORS.accent} /></View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refreshAll(true); }} />}
                >
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
                        {events.map(event => (
                            <TouchableOpacity
                                key={event.id}
                                style={[s.filterChip, selectedEventId === event.id && s.filterChipActive]}
                                onPress={() => setSelectedEventId(event.id)}
                            >
                                <Text style={[s.filterChipText, selectedEventId === event.id && s.filterChipTextActive]}>
                                    {event.title}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {!selectedEvent || !dashboard ? (
                        <View style={s.emptyContainer}>
                            <Ionicons name="clipboard-outline" size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>Create an event to start collecting impact data.</Text>
                        </View>
                    ) : (
                        <>
                            <View style={[s.card, { marginTop: 4 }]}>
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800', fontSize: 16 }}>
                                    {selectedEvent.scorecard_title || 'Community Impact Assessment'}
                                </Text>
                                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
                                    {selectedEvent.title} | {selectedEvent.location || 'Location TBD'}
                                </Text>
                                {!!selectedEvent.scorecard_description && (
                                    <Text style={{ color: ADMIN_COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                                        {selectedEvent.scorecard_description}
                                    </Text>
                                )}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.infoBg }]} onPress={promptFollowup} disabled={saving}>
                                        <Ionicons name="notifications-outline" size={14} color={ADMIN_COLORS.info} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.info }]}>Prompt follow-up</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.successBg }]} onPress={exportScorecard} disabled={exporting}>
                                        {exporting ? <ActivityIndicator size="small" color={ADMIN_COLORS.success} /> : <Ionicons name="download-outline" size={14} color={ADMIN_COLORS.success} />}
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.success }]}>Partner export</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <MetricCard label="Participants" value={dashboard.total_participants || 0} color={ADMIN_COLORS.info} />
                                <MetricCard label="Baseline" value={dashboard.baseline_surveys_completed || 0} color={ADMIN_COLORS.chart2} />
                                <MetricCard label="Follow-up" value={dashboard.followup_surveys_completed || 0} color={ADMIN_COLORS.chart3} />
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                <MetricCard label="Avg Index" value={`${dashboard.average_coexistence_index || 0}%`} color={ADMIN_COLORS.accent} />
                                <MetricCard label="Outcome Change" value={`${dashboard.average_change_from_baseline_to_followup || 0} pts`} color={ADMIN_COLORS.success} />
                            </View>

                            <Breakdown title="County reach" data={dashboard.participants_by_county} />
                            <Breakdown title="Community reach" data={dashboard.participants_by_community} />
                            <Breakdown title="Participant groups" data={dashboard.participants_by_user_type} />
                            <Breakdown title="Programme types" data={dashboard.participation_type_counts} />
                            <Breakdown title="Outcome category averages" data={dashboard.category_averages} />

                            <View style={[s.card, { marginTop: 12 }]}>
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800', marginBottom: 10 }}>Evidence bank</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
                                    {EVIDENCE_TYPES.map(type => (
                                        <TouchableOpacity
                                            key={type}
                                            style={[s.filterChip, evidence.evidence_type === type && s.filterChipActive]}
                                            onPress={() => setEvidence(prev => ({ ...prev, evidence_type: type }))}
                                        >
                                            <Text style={[s.filterChipText, evidence.evidence_type === type && s.filterChipTextActive]}>
                                                {type.replace(/_/g, ' ')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TextInput
                                    style={[s.textInput, { backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12 }]}
                                    placeholder="Evidence URL or uploaded file link"
                                    value={evidence.url}
                                    onChangeText={(url) => setEvidence(prev => ({ ...prev, url }))}
                                />
                                <TextInput
                                    style={[s.textInput, { height: 72, backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 12, marginTop: 8, textAlignVertical: 'top' }]}
                                    placeholder="Notes"
                                    multiline
                                    value={evidence.notes}
                                    onChangeText={(notes) => setEvidence(prev => ({ ...prev, notes }))}
                                />
                                <TouchableOpacity style={s.primaryButton} onPress={addEvidence} disabled={saving}>
                                    <Ionicons name="add-circle-outline" size={18} color={ADMIN_COLORS.bg} />
                                    <Text style={s.primaryButtonText}>Add evidence</Text>
                                </TouchableOpacity>
                                {(dashboard.evidence || []).map(item => (
                                    <Text key={item.id} style={{ color: ADMIN_COLORS.textSecondary, fontSize: 12, marginTop: 8 }}>
                                        {item.evidence_type.replace(/_/g, ' ')}: {item.url}
                                    </Text>
                                ))}
                            </View>

                            <View style={[s.card, { marginTop: 12 }]}>
                                <Text style={{ color: ADMIN_COLORS.textPrimary, fontWeight: '800', marginBottom: 4 }}>Partner reporting</Text>
                                {Object.entries(REPORTING_LABELS).map(([key, label]) => (
                                    <View key={key}>
                                        <Text style={s.inputLabel}>{label}</Text>
                                        <TextInput
                                            style={[s.textInput, {
                                                minHeight: numberFields.has(key) ? 48 : 76,
                                                backgroundColor: ADMIN_COLORS.surfaceLight,
                                                borderRadius: 10,
                                                paddingHorizontal: 12,
                                                textAlignVertical: 'top',
                                            }]}
                                            multiline={!numberFields.has(key)}
                                            keyboardType={numberFields.has(key) ? 'numeric' : 'default'}
                                            value={String(reporting[key] ?? '')}
                                            onChangeText={(value) => setReporting(prev => ({ ...prev, [key]: value }))}
                                        />
                                    </View>
                                ))}
                                <TouchableOpacity style={s.primaryButton} onPress={saveReporting} disabled={saving}>
                                    <Ionicons name="save-outline" size={18} color={ADMIN_COLORS.bg} />
                                    <Text style={s.primaryButtonText}>Save partner report fields</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </ScrollView>
            )}
        </View>
    );
};
