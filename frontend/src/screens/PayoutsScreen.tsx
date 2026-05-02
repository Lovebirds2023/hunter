import React, { useState, useCallback, useContext } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeBackground } from '../components/ThemeBackground';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import { LinearGradient } from 'expo-linear-gradient';

interface WalletSummary {
    total_earned: number;
    in_escrow: number;
    available: number;
    settled: number;
}

interface EarningItem {
    id: string;
    service_title: string;
    buyer_name: string;
    gross_amount: number;
    commission: number;
    payout: number;
    order_status: string;
    escrow_status: 'in_escrow' | 'available' | 'settled';
    created_at: string;
}

interface BuyerOrder {
    id: string;
    service_title: string;
    service_image: string | null;
    provider_name: string;
    amount: number;
    status: string;
    created_at: string;
}

export const PayoutsScreen = () => {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const { userInfo } = useContext(AuthContext);
    const isProvider = userInfo?.role === 'provider' || userInfo?.role === 'admin' || userInfo?.role === 'super_admin';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Seller state
    const [wallet, setWallet] = useState<WalletSummary>({ total_earned: 0, in_escrow: 0, available: 0, settled: 0 });
    const [earnings, setEarnings] = useState<EarningItem[]>([]);

    // Buyer state
    const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>([]);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            if (isProvider) {
                const res = await client.get('/my-earnings');
                setWallet(res.data.wallet);
                setEarnings(res.data.earnings);
            }
            // Always fetch buyer orders (providers can also be buyers)
            const ordersRes = await client.get('/my-orders');
            setBuyerOrders(ordersRes.data);
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isProvider]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const getEscrowStyle = (status: string) => {
        switch (status) {
            case 'in_escrow':
                return { color: '#999', icon: 'lock-closed' as const, label: 'In Escrow', bg: '#f5f5f5', border: '#e0e0e0' };
            case 'available':
                return { color: '#2E7D32', icon: 'checkmark-circle' as const, label: 'Available', bg: '#E8F5E9', border: '#A5D6A7' };
            case 'settled':
                return { color: COLORS.primary, icon: 'wallet' as const, label: 'Withdrawn', bg: '#EDE7F6', border: '#B39DDB' };
            default:
                return { color: '#999', icon: 'help-circle' as const, label: 'Unknown', bg: '#f5f5f5', border: '#e0e0e0' };
        }
    };

    const getBuyerStatusStyle = (status: string) => {
        const s = (status || '').toLowerCase();
        switch (s) {
            case 'pending':
                return { color: '#EF6C00', bg: '#FFF3E0', label: 'Awaiting Payment', icon: 'time-outline' as const };
            case 'paid':
                return { color: '#2E7D32', bg: '#E8F5E9', label: '✓ Payment Done', icon: 'checkmark-circle' as const };
            case 'completed':
                return { color: COLORS.primary, bg: '#EDE7F6', label: 'Service Delivered', icon: 'checkmark-done' as const };
            case 'settled':
                return { color: '#1565C0', bg: '#E3F2FD', label: 'Completed', icon: 'shield-checkmark' as const };
            case 'cancelled':
                return { color: '#C62828', bg: '#FFEBEE', label: 'Cancelled', icon: 'close-circle' as const };
            default:
                return { color: '#999', bg: '#f5f5f5', label: status, icon: 'help-circle' as const };
        }
    };

    if (loading) {
        return (
            <ThemeBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.accent} />
                        <Text style={styles.loadingText}>Loading...</Text>
                    </View>
                </SafeAreaView>
            </ThemeBackground>
        );
    }

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.title}>{isProvider ? 'My Earnings' : 'My Orders'}</Text>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchData(true); }}
                            tintColor={COLORS.accent}
                        />
                    }
                >
                    {/* ============================== */}
                    {/* SELLER VIEW — Earnings & Escrow */}
                    {/* ============================== */}
                    {isProvider && (
                        <>
                            {/* Wallet Summary Card */}
                            <LinearGradient
                                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                                style={styles.walletCard}
                            >
                                <View style={styles.walletHeader}>
                                    <Text style={styles.walletLabel}>TOTAL EARNED</Text>
                                    <Ionicons name="wallet" size={22} color={COLORS.accent} />
                                </View>
                                <Text style={styles.walletTotal}>KES {wallet.total_earned.toLocaleString()}</Text>

                                <View style={styles.walletBreakdown}>
                                    {/* In Escrow — greyed out */}
                                    <View style={styles.walletStat}>
                                        <View style={[styles.walletStatDot, { backgroundColor: '#999' }]} />
                                        <View>
                                            <Text style={[styles.walletStatAmount, { opacity: 0.4 }]}>
                                                KES {wallet.in_escrow.toLocaleString()}
                                            </Text>
                                            <Text style={styles.walletStatLabel}>In Escrow</Text>
                                        </View>
                                    </View>

                                    {/* Available — highlighted green */}
                                    <View style={styles.walletStat}>
                                        <View style={[styles.walletStatDot, { backgroundColor: '#4CAF50' }]} />
                                        <View>
                                            <Text style={[styles.walletStatAmount, { color: '#4CAF50' }]}>
                                                KES {wallet.available.toLocaleString()}
                                            </Text>
                                            <Text style={styles.walletStatLabel}>Available</Text>
                                        </View>
                                    </View>

                                    {/* Settled */}
                                    <View style={styles.walletStat}>
                                        <View style={[styles.walletStatDot, { backgroundColor: COLORS.accent }]} />
                                        <View>
                                            <Text style={[styles.walletStatAmount, { color: COLORS.accent }]}>
                                                KES {wallet.settled.toLocaleString()}
                                            </Text>
                                            <Text style={styles.walletStatLabel}>Settled</Text>
                                        </View>
                                    </View>
                                </View>
                            </LinearGradient>

                            {/* Escrow Info Banner */}
                            <View style={styles.infoBanner}>
                                <Ionicons name="information-circle" size={18} color={COLORS.accent} />
                                <Text style={styles.infoBannerText}>
                                    Funds are held in escrow until the buyer confirms delivery. Once confirmed, the amount highlights and becomes available for withdrawal.
                                </Text>
                            </View>

                            {/* Earnings List */}
                            {earnings.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>Earnings History</Text>
                                    {earnings.map((item) => {
                                        const escrow = getEscrowStyle(item.escrow_status);
                                        const isEscrowed = item.escrow_status === 'in_escrow';

                                        return (
                                            <View
                                                key={item.id}
                                                style={[
                                                    styles.earningCard,
                                                    { borderColor: escrow.border, opacity: isEscrowed ? 0.55 : 1 }
                                                ]}
                                            >
                                                {/* Status Badge */}
                                                <View style={[styles.escrowBadge, { backgroundColor: escrow.bg }]}>
                                                    <Ionicons name={escrow.icon} size={14} color={escrow.color} />
                                                    <Text style={[styles.escrowBadgeText, { color: escrow.color }]}>
                                                        {escrow.label}
                                                    </Text>
                                                </View>

                                                {/* Service & Buyer Info */}
                                                <Text style={[styles.earningTitle, isEscrowed && { color: '#999' }]}>
                                                    {item.service_title}
                                                </Text>
                                                <Text style={styles.earningBuyer}>Buyer: {item.buyer_name}</Text>

                                                {/* Financial Grid */}
                                                <View style={styles.gridContainer}>
                                                    <View style={styles.gridColumn}>
                                                        <Text style={styles.gridHeader}>GROSS</Text>
                                                        <Text style={[styles.gridValue, isEscrowed && { color: '#bbb' }]}>
                                                            KES {(item.gross_amount || 0).toLocaleString()}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.gridColumn, styles.gridBorder]}>
                                                        <Text style={styles.gridHeader}>COMMISSION</Text>
                                                        <Text style={[styles.gridValue, { color: '#E53935' }]}>
                                                            -{(item.commission || 0).toLocaleString()}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.gridColumn}>
                                                        <Text style={[styles.gridHeader, { fontWeight: 'bold' }]}>
                                                            YOUR PAYOUT
                                                        </Text>
                                                        <Text style={[
                                                            styles.gridValue,
                                                            { fontSize: 15, fontWeight: '800' },
                                                            isEscrowed
                                                                ? { color: '#bbb' }
                                                                : { color: '#2E7D32' }
                                                        ]}>
                                                            KES {(item.payout || 0).toLocaleString()}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Escrow lock note for held funds */}
                                                {isEscrowed && (
                                                    <View style={styles.escrowNote}>
                                                        <Ionicons name="lock-closed" size={12} color="#999" />
                                                        <Text style={styles.escrowNoteText}>
                                                            Held until buyer confirms delivery
                                                        </Text>
                                                    </View>
                                                )}

                                                {item.created_at && (
                                                    <Text style={styles.dateText}>
                                                        {new Date(item.created_at).toLocaleDateString()}
                                                    </Text>
                                                )}
                                            </View>
                                        );
                                    })}
                                </>
                            )}

                            {earnings.length === 0 && (
                                <View style={styles.emptySection}>
                                    <Ionicons name="trending-up-outline" size={32} color="rgba(255,255,255,0.4)" />
                                    <Text style={styles.emptySectionText}>No earnings yet</Text>
                                </View>
                            )}

                            {/* Divider between seller/buyer sections if both exist */}
                            {buyerOrders.length > 0 && (
                                <View style={styles.sectionDivider} />
                            )}
                        </>
                    )}

                    {/* ============================== */}
                    {/* BUYER VIEW — My Purchases       */}
                    {/* ============================== */}
                    {buyerOrders.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>
                                {isProvider ? 'My Purchases (as buyer)' : 'My Purchases'}
                            </Text>
                            {buyerOrders.map((order) => {
                                const statusStyle = getBuyerStatusStyle(order.status);

                                return (
                                    <View key={order.id} style={styles.buyerOrderCard}>
                                        {/* Status Badge */}
                                        <View style={[styles.buyerStatusBadge, { backgroundColor: statusStyle.bg }]}>
                                            <Ionicons name={statusStyle.icon} size={14} color={statusStyle.color} />
                                            <Text style={[styles.buyerStatusText, { color: statusStyle.color }]}>
                                                {statusStyle.label}
                                            </Text>
                                        </View>

                                        {/* Service Info */}
                                        <Text style={styles.buyerOrderTitle}>{order.service_title}</Text>
                                        <Text style={styles.buyerOrderProvider}>Seller: {order.provider_name}</Text>

                                        {/* Amount & Payment */}
                                        <View style={styles.buyerAmountRow}>
                                            <View>
                                                <Text style={styles.buyerAmountLabel}>Amount Paid</Text>
                                                <Text style={styles.buyerAmountValue}>
                                                    KES {(order.amount || 0).toLocaleString()}
                                                </Text>
                                            </View>
                                            {(order.status || '').toLowerCase() !== 'pending' && (
                                                <View style={styles.paymentConfirm}>
                                                    <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                                                    <Text style={styles.paymentConfirmText}>Payment Done</Text>
                                                </View>
                                            )}
                                        </View>

                                        {order.created_at && (
                                            <Text style={styles.dateText}>
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </Text>
                                        )}
                                    </View>
                                );
                            })}
                        </>
                    )}

                    {/* Empty State — no data at all */}
                    {earnings.length === 0 && buyerOrders.length === 0 && !isProvider && (
                        <View style={styles.emptyContainer}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="wallet-outline" size={48} color={COLORS.white} style={{ opacity: 0.7 }} />
                            </View>
                            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Your purchase history will appear here once you buy services or products from the marketplace.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: 'rgba(255,255,255,0.6)', marginTop: 12, fontSize: 14 },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: SPACING.lg, paddingTop: 40, paddingBottom: SPACING.md,
    },
    title: { fontSize: 24, fontWeight: 'bold', color: COLORS.white },
    scrollContent: { padding: SPACING.md, paddingBottom: 80 },

    // Wallet Card
    walletCard: {
        borderRadius: 20, padding: 22, marginBottom: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    },
    walletHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    walletLabel: {
        color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5,
    },
    walletTotal: {
        fontSize: 34, fontWeight: 'bold', color: COLORS.white, marginTop: 8, marginBottom: 20,
    },
    walletBreakdown: {
        flexDirection: 'row', justifyContent: 'space-between',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16,
    },
    walletStat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    walletStatDot: { width: 8, height: 8, borderRadius: 4 },
    walletStatAmount: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
    walletStatLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 },

    // Info Banner
    infoBanner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 12, padding: 14, marginBottom: 20,
        borderWidth: 1, borderColor: 'rgba(255,215,0,0.1)',
    },
    infoBannerText: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },

    // Section Title
    sectionTitle: {
        color: COLORS.white, fontSize: 17, fontWeight: 'bold', marginBottom: 14, opacity: 0.9,
    },
    sectionDivider: {
        height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 25,
    },

    // Earning Card (Seller)
    earningCard: {
        backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md,
        marginBottom: SPACING.md, borderWidth: 1.5,
    },
    escrowBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 10,
    },
    escrowBadgeText: { fontSize: 11, fontWeight: 'bold' },
    earningTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 3 },
    earningBuyer: { fontSize: 12, color: '#888', marginBottom: 12 },

    // Financial Grid
    gridContainer: {
        flexDirection: 'row', backgroundColor: '#f8f9fa', borderRadius: 10, paddingVertical: 12,
    },
    gridColumn: { flex: 1, alignItems: 'center' },
    gridBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#e0e0e0' },
    gridHeader: { fontSize: 9, color: '#999', textTransform: 'uppercase', fontWeight: '600', marginBottom: 4, letterSpacing: 0.5 },
    gridValue: { fontSize: 13, color: COLORS.text, fontWeight: 'bold' },

    // Escrow Note
    escrowNote: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 10, backgroundColor: '#f9f9f9', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    },
    escrowNoteText: { fontSize: 11, color: '#999', fontStyle: 'italic' },

    // Buyer Order Card
    buyerOrderCard: {
        backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md,
        marginBottom: SPACING.md, borderWidth: 1, borderColor: '#eee',
    },
    buyerStatusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 10,
    },
    buyerStatusText: { fontSize: 11, fontWeight: 'bold' },
    buyerOrderTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 3 },
    buyerOrderProvider: { fontSize: 12, color: '#888', marginBottom: 12 },
    buyerAmountRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#f8f9fa', padding: 12, borderRadius: 10,
    },
    buyerAmountLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase', fontWeight: '600' },
    buyerAmountValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginTop: 2 },
    paymentConfirm: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    },
    paymentConfirmText: { fontSize: 12, fontWeight: 'bold', color: '#2E7D32' },

    dateText: { fontSize: 10, color: '#999', marginTop: 10, textAlign: 'right' },

    // Empty States
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: 60 },
    iconCircle: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    },
    emptyTitle: { color: COLORS.white, fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    emptySubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
    emptySection: { alignItems: 'center', padding: 30, opacity: 0.6 },
    emptySectionText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8 },
});
