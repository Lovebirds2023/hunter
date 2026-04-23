import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';
import { RevenueBarChart, DonutBreakdown } from './ChartComponents';

/* ─── KPI Stat Card ─── */
const KPICard = ({ icon, label, value, trend, trendUp, color, bgColor }) => (
    <View style={s.statCard}>
        <View style={s.statIconRow}>
            <View style={[s.statIconBg, { backgroundColor: bgColor || `${color}20` }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            {trend !== undefined && trend !== null && (
                <View style={[s.statTrend, { backgroundColor: trendUp ? ADMIN_COLORS.successBg : ADMIN_COLORS.dangerBg }]}>
                    <Ionicons
                        name={trendUp ? 'trending-up' : 'trending-down'}
                        size={12}
                        color={trendUp ? ADMIN_COLORS.success : ADMIN_COLORS.danger}
                    />
                    <Text style={[s.statTrendText, { color: trendUp ? ADMIN_COLORS.success : ADMIN_COLORS.danger }]}>
                        {trend}%
                    </Text>
                </View>
            )}
        </View>
        <Text style={s.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
        <Text style={s.statLabel}>{label}</Text>
    </View>
);

/* ─── Alert Banner ─── */
const AlertBanner = ({ alerts }) => {
    if (!alerts || alerts.length === 0) return null;
    return (
        <View style={{
            backgroundColor: ADMIN_COLORS.warningBg,
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: `${ADMIN_COLORS.warning}30`,
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="alert-circle" size={18} color={ADMIN_COLORS.warning} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: ADMIN_COLORS.warning, marginLeft: 8 }}>
                    Needs Attention
                </Text>
            </View>
            {alerts.map((alert, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: i > 0 ? 6 : 0 }}>
                    <Ionicons name={alert.icon} size={14} color={ADMIN_COLORS.textSecondary} />
                    <Text style={{ fontSize: 13, color: ADMIN_COLORS.textSecondary, marginLeft: 8, flex: 1 }}>
                        {alert.text}
                    </Text>
                </View>
            ))}
        </View>
    );
};

/* ─── Activity Feed Item ─── */
const ActivityItem = ({ item }) => {
    const iconMap = { 'person-add': ADMIN_COLORS.info, 'cart': ADMIN_COLORS.success, 'alert-circle': ADMIN_COLORS.warning };
    const color = iconMap[item.icon] || ADMIN_COLORS.textMuted;
    const timeAgo = formatTimeAgo(item.time);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: ADMIN_COLORS.surfaceBorder }}>
            <View style={[s.statIconBg, { backgroundColor: `${color}20`, width: 36, height: 36, borderRadius: 10 }]}>
                <Ionicons name={item.icon} size={16} color={color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 13, color: ADMIN_COLORS.textPrimary, lineHeight: 18 }}>
                    {item.description}
                </Text>
                <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, marginTop: 2 }}>{timeAgo}</Text>
            </View>
        </View>
    );
};

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    try {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    } catch { return ''; }
}

function calcTrend(current, previous) {
    if (!previous || previous === 0) return current > 0 ? { value: 100, up: true } : null;
    const pct = Math.round(((current - previous) / previous) * 100);
    return { value: Math.abs(pct), up: pct >= 0 };
}

/* ─── Main Overview Tab ─── */
export const AdminOverviewTab = ({ onNavigate }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAnalytics = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/analytics');
            setData(res.data);
        } catch (e) {
            console.error('Analytics fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
    const onRefresh = () => { setRefreshing(true); fetchAnalytics(true); };

    if (loading || !data) {
        return (
            <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={ADMIN_COLORS.accent} />
                <Text style={{ color: ADMIN_COLORS.textMuted, marginTop: 12 }}>Loading analytics...</Text>
            </View>
        );
    }

    // Compute trends
    const userTrend = calcTrend(data.new_users_30d, data.new_users_prev_30d);
    const orderTrend = calcTrend(data.new_orders_30d, data.new_orders_prev_30d);
    const revenueTrend = calcTrend(data.revenue_30d, data.revenue_prev_30d);

    // Build attention alerts
    const alerts = [];
    if (data.pending_services > 0) alerts.push({ icon: 'time-outline', text: `${data.pending_services} service(s) awaiting approval` });
    if (data.pending_reports > 0) alerts.push({ icon: 'shield-outline', text: `${data.pending_reports} report(s) awaiting moderation` });
    if (data.open_tickets > 0) alerts.push({ icon: 'chatbox-ellipses-outline', text: `${data.open_tickets} support ticket(s) unresolved` });
    if (data.flagged_posts > 0) alerts.push({ icon: 'flag-outline', text: `${data.flagged_posts} community post(s) flagged` });
    if (data.open_cases > 0) alerts.push({ icon: 'alert-circle-outline', text: `${data.open_cases} active case(s)` });

    // Role distribution data
    const roleItems = [
        { label: 'Buyers', value: data.users_by_role?.buyer || 0, color: ADMIN_COLORS.chart1 },
        { label: 'Providers', value: data.users_by_role?.provider || 0, color: ADMIN_COLORS.chart2 },
        { label: 'Admins', value: data.users_by_role?.admin || 0, color: ADMIN_COLORS.accent },
    ];

    // Order status data
    const orderItems = [
        { label: 'Pending', value: data.orders_by_status?.pending || data.orders_by_status?.PENDING || 0, color: ADMIN_COLORS.warning },
        { label: 'Paid', value: data.orders_by_status?.paid || data.orders_by_status?.PAID || 0, color: ADMIN_COLORS.success },
        { label: 'Completed', value: data.orders_by_status?.completed || data.orders_by_status?.COMPLETED || 0, color: ADMIN_COLORS.chart1 },
        { label: 'Settled', value: data.orders_by_status?.settled || data.orders_by_status?.SETTLED || 0, color: ADMIN_COLORS.chart5 },
        { label: 'Cancelled', value: data.orders_by_status?.cancelled || data.orders_by_status?.CANCELLED || 0, color: ADMIN_COLORS.danger },
    ].filter(i => i.value > 0);

    return (
        <ScrollView
            style={s.screen}
            contentContainerStyle={s.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ADMIN_COLORS.accent} />}
            showsVerticalScrollIndicator={false}
        >
            {/* Alerts Banner */}
            <AlertBanner alerts={alerts} />

            {/* ── KPI Cards ── */}
            <View style={s.statsGrid}>
                <KPICard
                    icon="people"
                    label="Total Users"
                    value={data.total_users}
                    trend={userTrend?.value}
                    trendUp={userTrend?.up}
                    color={ADMIN_COLORS.chart1}
                />
                <KPICard
                    icon="cart"
                    label="Total Orders"
                    value={data.total_orders}
                    trend={orderTrend?.value}
                    trendUp={orderTrend?.up}
                    color={ADMIN_COLORS.chart2}
                />
                <KPICard
                    icon="cash"
                    label="Revenue"
                    value={`KES ${(data.total_revenue || 0).toLocaleString()}`}
                    trend={revenueTrend?.value}
                    trendUp={revenueTrend?.up}
                    color={ADMIN_COLORS.success}
                />
                <KPICard
                    icon="paw"
                    label="Dogs Registered"
                    value={data.total_dogs || 0}
                    color={ADMIN_COLORS.accent}
                />
            </View>

            {/* ── Secondary Stats Row ── */}
            <View style={s.statsGrid}>
                <KPICard icon="calendar" label="Events" value={data.total_events} color={ADMIN_COLORS.chart3} />
                <KPICard icon="ticket" label="Upcoming Events" value={data.upcoming_events || 0} color={ADMIN_COLORS.chart5} />
            </View>

            {/* ── Revenue Chart ── */}
            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Revenue Trend</Text>
                <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>Last 6 months</Text>
            </View>
            <View style={s.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary }}>This Month</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: ADMIN_COLORS.success, marginTop: 2 }}>
                            KES {(data.revenue_30d || 0).toLocaleString()}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary }}>Commission</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: ADMIN_COLORS.accent, marginTop: 2 }}>
                            KES {(data.total_commission || 0).toLocaleString()}
                        </Text>
                    </View>
                </View>
                <RevenueBarChart data={data.monthly_revenue || []} />
            </View>

            {/* ── User Distribution ── */}
            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>User Breakdown</Text>
                <TouchableOpacity onPress={() => onNavigate && onNavigate('users')}>
                    <Text style={s.sectionAction}>View All →</Text>
                </TouchableOpacity>
            </View>
            <View style={s.card}>
                <DonutBreakdown items={roleItems} label="Users by Role" />
            </View>

            {/* ── Orders Distribution ── */}
            {orderItems.length > 0 && (
                <>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Order Status</Text>
                        <TouchableOpacity onPress={() => onNavigate && onNavigate('orders')}>
                            <Text style={s.sectionAction}>View All →</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={s.card}>
                        <DonutBreakdown items={orderItems} label="Orders by Status" />
                    </View>
                </>
            )}

            {/* ── Top Services Leaderboard ── */}
            {data.top_services?.length > 0 && (
                <>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Top Services</Text>
                    </View>
                    <View style={s.card}>
                        {data.top_services.map((svc, i) => (
                            <View key={i} style={{
                                flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                                borderBottomWidth: i < data.top_services.length - 1 ? 1 : 0,
                                borderBottomColor: ADMIN_COLORS.surfaceBorder,
                            }}>
                                <View style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    backgroundColor: i === 0 ? ADMIN_COLORS.accent : ADMIN_COLORS.surfaceLight,
                                    justifyContent: 'center', alignItems: 'center',
                                }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: i === 0 ? ADMIN_COLORS.bg : ADMIN_COLORS.textSecondary }}>
                                        {i + 1}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: ADMIN_COLORS.textPrimary }} numberOfLines={1}>
                                        {svc.title}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted, marginTop: 1 }}>
                                        {svc.order_count} orders
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: ADMIN_COLORS.success }}>
                                    KES {svc.revenue?.toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </View>
                </>
            )}

            {/* ── Community & Platform Health ── */}
            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Platform Health</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
                    <Ionicons name="chatbubbles" size={24} color={ADMIN_COLORS.chart1} />
                    <Text style={[s.statValue, { fontSize: 22, marginTop: 6 }]}>{data.total_community_posts || 0}</Text>
                    <Text style={s.statLabel}>Community Posts</Text>
                </View>
                <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
                    <Ionicons name="alert-circle" size={24} color={ADMIN_COLORS.warning} />
                    <Text style={[s.statValue, { fontSize: 22, marginTop: 6 }]}>{data.total_cases || 0}</Text>
                    <Text style={s.statLabel}>Case Reports</Text>
                </View>
                <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
                    <Ionicons name="headset" size={24} color={ADMIN_COLORS.chart5} />
                    <Text style={[s.statValue, { fontSize: 22, marginTop: 6 }]}>{data.total_tickets || 0}</Text>
                    <Text style={s.statLabel}>Support</Text>
                </View>
            </View>

            {/* ── Recent Activity ── */}
            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Recent Activity</Text>
            </View>
            <View style={s.card}>
                {(data.recent_activity || []).length === 0 ? (
                    <Text style={s.emptyText}>No recent activity</Text>
                ) : (
                    data.recent_activity.slice(0, 8).map((item, i) => (
                        <ActivityItem key={i} item={item} />
                    ))
                )}
            </View>

            <View style={{ height: 30 }} />
        </ScrollView>
    );
};
