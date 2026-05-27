import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

const ROLE_FILTERS = ['All', 'buyer', 'provider', 'admin'];
const ROLE_COLORS = {
    admin: ADMIN_COLORS.danger,
    provider: ADMIN_COLORS.chart1,
    buyer: ADMIN_COLORS.success,
    super_admin: ADMIN_COLORS.accent,
};

export const AdminUsersTab = ({ onBack }) => {
    const [users, setUsers] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');

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

    useEffect(() => {
        let result = users;
        if (roleFilter !== 'All') result = result.filter(u => u.role === roleFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(u =>
                u.full_name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.phone_number?.includes(q)
            );
        }
        setFiltered(result);
    }, [users, search, roleFilter]);

    const handleSuspend = (userId, name) => {
        Alert.alert('Suspend User', `Suspend "${name}"? They will not be able to access the platform.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Suspend', style: 'destructive', onPress: async () => {
                    try {
                        await client.post(`/admin/users/${userId}/suspend`);
                        Alert.alert('Done', `${name} has been suspended.`);
                        fetchUsers(true);
                    } catch (e) {
                        Alert.alert('Error', 'Failed to suspend user');
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
                            {item.role !== 'admin' && (
                                <View style={s.actionRow}>
                                    <TouchableOpacity 
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.dangerBg }]}
                                        onPress={() => handleSuspend(item.id, item.full_name)}
                                    >
                                        <Ionicons name="ban-outline" size={14} color={ADMIN_COLORS.danger} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.danger }]}>Suspend</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}
                />
            )}
        </View>
    );
};
