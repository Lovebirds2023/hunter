import React, { useState, useCallback, useContext } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Platform
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
import { downloadOrderReceipt } from '../utils/receiptDownload';

interface WalletSummary {
    total_earned: number;
    in_escrow: number;
    available: number;
    withdrawable?: number;
    pending_withdrawal?: number;
    settled: number;
    currency?: string;
    payment_method?: string | null;
    payout_destination?: string | null;
}

interface EarningItem {
    id: string;
    service_title: string;
    buyer_name: string;
    gross_amount: number;
    commission: number;
    payout: number;
    discount_amount?: number;
    karma_points_redeemed?: number;
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
    discount_amount?: number;
    karma_points_redeemed?: number;
    status: string;
    created_at: string;
}

interface WithdrawalItem {
    id: string;
    amount: number;
    status: 'pending' | 'completed' | 'failed' | string;
    method?: string | null;
    destination?: string | null;
    created_at?: string | null;
    processed_at?: string | null;
}

export const PayoutsScreen = () => {
    const { t } = useTranslation();
    const navigation: any = useNavigation();
    const { userInfo } = useContext(AuthContext);
    const isProvider = userInfo?.role === 'provider' || userInfo?.role === 'admin' || userInfo?.role === 'super_admin';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Seller state
    const [wallet, setWallet] = useState<WalletSummary>({ total_earned: 0, in_escrow: 0, available: 0, settled: 0 });
    const [earnings, setEarnings] = useState<EarningItem[]>([]);
    const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
    const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    const [withdrawing, setWithdrawing] = useState(false);

    // Buyer state
    const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>([]);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            if (isProvider) {
                const res = await client.get('/my-earnings');
                setWallet(res.data.wallet);
                setEarnings(res.data.earnings);
                setWithdrawals(res.data.withdrawals || []);
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
                return { color: '#999', icon: 'lock-closed' as const, label: t('payouts.status.in_escrow'), bg: '#f5f5f5', border: '#e0e0e0' };
            case 'available':
                return { color: '#2E7D32', icon: 'checkmark-circle' as const, label: t('payouts.status.available'), bg: '#E8F5E9', border: '#A5D6A7' };
            case 'settled':
                return { color: COLORS.primary, icon: 'wallet' as const, label: t('payouts.status.withdrawn'), bg: '#EDE7F6', border: '#B39DDB' };
            default:
                return { color: '#999', icon: 'help-circle' as const, label: t('payouts.status.unknown'), bg: '#f5f5f5', border: '#e0e0e0' };
        }
    };

    const getBuyerStatusStyle = (status: string) => {
        const s = (status || '').toLowerCase();
        switch (s) {
            case 'pending':
                return { color: '#EF6C00', bg: '#FFF3E0', label: t('payouts.status.awaiting_payment'), icon: 'time-outline' as const };
            case 'paid':
                return { color: '#2E7D32', bg: '#E8F5E9', label: t('payouts.status.payment_done'), icon: 'checkmark-circle' as const };
            case 'completed':
                return { color: COLORS.primary, bg: '#EDE7F6', label: t('payouts.status.service_delivered'), icon: 'checkmark-done' as const };
            case 'settled':
                return { color: '#1565C0', bg: '#E3F2FD', label: t('payouts.status.completed'), icon: 'shield-checkmark' as const };
            case 'cancelled':
                return { color: '#C62828', bg: '#FFEBEE', label: t('payouts.status.cancelled'), icon: 'close-circle' as const };
            default:
                return { color: '#999', bg: '#f5f5f5', label: status, icon: 'help-circle' as const };
        }
    };

    const getWithdrawalStatusStyle = (status: string) => {
        const s = String(status || '').toLowerCase();
        if (s === 'completed') {
            return { color: '#1565C0', bg: '#E3F2FD', icon: 'checkmark-circle' as const, label: t('payouts.status.completed') };
        }
        if (s === 'failed') {
            return { color: '#C62828', bg: '#FFEBEE', icon: 'close-circle' as const, label: t('payouts.status.failed', { defaultValue: 'Failed' }) };
        }
        return { color: '#EF6C00', bg: '#FFF3E0', icon: 'time-outline' as const, label: t('payouts.status.pending', { defaultValue: 'Pending' }) };
    };

    const formatDate = (value?: string | null) => {
        if (!value) return '';
        return new Date(value).toLocaleDateString();
    };

    const canDownloadReceipt = (status?: string) => {
        return ['paid', 'completed', 'settled'].includes(String(status || '').toLowerCase());
    };

    const handleDownloadReceipt = async (orderId: string, status?: string) => {
        if (!canDownloadReceipt(status)) {
            Alert.alert(
                t('common.error'),
                t('checkout.payment_not_confirmed', { defaultValue: 'Payment is not confirmed yet. If you just paid, wait a moment and try again.' })
            );
            return;
        }

        setReceiptOrderId(orderId);
        try {
            await downloadOrderReceipt(orderId);
            Alert.alert(t('common.success'), t('marketplace.orders.success_download', { defaultValue: 'PDF receipt is ready.' }));
        } catch (error: any) {
            const detail = error.response?.data?.detail || error.message || t('marketplace.orders.error_download_failed');
            Alert.alert(t('common.error'), typeof detail === 'string' ? detail : JSON.stringify(detail));
        } finally {
            setReceiptOrderId(null);
        }
    };

    const handleCancelOrder = async (orderId: string) => {
        const cancelOrder = async () => {
            setCancellingOrderId(orderId);
            try {
                const res = await client.post(`/orders/${orderId}/cancel`);
                Alert.alert(
                    t('common.success'),
                    res.data?.message || t('payouts.order_cancelled', { defaultValue: 'Order cancelled successfully.' })
                );
                fetchData(true);
            } catch (error: any) {
                const detail = error.response?.data?.detail || error.message || t('payouts.cancel_failed', { defaultValue: 'Could not cancel this order.' });
                Alert.alert(t('common.error'), typeof detail === 'string' ? detail : JSON.stringify(detail));
            } finally {
                setCancellingOrderId(null);
            }
        };

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const confirmed = window.confirm(
                t('payouts.cancel_pending_order_confirm', {
                    defaultValue: 'Cancel this unpaid pending order? No payment, payout, or inventory will be changed.'
                })
            );
            if (confirmed) {
                cancelOrder();
            }
            return;
        }

        Alert.alert(
            t('payouts.cancel_pending_order', { defaultValue: 'Cancel Pending Order' }),
            t('payouts.cancel_pending_order_confirm', {
                defaultValue: 'Cancel this unpaid pending order? No payment, payout, or inventory will be changed.'
            }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('payouts.cancel_order_action', { defaultValue: 'Cancel Order' }), style: 'destructive', onPress: cancelOrder }
            ]
        );
    };

    const getPayoutMethodLabel = () => {
        if (wallet.payment_method === 'mpesa') {
            return wallet.payout_destination ? `M-Pesa - ${wallet.payout_destination}` : 'M-Pesa';
        }
        if (wallet.payment_method === 'card') {
            return 'Card / Pesapal';
        }
        return t('profile_screen.not_configured', { defaultValue: 'Not configured' });
    };

    const handleRequestWithdrawal = async () => {
        const amount = wallet.withdrawable ?? wallet.available ?? 0;
        if (amount <= 0) {
            Alert.alert(t('common.error'), t('payouts.no_available_withdrawal', { defaultValue: 'No available balance to withdraw yet.' }));
            return;
        }
        if (!wallet.payment_method) {
            Alert.alert(
                t('common.error'),
                t('payouts.configure_payout_first', { defaultValue: 'Please set your payout method in profile first.' }),
                [{ text: t('profile_screen.setup', { defaultValue: 'Setup' }), onPress: () => navigation.navigate('Profile') }]
            );
            return;
        }

        setWithdrawing(true);
        try {
            const res = await client.post('/withdrawals/request', {
                amount,
                method: wallet.payment_method
            });
            setWallet(res.data.wallet);
            if (res.data.withdrawal) {
                setWithdrawals(prev => [
                    res.data.withdrawal,
                    ...prev.filter(item => item.id !== res.data.withdrawal.id)
                ]);
            }
            Alert.alert(t('common.success'), res.data.message || t('payouts.withdrawal_requested', { defaultValue: 'Withdrawal request submitted.' }));
        } catch (error: any) {
            const detail = error.response?.data?.detail || error.message || t('payouts.withdrawal_failed', { defaultValue: 'Could not request withdrawal.' });
            Alert.alert(t('common.error'), typeof detail === 'string' ? detail : JSON.stringify(detail));
        } finally {
            setWithdrawing(false);
        }
    };

    if (loading) {
        return (
            <ThemeBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.accent} />
                        <Text style={styles.loadingText}>{t('common.loading')}</Text>
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
                    <Text style={styles.title}>{isProvider ? t('payouts.my_earnings') : t('payouts.my_orders')}</Text>
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
                                    <Text style={styles.walletLabel}>{t('payouts.total_earned')}</Text>
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
                                            <Text style={styles.walletStatLabel}>{t('payouts.status.in_escrow')}</Text>
                                        </View>
                                    </View>

                                    {/* Available — highlighted green */}
                                    <View style={styles.walletStat}>
                                        <View style={[styles.walletStatDot, { backgroundColor: '#4CAF50' }]} />
                                        <View>
                                            <Text style={[styles.walletStatAmount, { color: '#4CAF50' }]}>
                                                KES {wallet.available.toLocaleString()}
                                            </Text>
                                            <Text style={styles.walletStatLabel}>{t('payouts.status.available')}</Text>
                                        </View>
                                    </View>

                                    {/* Settled */}
                                    <View style={styles.walletStat}>
                                        <View style={[styles.walletStatDot, { backgroundColor: COLORS.accent }]} />
                                        <View>
                                            <Text style={[styles.walletStatAmount, { color: COLORS.accent }]}>
                                                KES {wallet.settled.toLocaleString()}
                                            </Text>
                                            <Text style={styles.walletStatLabel}>{t('payouts.status.settled')}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.withdrawPanel}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.withdrawLabel}>{t('payouts.withdraw_to', { defaultValue: 'Withdraw to' })}</Text>
                                        <Text style={styles.withdrawMethod}>{getPayoutMethodLabel()}</Text>
                                        {(wallet.pending_withdrawal || 0) > 0 && (
                                            <Text style={styles.pendingWithdrawalText}>
                                                {t('payouts.pending_withdrawal', {
                                                    defaultValue: 'Pending withdrawal: KES {{amount}}',
                                                    amount: (wallet.pending_withdrawal || 0).toLocaleString()
                                                })}
                                            </Text>
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        style={[
                                            styles.withdrawButton,
                                            ((wallet.withdrawable ?? wallet.available ?? 0) <= 0 || withdrawing) && styles.withdrawButtonDisabled
                                        ]}
                                        onPress={handleRequestWithdrawal}
                                        disabled={(wallet.withdrawable ?? wallet.available ?? 0) <= 0 || withdrawing}
                                    >
                                        {withdrawing ? (
                                            <ActivityIndicator size="small" color={COLORS.primaryDark} />
                                        ) : (
                                            <>
                                                <Ionicons name="cash-outline" size={16} color={COLORS.primaryDark} />
                                                <Text style={styles.withdrawButtonText}>
                                                    {t('payouts.withdraw', { defaultValue: 'Withdraw' })}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </LinearGradient>

                            {/* Escrow Info Banner */}
                            <View style={styles.infoBanner}>
                                <Ionicons name="information-circle" size={18} color={COLORS.accent} />
                                <Text style={styles.infoBannerText}>
                                    {t('payouts.escrow_info')}
                                </Text>
                            </View>

                            {withdrawals.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>
                                        {t('payouts.withdrawal_history', { defaultValue: 'Withdrawal History' })}
                                    </Text>
                                    {withdrawals.map((withdrawal) => {
                                        const withdrawalStatus = getWithdrawalStatusStyle(withdrawal.status);
                                        return (
                                            <View key={withdrawal.id} style={styles.withdrawalHistoryCard}>
                                                <View style={styles.withdrawalHistoryHeader}>
                                                    <View>
                                                        <Text style={styles.withdrawalHistoryAmount}>
                                                            KES {(withdrawal.amount || 0).toLocaleString()}
                                                        </Text>
                                                        <Text style={styles.withdrawalHistoryDestination}>
                                                            {(withdrawal.method || 'payout').toUpperCase()} - {withdrawal.destination || t('profile_screen.not_configured', { defaultValue: 'Not configured' })}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.withdrawalStatusBadge, { backgroundColor: withdrawalStatus.bg }]}>
                                                        <Ionicons name={withdrawalStatus.icon} size={14} color={withdrawalStatus.color} />
                                                        <Text style={[styles.withdrawalStatusText, { color: withdrawalStatus.color }]}>
                                                            {withdrawalStatus.label}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={styles.withdrawalDateRow}>
                                                    {withdrawal.created_at ? (
                                                        <Text style={styles.withdrawalDateText}>
                                                            {t('payouts.requested_on', { defaultValue: 'Requested' })}: {formatDate(withdrawal.created_at)}
                                                        </Text>
                                                    ) : null}
                                                    {withdrawal.processed_at ? (
                                                        <Text style={styles.withdrawalDateText}>
                                                            {t('payouts.paid_on', { defaultValue: 'Paid' })}: {formatDate(withdrawal.processed_at)}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </>
                            )}

                            {/* Earnings List */}
                            {earnings.length > 0 && (
                                <>
                                    <Text style={styles.sectionTitle}>{t('payouts.earnings_history')}</Text>
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
                                                <Text style={styles.earningBuyer}>{t('payouts.buyer', { name: item.buyer_name })}</Text>

                                                {/* Financial Grid */}
                                                <View style={styles.gridContainer}>
                                                    <View style={styles.gridColumn}>
                                                        <Text style={styles.gridHeader}>{t('payouts.grid.gross')}</Text>
                                                        <Text style={[styles.gridValue, isEscrowed && { color: '#bbb' }]}>
                                                            KES {(item.gross_amount || 0).toLocaleString()}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.gridColumn, styles.gridBorder]}>
                                                        <Text style={styles.gridHeader}>{t('payouts.grid.commission')}</Text>
                                                        <Text style={[styles.gridValue, { color: '#E53935' }]}>
                                                            -{(item.commission || 0).toLocaleString()}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.gridColumn}>
                                                        <Text style={[styles.gridHeader, { fontWeight: 'bold' }]}>
                                                            {t('payouts.grid.your_payout')}
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

                                                {(item.discount_amount || 0) > 0 && (
                                                    <Text style={styles.discountNote}>
                                                        Points discount used: KES {(item.discount_amount || 0).toLocaleString()} ({item.karma_points_redeemed || 0} points)
                                                    </Text>
                                                )}

                                                <TouchableOpacity
                                                    style={[
                                                        styles.receiptAction,
                                                        receiptOrderId === item.id && styles.receiptActionDisabled
                                                    ]}
                                                    onPress={() => handleDownloadReceipt(item.id, item.order_status)}
                                                    disabled={receiptOrderId === item.id}
                                                >
                                                    <Ionicons name="receipt-outline" size={16} color={COLORS.primary} />
                                                    <Text style={styles.receiptActionText}>
                                                        {receiptOrderId === item.id
                                                            ? t('marketplace.orders.downloading')
                                                            : t('marketplace.orders.view_receipt', { defaultValue: 'View receipt' })}
                                                    </Text>
                                                </TouchableOpacity>

                                                {/* Escrow lock note for held funds */}
                                                {isEscrowed && (
                                                    <View style={styles.escrowNote}>
                                                        <Ionicons name="lock-closed" size={12} color="#999" />
                                                        <Text style={styles.escrowNoteText}>
                                                            {t('payouts.held_until_confirmed')}
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
                                    <Text style={styles.emptySectionText}>{t('payouts.no_earnings')}</Text>
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
                                {isProvider ? t('payouts.my_purchases_buyer') : t('payouts.my_purchases')}
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
                                        <Text style={styles.buyerOrderProvider}>{t('payouts.seller', { name: order.provider_name })}</Text>

                                        {/* Amount & Payment */}
                                        <View style={styles.buyerAmountRow}>
                                            <View>
                                                <Text style={styles.buyerAmountLabel}>{t('payouts.amount_paid')}</Text>
                                                <Text style={styles.buyerAmountValue}>
                                                    KES {(order.amount || 0).toLocaleString()}
                                                </Text>
                                            </View>
                                            {(order.status || '').toLowerCase() !== 'pending' && (
                                                <View style={styles.paymentConfirm}>
                                                    <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                                                    <Text style={styles.paymentConfirmText}>{t('payouts.status.payment_done')}</Text>
                                                </View>
                                            )}
                                        </View>

                                        {(order.discount_amount || 0) > 0 && (
                                            <Text style={styles.discountNote}>
                                                Points discount: KES {(order.discount_amount || 0).toLocaleString()} ({order.karma_points_redeemed || 0} points)
                                            </Text>
                                        )}

                                        {canDownloadReceipt(order.status) && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.receiptAction,
                                                    receiptOrderId === order.id && styles.receiptActionDisabled
                                                ]}
                                                onPress={() => handleDownloadReceipt(order.id, order.status)}
                                                disabled={receiptOrderId === order.id}
                                            >
                                                <Ionicons name="receipt-outline" size={16} color={COLORS.primary} />
                                                <Text style={styles.receiptActionText}>
                                                    {receiptOrderId === order.id
                                                        ? t('marketplace.orders.downloading')
                                                        : t('marketplace.orders.view_receipt', { defaultValue: 'View receipt' })}
                                                </Text>
                                            </TouchableOpacity>
                                        )}

                                        {(order.status || '').toLowerCase() === 'pending' && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.cancelOrderAction,
                                                    cancellingOrderId === order.id && styles.receiptActionDisabled
                                                ]}
                                                onPress={() => handleCancelOrder(order.id)}
                                                disabled={cancellingOrderId === order.id}
                                            >
                                                {cancellingOrderId === order.id ? (
                                                    <ActivityIndicator size="small" color="#C62828" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="close-circle-outline" size={16} color="#C62828" />
                                                        <Text style={styles.cancelOrderActionText}>
                                                            {t('payouts.cancel_order_action', { defaultValue: 'Cancel Order' })}
                                                        </Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        )}

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
                            <Text style={styles.emptyTitle}>{t('payouts.no_transactions')}</Text>
                            <Text style={styles.emptySubtitle}>
                                {t('payouts.no_transactions_subtitle')}
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
    withdrawPanel: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginTop: 16, paddingTop: 14,
    },
    withdrawLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, textTransform: 'uppercase', fontWeight: '700' },
    withdrawMethod: { color: COLORS.white, fontSize: 13, fontWeight: '700', marginTop: 2 },
    pendingWithdrawalText: { color: COLORS.accent, fontSize: 11, fontWeight: '700', marginTop: 5 },
    withdrawButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    },
    withdrawButtonDisabled: { opacity: 0.5 },
    withdrawButtonText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '800' },

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
    receiptAction: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10,
        paddingVertical: 9, paddingHorizontal: 12, marginTop: 12,
        backgroundColor: '#fff',
    },
    receiptActionDisabled: { opacity: 0.6 },
    receiptActionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
    cancelOrderAction: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderWidth: 1, borderColor: '#C62828', borderRadius: 10,
        paddingVertical: 9, paddingHorizontal: 12, marginTop: 12,
        backgroundColor: '#fff',
    },
    cancelOrderActionText: { fontSize: 13, fontWeight: '700', color: '#C62828' },
    withdrawalHistoryCard: {
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: '#E3E7EE',
    },
    withdrawalHistoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    withdrawalHistoryAmount: { fontSize: 17, fontWeight: '800', color: COLORS.text },
    withdrawalHistoryDestination: { fontSize: 12, color: '#777', marginTop: 3 },
    withdrawalStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    withdrawalStatusText: { fontSize: 11, fontWeight: '800' },
    withdrawalDateRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#EEF1F6',
        marginTop: 12,
        paddingTop: 10,
    },
    withdrawalDateText: { fontSize: 11, color: '#777', fontWeight: '600' },

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
    discountNote: { fontSize: 11, color: '#2E7D32', fontWeight: '700', marginTop: 10, textAlign: 'center' },

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
