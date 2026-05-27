import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

export const AdminApprovalsTab = ({ onBack }) => {
    const [pending, setPending] = useState({ services: [], reports: [] });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSection, setActiveSection] = useState('services'); // 'services' or 'reports'
    const [rejectionReason, setRejectionReason] = useState('');
    const [actioningId, setActioningId] = useState(null);

    const fetchPending = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/pending-approvals');
            setPending({
                services: res.data.pending_services || [],
                reports: res.data.pending_reports || []
            });
        } catch (e) {
            console.error('Pending approvals fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchPending(); }, [fetchPending]);

    const handleAction = async (itemType, itemId, isApproved) => {
        if (!isApproved && !rejectionReason.trim()) {
            Alert.alert('Required', 'Please provide a reason for rejection.');
            return;
        }

        setActioningId(itemId);
        try {
            await client.post(`/admin/approve/${itemType}/${itemId}`, {
                is_approved: isApproved,
                rejection_reason: isApproved ? null : rejectionReason
            });
            Alert.alert('Success', `Item ${isApproved ? 'Approved' : 'Rejected'} successfully.`);
            setRejectionReason('');
            fetchPending(true);
        } catch (e) {
            Alert.alert('Error', `Failed to ${isApproved ? 'approve' : 'reject'} item.`);
        } finally {
            setActioningId(null);
        }
    };

    const renderServiceItem = ({ item }) => (
        <View style={s.listCard}>
            <View style={s.listCardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={s.listCardTitle}>{item.title}</Text>
                    <Text style={s.listCardSub}>Provider: {item.provider_name} • KES {item.price}</Text>
                    <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, marginTop: 4 }}>Category: {item.category} • Type: {item.item_type}</Text>
                </View>
            </View>
            <Text style={{ color: ADMIN_COLORS.textSecondary, marginTop: 10, fontSize: 13 }}>{item.description}</Text>
            
            <View style={{ marginTop: 15 }}>
                <TextInput
                    style={[s.textInput, { height: 40, fontSize: 12, backgroundColor: 'rgba(0,0,0,0.03)' }]}
                    placeholder="Reason for rejection (if applicable)..."
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    value={actioningId === item.id ? rejectionReason : ''}
                    onChangeText={setRejectionReason}
                    onFocus={() => setActioningId(item.id)}
                />
            </View>

            <View style={[s.actionRow, { marginTop: 12 }]}>
                <TouchableOpacity 
                    style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.successBg, flex: 1 }]}
                    onPress={() => handleAction('service', item.id, true)}
                    disabled={actioningId === item.id && loading}
                >
                    <Ionicons name="checkmark-circle-outline" size={16} color={ADMIN_COLORS.success} />
                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.success }]}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.dangerBg, flex: 1 }]}
                    onPress={() => handleAction('service', item.id, false)}
                >
                    <Ionicons name="close-circle-outline" size={16} color={ADMIN_COLORS.danger} />
                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.danger }]}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderReportItem = ({ item }) => (
        <View style={s.listCard}>
            <View style={s.listCardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={s.listCardTitle}>{item.title}</Text>
                    <Text style={s.listCardSub}>Author: {item.author_name} • {item.case_type}</Text>
                    <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, marginTop: 4 }}>Location: {item.location} • {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
            </View>
            <Text style={{ color: ADMIN_COLORS.textSecondary, marginTop: 10, fontSize: 13 }}>{item.description}</Text>
            
            <View style={[s.actionRow, { marginTop: 12 }]}>
                <TouchableOpacity 
                    style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.successBg, flex: 1 }]}
                    onPress={() => handleAction('report', item.id, true)}
                >
                    <Ionicons name="checkmark-circle-outline" size={16} color={ADMIN_COLORS.success} />
                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.success }]}>Approve Post</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.dangerBg, flex: 1 }]}
                    onPress={() => handleAction('report', item.id, false)}
                >
                    <Ionicons name="trash-outline" size={16} color={ADMIN_COLORS.danger} />
                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.danger }]}>Discard</Text>
                </TouchableOpacity>
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
                        <Text style={s.sectionTitle}>Content Approvals</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                            {pending.services.length + pending.reports.length} pending items
                        </Text>
                    </View>
                </View>

                {/* Section Toggle */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                    <TouchableOpacity 
                        style={[s.filterChip, activeSection === 'services' && s.filterChipActive, { flex: 1, alignItems: 'center' }]}
                        onPress={() => setActiveSection('services')}
                    >
                        <Text style={[s.filterChipText, activeSection === 'services' && s.filterChipTextActive]}>
                            Marketplace ({pending.services.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[s.filterChip, activeSection === 'reports' && s.filterChipActive, { flex: 1, alignItems: 'center' }]}
                        onPress={() => setActiveSection('reports')}
                    >
                        <Text style={[s.filterChipText, activeSection === 'reports' && s.filterChipTextActive]}>
                            Case Reports ({pending.reports.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={s.loadingContainer}><ActivityIndicator size="large" color={ADMIN_COLORS.accent} /></View>
            ) : (
                <FlatList
                    data={activeSection === 'services' ? pending.services : pending.reports}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPending(true); }} tintColor={ADMIN_COLORS.accent} />}
                    ListEmptyComponent={
                        <View style={s.emptyContainer}>
                            <Ionicons name="checkmark-done-circle-outline" size={48} color={ADMIN_COLORS.success} />
                            <Text style={s.emptyText}>All caught up! No pending {activeSection}.</Text>
                        </View>
                    }
                    renderItem={activeSection === 'services' ? renderServiceItem : renderReportItem}
                />
            )}
        </View>
    );
};
