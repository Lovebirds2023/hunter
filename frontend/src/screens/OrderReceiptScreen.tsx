import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { ThemeBackground } from '../components/ThemeBackground';
import { Button } from '../components/Button';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';
import { getServiceFormFields, createOrder } from '../api/marketplace';
import { useCurrency } from '../context/CurrencyContext';

type Step = 'form' | 'checkout' | 'success';

export const OrderReceiptScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { service } = route.params; // We expect the service object
    
    const [step, setStep] = useState<Step>('checkout');
    const [formFields, setFormFields] = useState<any[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [sharePhone, setSharePhone] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Receipt/Success state
    const [orderId, setOrderId] = useState<string | null>(null);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [rated, setRated] = useState(false);
    const [karmaBalance, setKarmaBalance] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [preferredCurrency, setPreferredCurrency] = useState('KES');
    const { convertPrice, formatCurrency } = useCurrency();

    useEffect(() => {
        initFlow();
    }, []);

    const initFlow = async () => {
        try {
            // Fetch User for preferred currency and Karma
            const userStr = await SecureStore.getItemAsync('user');
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
                Alert.alert("Required Field", `Please answer: ${field.label}`);
                return;
            }
        }
        setStep('checkout');
    };

    const handlePlaceOrder = async () => {
        setSubmitting(true);
        try {
            const orderData = {
                service_id: service.id,
                share_phone: sharePhone,
                form_responses: Object.entries(answers).map(([field_id, value]) => ({
                    field_id,
                    answer_value: value
                }))
            };

            const result = await createOrder(orderData);
            setOrderId(result.id);
            setStep('success');
            Alert.alert("Success", "Your booking has been placed successfully!");
        } catch (error: any) {
            console.error('Order creation error:', error);
            const detail = error.response?.data?.detail || "Could not complete booking.";
            Alert.alert("Booking Failed", detail);
        } finally {
            setSubmitting(false);
        }
    };

    const downloadReceipt = async () => {
        if (!orderId) return;
        setIsDownloading(true);
        try {
            const fileUri = `${FileSystem.documentDirectory}receipt_${orderId}.pdf`;
            const downloadRes = await FileSystem.downloadAsync(
                `${client.defaults.baseURL}/orders/${orderId}/receipt`,
                fileUri
            );
            if (downloadRes.status === 200) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert(t('common.error'), t('orders.error_download'));
            }
        } catch (error) {
            Alert.alert(t('common.error'), t('orders.error_download_failed'));
        } finally {
            setIsDownloading(false);
        }
    };

    const submitRating = async () => {
        if (!orderId || rating === 0) return;
        setSubmitting(true);
        try {
            await client.post('/ratings', {
                order_id: orderId,
                rated_id: service.provider_id,
                score: rating,
                comment: comment
            });
            setRated(true);
            Alert.alert(t('common.success'), t('orders.success_rating'));
        } catch (error) {
            Alert.alert(t('common.error'), t('orders.error_rating'));
        } finally {
            setSubmitting(false);
        }
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
                        placeholder="Your answer..."
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
                        placeholder="Your answer..."
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

    // STEP 1: Registration Form
    if (step === 'form') {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Registration Info</Text>
                    <View style={{ width: 40 }} />
                </View>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.formIntro}>
                        <Ionicons name="information-circle-outline" size={40} color={COLORS.primary} />
                        <Text style={styles.formIntroTitle}>{service.title}</Text>
                        <Text style={styles.formIntroSubtitle}>The organizer requires the following information to process your booking.</Text>
                    </View>
                    
                    {formFields.map(renderFormField)}
                    
                    <Button 
                        title="Continue to Checkout" 
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
                    <TouchableOpacity onPress={() => setFormFields.length > 0 ? setStep('form') : navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Review & Pay</Text>
                    <View style={{ width: 40 }} />
                </View>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.checkoutCard}>
                        <Text style={styles.checkoutServiceTitle}>{service.title}</Text>
                        <Text style={styles.checkoutCategory}>{service.category}</Text>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Amount</Text>
                            <Text style={styles.priceValue}>
                                {formatCurrency(convertPrice(service.price, service.currency || 'KES', preferredCurrency), preferredCurrency)}
                            </Text>
                        </View>
                        
                        <View style={styles.privacyRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.privacyTitle}>Share Phone Number</Text>
                                <Text style={styles.privacySubtitle}>Allow provider to contact you for service updates.</Text>
                            </View>
                            <Switch 
                                value={sharePhone}
                                onValueChange={setSharePhone}
                                trackColor={{ false: '#ddd', true: COLORS.primary }}
                            />
                        </View>
                    </View>

                    <Button 
                        title={submitting ? "Processing..." : `Confirm & Pay ${formatCurrency(convertPrice(service.price, service.currency || 'KES', preferredCurrency), preferredCurrency)}`}
                        onPress={handlePlaceOrder}
                        loading={submitting}
                        style={{ marginTop: 10 }}
                    />
                    
                    <Text style={styles.termsText}>
                        By clicking confirm, you agree to the marketplace terms. Service providers will handle your registration data securely.
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
                    <TouchableOpacity onPress={() => navigation.replace('Marketplace')} style={styles.backButton}>
                        <Ionicons name="close" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('orders.summary')}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.successIcon}>
                        <Ionicons name="checkmark-circle" size={80} color={COLORS.primary} />
                        <Text style={styles.successText}>{t('orders.success')}</Text>
                    </View>

                    <View style={styles.receiptCard}>
                        <Text style={styles.receiptTitle}>{service.title}</Text>
                        <Text style={styles.receiptOrderId}>{t('orders.id')} {orderId}</Text>

                        <View style={styles.divider} />

                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>{t('orders.item_price')}</Text>
                            <Text style={styles.rowValue}>
                                {formatCurrency(convertPrice((service.price / 1.235), service.currency || 'KES', preferredCurrency), preferredCurrency)}
                            </Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>{t('orders.fee')}</Text>
                            <Text style={styles.rowValue}>
                                {formatCurrency(convertPrice((service.price - (service.price / 1.235)), service.currency || 'KES', preferredCurrency), preferredCurrency)}
                            </Text>
                        </View>

                        <View style={[styles.row, { marginTop: 10 }]}>
                            <Text style={styles.totalLabel}>{t('orders.total')}</Text>
                            <Text style={styles.totalValue}>
                                {formatCurrency(convertPrice(service.price, service.currency || 'KES', preferredCurrency), preferredCurrency)}
                            </Text>
                        </View>
                    </View>

                    <Button
                        title={isDownloading ? t('orders.downloading') : t('orders.download')}
                        onPress={downloadReceipt}
                        variant="primary"
                        style={styles.downloadBtn}
                        loading={isDownloading}
                    />

                    {!rated ? (
                        <View style={styles.ratingSection}>
                            <Text style={styles.ratingTitle}>{t('orders.rating_title')}</Text>
                            <View style={styles.starRow}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <TouchableOpacity key={s} onPress={() => setRating(s)}>
                                        <Ionicons name={s <= rating ? "star" : "star-outline"} size={32} color={s <= rating ? "#FFD700" : "#ccc"} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Button
                                title={t('orders.submit_rating')}
                                onPress={submitRating}
                                variant="outline"
                                style={styles.submitBtn}
                                loading={submitting}
                            />
                        </View>
                    ) : (
                        <View style={styles.ratingSection}>
                            <Text style={styles.thanksText}>{t('orders.thanks')}</Text>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    privacyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 10 },
    privacyTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
    privacySubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
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
    downloadBtn: { width: '100%', marginBottom: 20 },
    ratingSection: { backgroundColor: '#fff', borderRadius: 15, padding: 20, alignItems: 'center' },
    ratingTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 15 },
    starRow: { flexDirection: 'row', marginBottom: 20 },
    submitBtn: { width: '100%' },
    thanksText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary }
});
