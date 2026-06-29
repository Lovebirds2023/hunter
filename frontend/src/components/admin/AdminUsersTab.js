import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

const ROLE_FILTERS = ['All', 'buyer', 'provider', 'admin', 'super_admin', 'suspended'];
const ROLE_COLORS = {
    admin: ADMIN_COLORS.danger,
    provider: ADMIN_COLORS.chart1,
    buyer: ADMIN_COLORS.success,
    super_admin: ADMIN_COLORS.accent,
    suspended: ADMIN_COLORS.textMuted,
};
const SUSPENSION_OPTIONS = [
    { label: '24h', value: 24, unit: 'hours' },
    { label: '7d', value: 7, unit: 'days' },
    { label: '30d', value: 30, unit: 'days' },
    { label: '12w', value: 12, unit: 'weeks' },
];
const DEFAULT_SUSPENSION = { duration_value: 7, duration_unit: 'days', reason: '' };

export const AdminUsersTab = ({ onBack }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [suspendForms, setSuspendForms] = useState({});

    const fetchUsers = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/users');
            setUsers(res.data);
        } catch (e) {
            console.error('Users fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const filtered = useMemo(() => {
        let result = users;
        if (roleFilter !== 'All') result = result.filter(u => u.role === roleFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(u =>
                u.full_name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.id?.toLowerCase().includes(q) ||
                u.phone_number?.includes(q)
            );
        }
        return result;
    }, [users, search, roleFilter]);

    const getSuspendForm = (userId) => suspendForms[userId] || DEFAULT_SUSPENSION;

    const updateSuspendForm = (userId, patch) => {
        setSuspendForms(prev => ({
            ...prev,
            [userId]: { ...DEFAULT_SUSPENSION, ...(prev[userId] || {}), ...patch },
        }));
    };

    const handleSuspend = (user) => {
        const form = getSuspendForm(user.id);
        const reason = (form.reason || '').trim();
        if (!reason) {
            Alert.alert('Reason required', 'Add a short reason before suspending this user.');
            return;
        }

        Alert.alert('Suspend User', `Suspend "${user.full_name || user.email}" for ${form.duration_value} ${form.duration_unit}? They will not be able to access the platform during this period.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Suspend', style: 'destructive', onPress: async () => {
                    try {
                        const res = await client.post(`/admin/users/${user.id}/suspend`, {
                            duration_value: form.duration_value,
                            duration_unit: form.duration_unit,
                            reason,
                        });
                        Alert.alert('Done', res.data?.message || `${user.full_name || user.email} has been suspended.`);
                        fetchUsers(true);
                    } catch (e) {
                        Alert.alert('Error', e.response?.data?.detail || 'Failed to suspend user');
                    }
                }
            }
        ]);
    };

    const handleUnsuspend = (user) => {
        Alert.alert('Restore User', `Lift the suspension for "${user.full_name || user.email}" now?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Restore', onPress: async () => {
                    try {
                        const res = await client.post(`/admin/users/${user.id}/unsuspend`);
                        Alert.alert('Done', res.data?.message || 'User restored.');
                        fetchUsers(true);
                    } catch (e) {
                        Alert.alert('Error', e.response?.data?.detail || 'Failed to restore user');
                    }
                }
            }
        ]);
    };

    const roleCounts = {};
    users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1; });

    return (
        <View style={s.screen}>
            {/* Sticky Header */}
            <View style={{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: ADMIN_COLORS.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 14 }}>
                        <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>User Management</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{users.length} total users</Text>
                    </View>
                </View>

                {/* Search */}
                <View style={s.searchContainer}>
                    <Ionicons name="search" size={18} color={ADMIN_COLORS.textMuted} />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Search by name, email, or phone..."
                        placeholderTextColor={ADMIN_COLORS.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={18} color={ADMIN_COLORS.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={s.filterRow}>
                        {ROLE_FILTERS.map(role => (
                            <TouchableOpacity
                                key={role}
                                style={[s.filterChip, roleFilter === role && s.filterChipActive]}
                                onPress={() => setRoleFilter(role)}
                            >
                                <Text style={[s.filterChipText, roleFilter === role && s.filterChipTextActive]}>
                                    {role === 'All' ? `All (${users.length})` : `${role} (${roleCounts[role] || 0})`}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {loading ? (
                <View style={s.loadingContainer}><ActivityIndicator size="large" color={ADMIN_COLORS.accent} /></View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                    keyboardShouldPersistTaps="handled"
                    removeClippedSubviews={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(true); }} tintColor={ADMIN_COLORS.accent} />}
                    ListEmptyComponent={
                        <View style={s.emptyContainer}>
                            <Ionicons name="people-outline" size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>No users found</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={s.listCard}>
                            <View style={s.listCardHeader}>
                                <View style={[s.avatar, { backgroundColor: ROLE_COLORS[item.role] || ADMIN_COLORS.chart1 }]}>
                                    <Text style={s.avatarText}>{item.full_name?.charAt(0)?.toUpperCase() || '?'}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={s.listCardTitle}>{item.full_name || 'Unknown'}</Text>
                                    <Text style={s.listCardSub}>{item.email}</Text>
                                </View>
                                <View style={[s.badge, { backgroundColor: ROLE_COLORS[item.role] || ADMIN_COLORS.chart1 }]}>
                                    <Text style={s.badgeText}>{item.role}</Text>
                                </View>
                            </View>
                            {item.phone_number && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                    <Ionicons name="call-outline" size={13} color={ADMIN_COLORS.textMuted} />
                                    <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary, marginLeft: 6 }}>{item.phone_number}</Text>
                                </View>
                            )}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                                <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>Dogs: {item.dog_count || 0}</Text>
                                <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>Listings: {item.listing_count || 0}</Text>
                                <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>Orders: {item.order_count || 0}</Text>
                                <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>Paid: {item.paid_order_count || 0}</Text>
                            </View>
                            {item.created_at && (
                                <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, marginTop: 6 }}>
                                    Joined {new Date(item.created_at).toLocaleDateString()}
                                </Text>
                            )}
                            {item.is_suspended && (
                                <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: ADMIN_COLORS.dangerBg }}>
                                    <Text style={{ fontSize: 12, color: ADMIN_COLORS.danger, fontWeight: '700' }}>
                                        Suspended until {item.suspension_ends_at ? new Date(item.suspension_ends_at).toLocaleString() : 'admin review'}
                                    </Text>
                                    {!!item.suspension_reason && (
                                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary, marginTop: 4 }}>
                                            Reason: {item.suspension_reason}
                                        </Text>
                                    )}
                                </View>
                            )}
                            {!['admin', 'super_admin', 'suspended'].includes(item.role) && (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, fontWeight: '700', marginBottom: 8 }}>
                                        Suspension length
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                        {SUSPENSION_OPTIONS.map(option => {
                                            const form = getSuspendForm(item.id);
                                            const active = form.duration_value === option.value && form.duration_unit === option.unit;
                                            return (
                                                <TouchableOpacity
                                                    key={`${option.value}-${option.unit}`}
                                                    style={[s.filterChip, active && s.filterChipActive, { paddingVertical: 6 }]}
                                                    onPress={() => updateSuspendForm(item.id, {
                                                        duration_value: option.value,
                                                        duration_unit: option.unit,
                                                    })}
                                                >
                                                    <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{option.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    <TextInput
                                        style={[s.textInput, {
                                            height: 42,
                                            borderWidth: 1,
                                            borderColor: ADMIN_COLORS.surfaceBorder,
                                            borderRadius: 10,
                                            paddingHorizontal: 12,
                                            backgroundColor: ADMIN_COLORS.surfaceLight,
                                        }]}
                                        placeholder="Reason for suspension..."
                                        placeholderTextColor={ADMIN_COLORS.textMuted}
                                        value={getSuspendForm(item.id).reason}
                                        onChangeText={(reason) => updateSuspendForm(item.id, { reason })}
                                    />
                                </View>
                            )}
                            {!['admin', 'super_admin'].includes(item.role) && (
                                <View style={s.actionRow}>
                                    {item.role === 'suspended' ? (
                                        <TouchableOpacity
                                            style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.successBg }]}
                                            onPress={() => handleUnsuspend(item)}
                                        >
                                            <Ionicons name="checkmark-circle-outline" size={14} color={ADMIN_COLORS.success} />
                                            <Text style={[s.actionBtnText, { color: ADMIN_COLORS.success }]}>Restore</Text>
                                        </TouchableOpacity>
                                    ) : (
                                    <TouchableOpacity 
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.dangerBg }]}
                                        onPress={() => handleSuspend(item)}
                                    >
                                        <Ionicons name="ban-outline" size={14} color={ADMIN_COLORS.danger} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.danger }]}>Suspend</Text>
                                    </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                />
            )}
        </View>
    );
};
