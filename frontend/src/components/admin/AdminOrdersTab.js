import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

const STATUS_FILTERS = ['All', 'pending', 'paid', 'completed', 'settled', 'cancelled'];
const STATUS_COLORS = {
    pending: ADMIN_COLORS.warning, PENDING: ADMIN_COLORS.warning,
    paid: ADMIN_COLORS.success, PAID: ADMIN_COLORS.success,
    completed: ADMIN_COLORS.chart1, COMPLETED: ADMIN_COLORS.chart1,
    settled: ADMIN_COLORS.chart5, SETTLED: ADMIN_COLORS.chart5,
    cancelled: ADMIN_COLORS.danger, CANCELLED: ADMIN_COLORS.danger,
};

export const AdminOrdersTab = ({ onBack }) => {
    const [orders, setOrders] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [actioningId, setActioningId] = useState(null);

    const fetchOrders = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/orders');
            setOrders(res.data);
        } catch (e) {
            console.error('Orders fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    useEffect(() => {
        let result = orders;
        if (statusFilter !== 'All') {
            result = result.filter(o =>
                o.status?.toLowerCase() === statusFilter.toLowerCase()
            );
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(o =>
                o.buyer_name?.toLowerCase().includes(q) ||
                o.provider_name?.toLowerCase().includes(q) ||
                o.service_title?.toLowerCase().includes(q)
            );
        }
        setFiltered(result);
    }, [orders, search, statusFilter]);

    const totalRevenue = filtered.reduce((sum, o) => sum + (o.amount || 0), 0);
    const totalCommission = filtered.reduce((sum, o) => sum + (o.commission || 0), 0);
    const totalPayout = filtered.reduce((sum, o) => sum + (o.payout || 0), 0);

    const handleCompleteOrder = async (orderId) => {
        Alert.alert(
            'Confirm Delivery',
            'Mark this order as completed (service delivered)? This will enable payout approval.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Delivery',
                    onPress: async () => {
                        setActioningId(orderId);
                        try {
                            await client.post(`/admin/orders/${orderId}/complete`);
                            Alert.alert('✅ Success', 'Order marked as completed. You can now approve the seller payout.');
                            fetchOrders(true);
                        } catch (e) {
                            const msg = e.response?.data?.detail || 'Failed to complete order.';
                            Alert.alert('Error', msg);
                        } finally {
                            setActioningId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleSettleOrder = async (order) => {
        Alert.alert(
            'Approve Seller Payout',
            `Release KES ${(order.payout || 0).toLocaleString()} to ${order.provider_name || 'seller'}?\n\nService: ${order.service_title}\nPlatform Commission: KES ${(order.commission || 0).toLocaleString()}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve Payout',
                    style: 'default',
                    onPress: async () => {
                        setActioningId(order.id);
                        try {
                            const res = await client.post(`/admin/orders/${order.id}/settle`);
                            Alert.alert('💰 Payout Approved', res.data.message);
                            fetchOrders(true);
                        } catch (e) {
                            const msg = e.response?.data?.detail || 'Failed to settle order.';
                            Alert.alert('Error', msg);
                        } finally {
                            setActioningId(null);
                        }
                    }
                }
            ]
        );
    };

    const getStatusLabel = (status) => {
        const s = (status || '').toLowerCase();
        switch (s) {
            case 'pending': return 'Awaiting Payment';
            case 'paid': return 'Paid — Awaiting Delivery';
            case 'completed': return 'Delivered — Payout Pending';
            case 'settled': return 'Settled ✓';
            case 'cancelled': return 'Cancelled';
            default: return status;
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
                        <Text style={s.sectionTitle}>Order Tracking & Payouts</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{orders.length} total orders</Text>
                    </View>
                </View>

                {/* Financials summary */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                    <View style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 10, marginBottom: 4 }]}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: ADMIN_COLORS.success }}>KES {totalRevenue.toLocaleString()}</Text>
                        <Text style={{ fontSize: 9, color: ADMIN_COLORS.textMuted }}>Revenue</Text>
                    </View>
                    <View style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 10, marginBottom: 4 }]}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: ADMIN_COLORS.accent }}>KES {totalCommission.toLocaleString()}</Text>
                        <Text style={{ fontSize: 9, color: ADMIN_COLORS.textMuted }}>Commission</Text>
                    </View>
                    <View style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 10, marginBottom: 4 }]}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: ADMIN_COLORS.chart5 }}>KES {totalPayout.toLocaleString()}</Text>
                        <Text style={{ fontSize: 9, color: ADMIN_COLORS.textMuted }}>Seller Payouts</Text>
                    </View>
                </View>

                {/* Search */}
                <View style={s.searchContainer}>
                    <Ionicons name="search" size={18} color={ADMIN_COLORS.textMuted} />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Search buyer, seller, or service..."
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

                {/* Status Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={s.filterRow}>
                        {STATUS_FILTERS.map(st => (
                            <TouchableOpacity
                                key={st}
                                style={[s.filterChip, statusFilter === st && s.filterChipActive]}
                                onPress={() => setStatusFilter(st)}
                            >
                                <Text style={[s.filterChipText, statusFilter === st && s.filterChipTextActive]}>
                                    {st === 'All' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}
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
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(true); }} tintColor={ADMIN_COLORS.accent} />}
                    ListEmptyComponent={
                        <View style={s.emptyContainer}>
                            <Ionicons name="cart-outline" size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>No orders found</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const statusColor = STATUS_COLORS[item.status] || ADMIN_COLORS.textMuted;
                        const statusLower = (item.status || '').toLowerCase();
                        const isActioning = actioningId === item.id;

                        return (
                            <View style={s.listCard}>
                                {/* Header: Service Title & Status */}
                                <View style={s.listCardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.listCardTitle}>{item.service_title}</Text>
                                        <Text style={s.listCardSub}>Buyer: {item.buyer_name}</Text>
                                        <Text style={[s.listCardSub, { color: ADMIN_COLORS.chart5 }]}>
                                            Seller: {item.provider_name || 'Unknown'}
                                        </Text>
                                    </View>
                                    <View style={[s.badge, { backgroundColor: `${statusColor}20` }]}>
                                        <Text style={[s.badgeText, { color: statusColor }]}>
                                            {getStatusLabel(item.status)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Financial Breakdown */}
                                <View style={s.financialRow}>
                                    <View style={s.financialItem}>
                                        <Text style={s.financialLabel}>Total Paid</Text>
                                        <Text style={s.financialValue}>KES {item.amount}</Text>
                                    </View>
                                    <View style={s.financialItem}>
                                        <Text style={s.financialLabel}>Commission (23.5%)</Text>
                                        <Text style={[s.financialValue, { color: ADMIN_COLORS.accent }]}>KES {item.commission}</Text>
                                    </View>
                                    <View style={s.financialItem}>
                                        <Text style={s.financialLabel}>Seller Payout</Text>
                                        <Text style={[s.financialValue, { color: ADMIN_COLORS.success }]}>KES {item.payout}</Text>
                                    </View>
                                </View>

                                {/* Form Responses Button */}
                                {(item.form_responses?.length > 0) && (
                                    <TouchableOpacity
                                        style={[s.actionBtn, { marginTop: 10, alignSelf: 'flex-start' }]}
                                        onPress={() => {
                                            const summary = item.form_responses.map(r => `${r.label}: ${r.answer}`).join('\n');
                                            Alert.alert('Registration Responses', summary);
                                        }}
                                    >
                                        <Ionicons name="document-text-outline" size={14} color={ADMIN_COLORS.chart5} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.chart5 }]}>Responses</Text>
                                    </TouchableOpacity>
                                )}

                                {/* === ACTION BUTTONS === */}
                                {/* Step 1: Paid → Completed (Confirm Delivery) */}
                                {statusLower === 'paid' && (
                                    <View style={{ marginTop: 12 }}>
                                        <TouchableOpacity
                                            style={[s.actionBtn, {
                                                backgroundColor: `${ADMIN_COLORS.chart1}15`,
                                                flex: 1,
                                                paddingVertical: 10,
                                                justifyContent: 'center',
                                                borderWidth: 1,
                                                borderColor: `${ADMIN_COLORS.chart1}40`,
                                            }]}
                                            onPress={() => handleCompleteOrder(item.id)}
                                            disabled={isActioning}
                                        >
                                            {isActioning ? (
                                                <ActivityIndicator size="small" color={ADMIN_COLORS.chart1} />
                                            ) : (
                                                <>
                                                    <Ionicons name="checkmark-done-outline" size={16} color={ADMIN_COLORS.chart1} />
                                                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.chart1, fontWeight: '700' }]}>
                                                        Confirm Delivery
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Step 2: Completed → Settled (Approve Payout) */}
                                {statusLower === 'completed' && (
                                    <View style={{ marginTop: 12 }}>
                                        <TouchableOpacity
                                            style={[s.actionBtn, {
                                                backgroundColor: `${ADMIN_COLORS.success}15`,
                                                flex: 1,
                                                paddingVertical: 10,
                                                justifyContent: 'center',
                                                borderWidth: 1,
                                                borderColor: `${ADMIN_COLORS.success}40`,
                                            }]}
                                            onPress={() => handleSettleOrder(item)}
                                            disabled={isActioning}
                                        >
                                            {isActioning ? (
                                                <ActivityIndicator size="small" color={ADMIN_COLORS.success} />
                                            ) : (
                                                <>
                                                    <Ionicons name="wallet-outline" size={16} color={ADMIN_COLORS.success} />
                                                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.success, fontWeight: '700' }]}>
                                                        Approve Payout — KES {(item.payout || 0).toLocaleString()}
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Settled confirmation */}
                                {statusLower === 'settled' && (
                                    <View style={{
                                        marginTop: 12, flexDirection: 'row', alignItems: 'center',
                                        backgroundColor: `${ADMIN_COLORS.chart5}10`, padding: 10, borderRadius: 10
                                    }}>
                                        <Ionicons name="checkmark-circle" size={18} color={ADMIN_COLORS.chart5} />
                                        <Text style={{ color: ADMIN_COLORS.chart5, fontSize: 12, fontWeight: '600', marginLeft: 8 }}>
                                            Payout of KES {(item.payout || 0).toLocaleString()} settled to {item.provider_name}
                                        </Text>
                                    </View>
                                )}

                                {item.created_at && (
                                    <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, marginTop: 8, textAlign: 'right' }}>
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </Text>
                                )}
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
};
