import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Switch, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { ThemeBackground } from '../components/ThemeBackground';
import { Button } from '../components/Button';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';
import { getServiceFormFields, createOrder, initiatePayment } from '../api/marketplace';
import { useCurrency } from '../context/CurrencyContext';
import { downloadOrderReceipt } from '../utils/receiptDownload';

type Step = 'form' | 'checkout' | 'success';

const KARMA_REDEMPTION_TARGET = 100;
const KARMA_MAX_DISCOUNT_RATE = 0.20;

const estimateRewardPoints = (amount: number) => {
    if (!amount || amount <= 0) return 0;
    return Math.min(500, Math.max(5, Math.floor(amount / 100)));
};

const getStoredItem = async (key: string) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
};

export const OrderReceiptScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { service, orderId: routeOrderId } = route.params || {}; // We expect the service object
    const normalizedRouteOrderId = routeOrderId ? String(routeOrderId) : '';
    const initialOrderId = normalizedRouteOrderId &&
        !normalizedRouteOrderId.startsWith('MOCK-') &&
        !['undefined', 'null', 'new'].includes(normalizedRouteOrderId.toLowerCase())
        ? normalizedRouteOrderId
        : null;
    
    const [step, setStep] = useState<Step>('checkout');
    const [formFields, setFormFields] = useState<any[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [sharePhone, setSharePhone] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Receipt/Success state
    const [orderId, setOrderId] = useState<string | null>(initialOrderId);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [rated, setRated] = useState(false);
    const [paymentTrackingId, setPaymentTrackingId] = useState<string | null>(null);
    const [karmaBalance, setKarmaBalance] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [useRewardDiscount, setUseRewardDiscount] = useState(false);
    const [createdOrder, setCreatedOrder] = useState<any>(null);
    const [earnedPoints, setEarnedPoints] = useState(0);
    const [preferredCurrency, setPreferredCurrency] = useState('KES');
    const { convertPrice, formatCurrency } = useCurrency();

    const listingPrice = Number(service?.price || 0);
    const maxDiscountByOrder = Math.floor(listingPrice * KARMA_MAX_DISCOUNT_RATE);
    const maxRedeemablePoints = Math.min(karmaBalance, maxDiscountByOrder);
    const hasRewardTarget = karmaBalance >= KARMA_REDEMPTION_TARGET;
    const canRedeemRewards = hasRewardTarget && maxRedeemablePoints >= KARMA_REDEMPTION_TARGET;
    const pointsToRedeem = useRewardDiscount && canRedeemRewards ? maxRedeemablePoints : 0;
    const estimatedDiscount = pointsToRedeem;
    const orderDiscount = Number(createdOrder?.discount_amount ?? discount ?? estimatedDiscount);
    const orderTotal = Number(createdOrder?.amount ?? Math.max(listingPrice - estimatedDiscount, 1));
    const orderCommission = Number(createdOrder?.commission ?? Math.max(orderTotal - (orderTotal / 1.235), 0));
    const estimatedEarnedPoints = earnedPoints || estimateRewardPoints(orderTotal);

    useEffect(() => {
        initFlow();
    }, []);

    const initFlow = async () => {
        try {
            if (!service) return;

            // Fetch User for preferred currency and Karma
            const userStr = await getStoredItem('userInfo') || await getStoredItem('user');
            if (userStr) {
                const userObj = JSON.parse(userStr);
                setPreferredCurrency(userObj.preferred_currency || 'KES');
            }

            const userRes = await client.get('/users/me');
            setKarmaBalance(userRes.data.available_karma || 0);

            // Fetch Form Fields if it's an event
            if (service.category === 'events & programs') {
                const fields = await getServiceFormFields(service.id);
                if (fields && fields.length > 0) {
                    setFormFields(fields);
                    setStep('form');
                }
            }
        } catch (error) {
            console.error('Error initializing checkout:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = () => {
        // Validate required fields
        for (const field of formFields) {
            if (field.is_required && !answers[field.id]) {
                Alert.alert(t('checkout.required_field'), t('checkout.required_answer', { label: field.label }));
                return;
            }
        }
        setStep('checkout');
    };

    const openPaymentUrl = async (url: string, checkoutWindow?: any) => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            if (checkoutWindow && !checkoutWindow.closed) {
                checkoutWindow.location.href = url;
                checkoutWindow.focus?.();
                return true;
            }
            window.location.href = url;
            return true;
        }

        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) return false;
        await Linking.openURL(url);
        return true;
    };

    const handlePlaceOrder = async () => {
        let checkoutWindow: any = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            checkoutWindow = window.open('', '_blank');
            if (checkoutWindow) {
                checkoutWindow.document.title = 'Lovedogs 360 Checkout';
                checkoutWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">Opening secure checkout...</p>';
            }
        }

        setSubmitting(true);
        try {
            const orderData = {
                service_id: service.id,
                share_phone: sharePhone,
                karma_points_to_redeem: pointsToRedeem,
                form_responses: Object.entries(answers).map(([field_id, value]) => ({
                    field_id,
                    answer_value: value
                }))
            };

            // Step 1: Create the order, unless this screen was opened with an existing unpaid order.
            let newOrderId = orderId;
            let payableAmount = createdOrder?.amount || service.price;
            if (!newOrderId) {
                const result = await createOrder(orderData);
                newOrderId = result.id;
                payableAmount = result.amount;
                setOrderId(newOrderId);
                setCreatedOrder(result);
                setDiscount(result.discount_amount || 0);
                if (result.karma_points_redeemed) {
                    setKarmaBalance((current) => Math.max(current - result.karma_points_redeemed, 0));
                }
            }

            // Step 2: Get user info for payment initiation
            const userRes = await client.get('/users/me');
            const userEmail = userRes.data.email;
            const userPhone = userRes.data.phone_number || '0700000000';

            // Step 3: Initiate payment with Pesapal
            const paymentRes = await initiatePayment(
                newOrderId,
                payableAmount,
                userEmail,
                userPhone
            );

            if (paymentRes.redirect_url) {
                setPaymentTrackingId(paymentRes.order_tracking_id || paymentRes.OrderTrackingId || null);
                // Step 4: Redirect to Pesapal secure checkout page
                const opened = await openPaymentUrl(paymentRes.redirect_url, checkoutWindow);
                if (opened) {
                    Alert.alert(
                        t('common.success'),
                        t('checkout.payment_opened', { defaultValue: 'Payment page opened. Complete payment, then return here for your receipt.' })
                    );
                    setStep('success');
                } else {
                    Alert.alert(t('common.error'), t('checkout.payment_open_error'));
                }
            } else if (paymentRes.payment_success) {
                if (checkoutWindow && !checkoutWindow.closed) {
                    checkoutWindow.close();
                }
                setPaymentTrackingId(paymentRes.order_tracking_id || paymentRes.OrderTrackingId || null);
                setStep('success');
                Alert.alert(
                    t('common.success'),
                    t('checkout.payment_already_confirmed', { defaultValue: 'Payment is already confirmed. Your receipt is ready.' })
                );
            } else {
                throw new Error(t('checkout.no_payment_url'));
            }
        } catch (error: any) {
            if (checkoutWindow && !checkoutWindow.closed) {
                checkoutWindow.close();
            }
            console.error('Order/Payment creation error:', error);
            const detail = error.response?.data?.detail || t('checkout.process_failed');
            Alert.alert(t('checkout.payment_failed'), typeof detail === 'string' ? detail : JSON.stringify(detail));
        } finally {
            setSubmitting(false);
        }
    };

    const isPaidStatus = (status?: string) => {
        return ['paid', 'completed', 'settled'].includes(String(status || '').toLowerCase());
    };

    const verifyPaymentStatus = async () => {
        if (!orderId) {
            Alert.alert(t('common.error'), t('marketplace.orders.missing_order', { defaultValue: 'Order not found. Please try again.' }));
            return false;
        }

        try {
            const res = await client.get(`/payments/status/${orderId}`, {
                params: paymentTrackingId ? { tracking_id: paymentTrackingId } : {}
            });
            const isPaid = Boolean(res.data?.payment_success) || isPaidStatus(res.data?.order_status);
            setEarnedPoints(res.data?.buyer_reward_points || 0);
            if (res.data?.discount_amount !== undefined) {
                setDiscount(res.data.discount_amount || 0);
            }
            if (!isPaid) {
                Alert.alert(
                    t('checkout.payment_failed'),
                    t('checkout.payment_not_confirmed', { defaultValue: 'Payment is not confirmed yet. If you just paid, wait a moment and try again.' })
                );
            }
            return isPaid;
        } catch (error: any) {
            const detail = error.response?.data?.detail || t('checkout.process_failed');
            Alert.alert(t('checkout.payment_failed'), typeof detail === 'string' ? detail : JSON.stringify(detail));
            return false;
        }
    };

    const downloadReceipt = async () => {
        if (!orderId) {
            Alert.alert(t('common.error'), t('marketplace.orders.missing_order', { defaultValue: 'Order not found. Please try again.' }));
            return;
        }
        setIsDownloading(true);
        try {
            const isPaid = await verifyPaymentStatus();
            if (!isPaid) return;

            await downloadOrderReceipt(orderId);
            Alert.alert(t('common.success'), t('marketplace.orders.success_download', { defaultValue: 'PDF receipt is ready.' }));
        } catch (error: any) {
            const detail = error.response?.data?.detail || error.message || t('marketplace.orders.error_download_failed');
            Alert.alert(t('common.error'), typeof detail === 'string' ? detail : JSON.stringify(detail));
        } finally {
            setIsDownloading(false);
        }
    };

    const submitRating = async () => {
        if (!orderId) {
            Alert.alert(t('common.error'), t('marketplace.orders.missing_order', { defaultValue: 'Order not found. Please try again.' }));
            return;
        }
        if (rating === 0) {
            Alert.alert(t('common.error'), t('marketplace.orders.select_rating', { defaultValue: 'Please select a rating first.' }));
            return;
        }
        setSubmitting(true);
        try {
            const isPaid = await verifyPaymentStatus();
            if (!isPaid) return;

            await client.post('/ratings', {
                order_id: orderId,
                rated_id: service.provider_id,
                score: rating,
                comment: comment
            });
            setRated(true);
            Alert.alert(t('common.success'), t('marketplace.orders.success_rating'));
        } catch (error: any) {
            const detail = error.response?.data?.detail || t('marketplace.orders.error_rating');
            Alert.alert(t('common.error'), typeof detail === 'string' ? detail : JSON.stringify(detail));
        } finally {
            setSubmitting(false);
        }
    };

    const goBackAfterPayment = () => {
        if (navigation.canGoBack?.()) {
            navigation.goBack();
            return;
        }

        if (navigation.reset) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'Main', params: { screen: 'Marketplace' } }],
            });
            return;
        }

        navigation.navigate?.('Main', { screen: 'Marketplace' });
    };

    const renderFormField = (field: any) => {
        const val = answers[field.id] || '';
        
        return (
            <View key={field.id} style={styles.formFieldContainer}>
                <Text style={styles.fieldLabel}>
                    {field.label} {field.is_required && <Text style={{color: COLORS.error}}>*</Text>}
                </Text>
                
                {field.field_type === 'long_answer' ? (
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        multiline
                        numberOfLines={3}
                        value={val}
                        onChangeText={(text) => setAnswers({...answers, [field.id]: text})}
                        placeholder={t('checkout.your_answer')}
                    />
                ) : field.field_type === 'dropdown' || field.field_type === 'multiple_choice' ? (
                    <View style={styles.optionsWrapper}>
                        {field.options?.map((opt: any, idx: number) => (
                            <TouchableOpacity 
                                key={idx} 
                                style={[styles.optionItem, val === opt.value && styles.optionItemActive]}
                                onPress={() => setAnswers({...answers, [field.id]: opt.value})}
                            >
                                <Ionicons 
                                    name={val === opt.value ? "radio-button-on" : "radio-button-off"} 
                                    size={18} 
                                    color={val === opt.value ? COLORS.primary : COLORS.textSecondary} 
                                />
                                <Text style={[styles.optionText, val === opt.value && styles.optionTextActive]}>{opt.value}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : field.field_type === 'scale' ? (
                    <View style={styles.scaleWrapper}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <TouchableOpacity 
                                key={n} 
                                style={[styles.scaleItem, val === String(n) && styles.scaleItemActive]}
                                onPress={() => setAnswers({...answers, [field.id]: String(n)})}
                            >
                                <Text style={[styles.scaleText, val === String(n) && styles.scaleTextActive]}>{n}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <TextInput
                        style={styles.input}
                        value={val}
                        onChangeText={(text) => setAnswers({...answers, [field.id]: text})}
                        placeholder={t('checkout.your_answer')}
                    />
                )}
            </View>
        );
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
    );

    if (!service) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('checkout.review_pay')}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.center}>
                    <Text style={styles.missingText}>
                        {t('marketplace.orders.missing_order', { defaultValue: 'Order not found. Please return to the marketplace and try again.' })}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // STEP 1: Registration Form
    if (step === 'form') {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('checkout.registration_info')}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.formIntro}>
                        <Ionicons name="information-circle-outline" size={40} color={COLORS.primary} />
                        <Text style={styles.formIntroTitle}>{service.title}</Text>
                        <Text style={styles.formIntroSubtitle}>{t('checkout.registration_intro')}</Text>
                    </View>
                    
                    {formFields.map(renderFormField)}
                    
                    <Button 
                        title={t('checkout.continue_checkout')}
                        onPress={handleFormSubmit}
                        style={{ marginTop: 20, marginBottom: 40 }}
                    />
                </ScrollView>
            </SafeAreaView>
        );
    }

    // STEP 2: Checkout / Privacy
    if (step === 'checkout') {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => formFields.length > 0 ? setStep('form') : navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('checkout.review_pay')}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.checkoutCard}>
                        <Text style={styles.checkoutServiceTitle}>{service.title}</Text>
                        <Text style={styles.checkoutCategory}>{service.category}</Text>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>{t('checkout.amount')}</Text>
                            <Text style={styles.priceValue}>
                                {formatCurrency(convertPrice(service.price, service.currency || 'KES', preferredCurrency), preferredCurrency)}
                            </Text>
                        </View>

                        <View style={styles.rewardsBox}>
                            <View style={styles.rewardsHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rewardsTitle}>
                                        {t('checkout.reward_points', { defaultValue: 'Reward points' })}
                                    </Text>
                                    <Text style={styles.rewardsText}>
                                        {karmaBalance} {t('community_hub.pts', { defaultValue: 'points' })} {t('checkout.available', { defaultValue: 'available' })}
                                    </Text>
                                </View>
                                <Switch
                                    value={useRewardDiscount}
                                    onValueChange={setUseRewardDiscount}
                                    disabled={!canRedeemRewards}
                                    trackColor={{ false: '#ddd', true: COLORS.primary }}
                                />
                            </View>
                            <Text style={styles.rewardsHint}>
                                {canRedeemRewards
                                    ? t('checkout.reward_discount_hint', {
                                        defaultValue: 'Use {{points}} points for {{amount}} off this order.',
                                        points: pointsToRedeem || maxRedeemablePoints,
                                        amount: formatCurrency(convertPrice(pointsToRedeem || maxRedeemablePoints, service.currency || 'KES', preferredCurrency), preferredCurrency)
                                    })
                                    : hasRewardTarget
                                        ? t('checkout.reward_order_too_small', {
                                            defaultValue: 'Rewards can cover up to 20% of an order, so use them on a larger order.'
                                        })
                                    : t('checkout.reward_target_hint', {
                                        defaultValue: 'Reach {{target}} points to redeem future order discounts.',
                                        target: KARMA_REDEMPTION_TARGET
                                    })}
                            </Text>
                            {useRewardDiscount && canRedeemRewards && (
                                <View style={styles.priceRowCompact}>
                                    <Text style={styles.discountLabel}>{t('checkout.discount', { defaultValue: 'Discount' })}</Text>
                                    <Text style={styles.discountValue}>
                                        -{formatCurrency(convertPrice(estimatedDiscount, service.currency || 'KES', preferredCurrency), preferredCurrency)}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.priceRowCompact}>
                                <Text style={styles.rewardEarnLabel}>{t('checkout.earn_after_payment', { defaultValue: 'Earn after payment' })}</Text>
                                <Text style={styles.rewardEarnValue}>
                                    {estimateRewardPoints(Math.max(service.price - estimatedDiscount, 1))} {t('community_hub.pts', { defaultValue: 'points' })}
                                </Text>
                            </View>
                        </View>
                        
                        <View style={styles.privacyRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.privacyTitle}>{t('checkout.share_phone')}</Text>
                                <Text style={styles.privacySubtitle}>{t('checkout.share_phone_subtitle')}</Text>
                            </View>
                            <Switch 
                                value={sharePhone}
                                onValueChange={setSharePhone}
                                trackColor={{ false: '#ddd', true: COLORS.primary }}
                            />
                        </View>
                    </View>

                    {/* Security Information */}
                    <View style={styles.securityCard}>
                        <View style={styles.securityHeader}>
                            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
                            <Text style={styles.securityTitle}>{t('checkout.secure_card')}</Text>
                        </View>
                        <Text style={styles.securityText}>
                            {t('checkout.secure_text')}
                        </Text>
                        <Text style={styles.securityBadge}>{t('checkout.pci_badge')}</Text>
                    </View>

                    <Button 
                        title={submitting ? t('checkout.processing') : t('checkout.proceed_secure')}
                        onPress={handlePlaceOrder}
                        loading={submitting}
                        style={{ marginTop: 10 }}
                    />
                    
                    <Text style={styles.termsText}>
                        {t('checkout.terms')}
                    </Text>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // STEP 3: Success / Receipt
    return (
        <ThemeBackground>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={goBackAfterPayment} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('marketplace.orders.summary')}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.successIcon}>
                        <Ionicons name="checkmark-circle" size={80} color={COLORS.primary} />
                        <Text style={styles.successText}>{t('marketplace.orders.success')}</Text>
                    </View>

                    <View style={styles.receiptCard}>
                        <Text style={styles.receiptTitle}>{service.title}</Text>
                        <Text style={styles.receiptOrderId}>{t('marketplace.orders.id')} {orderId}</Text>

                        <View style={styles.divider} />

                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>{t('marketplace.orders.item_price', { defaultValue: 'Listing Price' })}</Text>
                            <Text style={styles.rowValue}>
                                {formatCurrency(convertPrice(listingPrice, service.currency || 'KES', preferredCurrency), preferredCurrency)}
                            </Text>
                        </View>
                        {orderDiscount > 0 && (
                            <View style={styles.row}>
                                <Text style={styles.rowLabel}>
                                    {t('checkout.points_discount', { defaultValue: 'Points Discount' })}
                                </Text>
                                <Text style={styles.discountValue}>
                                    -{formatCurrency(convertPrice(orderDiscount, service.currency || 'KES', preferredCurrency), preferredCurrency)}
                                </Text>
                            </View>
                        )}
                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>
                                {t('marketplace.orders.platform_fee_235', { defaultValue: 'Platform Fee (23.5%)' })}
                            </Text>
                            <Text style={styles.rowValue}>
                                {formatCurrency(convertPrice(orderCommission, service.currency || 'KES', preferredCurrency), preferredCurrency)}
                            </Text>
                        </View>

                        <View style={[styles.row, { marginTop: 10 }]}>
                            <Text style={styles.totalLabel}>{t('marketplace.orders.total')}</Text>
                            <Text style={styles.totalValue}>
                                {formatCurrency(convertPrice(orderTotal, service.currency || 'KES', preferredCurrency), preferredCurrency)}
                            </Text>
                        </View>
                        <View style={styles.pointsEarnedRow}>
                            <Ionicons name="sparkles-outline" size={16} color={COLORS.primary} />
                            <Text style={styles.pointsEarnedText}>
                                {t('checkout.points_earned_after_payment', {
                                    defaultValue: 'Points earned from this purchase: {{points}}',
                                    points: estimatedEarnedPoints
                                })}
                            </Text>
                        </View>
                    </View>

                    <Button
                        title={isDownloading ? t('marketplace.orders.downloading') : t('marketplace.orders.download')}
                        onPress={downloadReceipt}
                        variant="primary"
                        style={styles.downloadBtn}
                        loading={isDownloading}
                    />

                    {!rated ? (
                        <View style={styles.ratingSection}>
                            <Text style={styles.ratingTitle}>{t('marketplace.orders.rating_title')}</Text>
                            <View style={styles.starRow}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <TouchableOpacity key={s} onPress={() => setRating(s)}>
                                        <Ionicons name={s <= rating ? "star" : "star-outline"} size={32} color={s <= rating ? "#FFD700" : "#ccc"} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Button
                                title={t('marketplace.orders.submit_rating')}
                                onPress={submitRating}
                                variant="outline"
                                style={styles.submitBtn}
                                loading={submitting}
                            />
                        </View>
                    ) : (
                        <View style={styles.ratingSection}>
                            <Text style={styles.thanksText}>{t('marketplace.orders.thanks')}</Text>
                        </View>
                    )}

                    <Button
                        title={t('checkout.back_to_marketplace', { defaultValue: 'Back to Marketplace' })}
                        onPress={goBackAfterPayment}
                        variant="outline"
                        style={styles.returnBtn}
                    />
                </ScrollView>
            </SafeAreaView>
        </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    missingText: { color: COLORS.textSecondary, fontSize: 15, paddingHorizontal: 24, textAlign: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    backButton: { padding: 4 },
    scrollContent: { padding: SPACING.lg },
    formIntro: { alignItems: 'center', marginBottom: 25 },
    formIntroTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginTop: 10, textAlign: 'center' },
    formIntroSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 5 },
    formFieldContainer: { marginBottom: 20 },
    fieldLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
    input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, fontSize: 16 },
    textArea: { height: 100, textAlignVertical: 'top' },
    optionsWrapper: { marginTop: 4 },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fcfcfc', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
    optionItemActive: { borderColor: COLORS.primary, backgroundColor: '#f0f4ff' },
    optionText: { fontSize: 14, color: COLORS.text, marginLeft: 10 },
    optionTextActive: { fontWeight: 'bold', color: COLORS.primary },
    scaleWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 5 },
    scaleItem: { width: '18%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#f9f9f9', marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
    scaleItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    scaleText: { fontSize: 14, color: COLORS.text },
    scaleTextActive: { color: '#fff', fontWeight: 'bold' },
    checkoutCard: { backgroundColor: '#fff', borderRadius: 15, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 20 },
    checkoutServiceTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    checkoutCategory: { fontSize: 13, color: COLORS.primary, marginTop: 2, textTransform: 'uppercase', fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    priceLabel: { fontSize: 16, color: COLORS.textSecondary },
    priceValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    priceRowCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    rewardsBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, marginBottom: 16 },
    rewardsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rewardsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
    rewardsText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    rewardsHint: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginTop: 8 },
    discountLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
    discountValue: { fontSize: 14, color: '#2E7D32', fontWeight: '800' },
    rewardEarnLabel: { fontSize: 12, color: COLORS.textSecondary },
    rewardEarnValue: { fontSize: 12, color: COLORS.primary, fontWeight: '800' },
    privacyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 10 },
    privacyTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
    privacySubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
    securityCard: { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 15, borderLeftWidth: 4, borderLeftColor: COLORS.primary, marginBottom: 20 },
    securityHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    securityTitle: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginLeft: 8 },
    securityText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 8 },
    securityBadge: { fontSize: 11, fontWeight: '600', color: COLORS.primary, textAlign: 'center' },
    termsText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 20, paddingHorizontal: 20, lineHeight: 18 },
    successIcon: { alignItems: 'center', marginBottom: 20 },
    successText: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary, marginTop: 10 },
    receiptCard: { backgroundColor: '#fff', borderRadius: 15, padding: 20, elevation: 2, marginBottom: 20 },
    receiptTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' },
    receiptOrderId: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
    rowLabel: { fontSize: 14, color: COLORS.textSecondary },
    rowValue: { fontSize: 14, color: COLORS.text },
    totalLabel: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    totalValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    pointsEarnedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, backgroundColor: '#F0F4FF', padding: 10, borderRadius: 10 },
    pointsEarnedText: { fontSize: 12, color: COLORS.primary, fontWeight: '700', flexShrink: 1 },
    downloadBtn: { width: '100%', marginBottom: 20 },
    ratingSection: { backgroundColor: '#fff', borderRadius: 15, padding: 20, alignItems: 'center' },
    ratingTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 15 },
    starRow: { flexDirection: 'row', marginBottom: 20 },
    submitBtn: { width: '100%' },
    returnBtn: { width: '100%', marginTop: 16 },
    thanksText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary }
});
