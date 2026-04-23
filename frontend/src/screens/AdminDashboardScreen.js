import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    SafeAreaView, StatusBar, ActivityIndicator, BackHandler
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Admin Components
import { ADMIN_COLORS, adminStyles as s, gridStyles as g } from '../components/admin/AdminStyles';
import { AdminOverviewTab } from '../components/admin/AdminOverviewTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminEventsTab } from '../components/admin/AdminEventsTab';
import { AdminOrdersTab } from '../components/admin/AdminOrdersTab';
import { AdminCommunityTab } from '../components/admin/AdminCommunityTab';
import { AdminAnnouncementsTab } from '../components/admin/AdminAnnouncementsTab';
import { AdminDogsTab } from '../components/admin/AdminDogsTab';
import { AdminSupportTab } from '../components/admin/AdminSupportTab';
import { AdminExportTab } from '../components/admin/AdminExportTab';
import { AdminApprovalsTab } from '../components/admin/AdminApprovalsTab';

// Auth / API
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const MANAGEMENT_GRID = [
    { id: 'users', label: 'User Management', icon: 'people', sub: 'Roles & Suspensions', color: ADMIN_COLORS.info },
    { id: 'orders', label: 'Order Tracking', icon: 'cart', sub: 'Revenue & Payouts', color: ADMIN_COLORS.chart2, badge: 'pending_orders' },
    { id: 'approvals', label: 'Approvals', icon: 'checkbox', sub: 'Pending Action', color: ADMIN_COLORS.warning, badge: 'total_pending' },
    { id: 'events', label: 'Events Tracker', icon: 'calendar', sub: 'Check-ins & Regs', color: ADMIN_COLORS.chart3 },
    { id: 'dogs', label: 'Dog Registry', icon: 'paw', sub: 'Breed Distribution', color: ADMIN_COLORS.accent },
    { id: 'community', label: 'Moderation', icon: 'chatbubbles', sub: 'Social Monitor', color: ADMIN_COLORS.chart1, badge: 'flagged_posts' },
    { id: 'announcements', label: 'Announcements', icon: 'megaphone', sub: 'Broadcast Updates', color: ADMIN_COLORS.chart1 },
    { id: 'support', label: 'Support Desk', icon: 'headset', sub: 'User Help Tickets', color: ADMIN_COLORS.chart5, badge: 'open_tickets' },
    { id: 'export', label: 'Reporting', icon: 'download', sub: 'XLSX Data Center', color: ADMIN_COLORS.info },
];

export default function AdminDashboardScreen() {
    const navigation = useNavigation();
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('home'); // 'home', 'overview', 'users', etc.
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchQuickStats = useCallback(async () => {
        try {
            const res = await client.get('/admin/analytics');
            const data = res.data;
            // Add composite counts
            data.total_pending = (data.pending_services || 0) + (data.pending_reports || 0);
            data.pending_orders = data.orders_by_status?.pending || data.orders_by_status?.PENDING || 0;
            setStats(data);
        } catch (e) {
            console.error('Quick stats fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuickStats();
        
        // Setup polling for real-time updates (every 30 seconds)
        const pollInterval = setInterval(() => {
            fetchQuickStats();
        }, 30000);

        // Handle physical back button on Android
        const backAction = () => {
            if (activeTab !== 'home') {
                setActiveTab('home');
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        
        return () => {
            clearInterval(pollInterval);
            backHandler.remove();
        };
    }, [activeTab, fetchQuickStats]);

    if (loading) {
        return (
            <SafeAreaView style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator size="large" color={ADMIN_COLORS.accent} />
                <Text style={{ color: ADMIN_COLORS.textMuted, marginTop: 12 }}>Initializing Admin Console...</Text>
            </SafeAreaView>
        );
    }

    // Header component
    const Header = ({ title = "Admin Command", showBack = false }) => (
        <View style={s.header}>
            <View style={s.headerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {showBack && (
                        <TouchableOpacity onPress={() => setActiveTab('home')} style={{ marginRight: 15 }}>
                            <Ionicons name="arrow-back" size={26} color={ADMIN_COLORS.textPrimary} />
                        </TouchableOpacity>
                    )}
                    <View>
                        <Text style={s.headerGreeting}>Lovedogs 360 Control Center</Text>
                        <Text style={s.headerTitle}>{title}</Text>
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity style={s.headerBadge}>
                        <Ionicons name="notifications-outline" size={22} color={ADMIN_COLORS.textPrimary} />
                        {(stats?.open_tickets > 0 || stats?.flagged_posts > 0) && <View style={s.notificationDot} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={s.headerBadge} onPress={logout}>
                        <Ionicons name="log-out-outline" size={22} color={ADMIN_COLORS.danger} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    // Main Grid Menu
    const renderHome = () => (
        <ScrollView style={s.screen} contentContainerStyle={s.scrollContent}>
            <Header />

            {/* Quick Analytics Summary Card */}
            <TouchableOpacity 
                style={s.cardElevated} 
                onPress={() => setActiveTab('overview')}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={[s.sectionTitle, { fontSize: 16, color: ADMIN_COLORS.accent }]}>Live Platform Pulse</Text>
                        <Text style={{ color: ADMIN_COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>
                            {stats?.total_users || 0} Users • KES {(stats?.total_revenue || 0).toLocaleString()} Revenue
                        </Text>
                    </View>
                    <Ionicons name="stats-chart" size={24} color={ADMIN_COLORS.accent} />
                </View>
                
                <View style={{ flexDirection: 'row', marginTop: 15, gap: 15 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.04)', padding: 10, borderRadius: 12 }}>
                        <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 10 }}>NEW USERS (30d)</Text>
                        <Text style={{ color: ADMIN_COLORS.info, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                            +{stats?.new_users_30d || 0}
                        </Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.04)', padding: 10, borderRadius: 12 }}>
                        <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 10 }}>NEW ORDERS (30d)</Text>
                        <Text style={{ color: ADMIN_COLORS.success, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                            +{stats?.new_orders_30d || 0}
                        </Text>
                    </View>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                    <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 12, fontWeight: '700' }}>View Detailed Analytics</Text>
                    <Ionicons name="arrow-forward" size={14} color={ADMIN_COLORS.textMuted} style={{ marginLeft: 6 }} />
                </View>
            </TouchableOpacity>

            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Management Console</Text>
            </View>

            <View style={g.grid}>
                {MANAGEMENT_GRID.map(item => (
                    <TouchableOpacity 
                        key={item.id} 
                        style={g.gridCard}
                        onPress={() => setActiveTab(item.id)}
                    >
                        <View style={[g.gridIconBg, { backgroundColor: `${item.color}20` }]}>
                            <Ionicons name={item.icon} size={28} color={item.color} />
                        </View>
                        <Text style={g.gridLabel} numberOfLines={1}>{item.label}</Text>
                        <Text style={g.gridSub} numberOfLines={1}>{item.sub}</Text>
                        
                        {(item.badge && stats?.[item.badge] > 0) && (
                            <View style={g.gridBadge}>
                                <Text style={g.gridBadgeText}>{stats[item.badge]}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );

    // Active View Delegate
    const renderContent = () => {
        switch (activeTab) {
            case 'home': return renderHome();
            case 'overview': return <AdminOverviewTab onNavigate={setActiveTab} />;
            case 'users': return <AdminUsersTab onBack={() => setActiveTab('home')} />;
            case 'events': return <AdminEventsTab onBack={() => setActiveTab('home')} navigation={navigation} />;
            case 'orders': return <AdminOrdersTab onBack={() => setActiveTab('home')} />;
            case 'community': return <AdminCommunityTab onBack={() => setActiveTab('home')} />;
            case 'announcements': return <AdminAnnouncementsTab onBack={() => setActiveTab('home')} />;
            case 'dogs': return <AdminDogsTab onBack={() => setActiveTab('home')} />;
            case 'support': return <AdminSupportTab onBack={() => setActiveTab('home')} />;
            case 'export': return <AdminExportTab onBack={() => setActiveTab('home')} />;
            
            // Temporary mapping for sections not yet fully modularized
            case 'approvals': 
                return <AdminApprovalsTab onBack={() => setActiveTab('home')} />;
            case 'spotlight':
                return (
                    <View style={s.screen}>
                        <Header title="Spotlight Management" showBack />
                        <Text style={[s.emptyText, { marginTop: 40 }]}>Spotlight management logic will be integrated into the new modular design shortly.</Text>
                    </View>
                );
            default: return renderHome();
        }
    };

    return (
        <View style={s.screen}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={{ flex: 1 }}>
                {renderContent()}
            </SafeAreaView>
        </View>
    );
}
