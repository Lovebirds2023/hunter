import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Button, ScrollView, Alert, Modal, TouchableOpacity, Image, Linking, Platform, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { getEvent, registerForEvent, toggleSaveEvent, getEventFormFields, initiateEventRegistrationPayment, getEventRegistrationPaymentStatus } from '../api/events';
import { getMyDogs } from '../api/dogs';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Picker } from '@react-native-picker/picker';
import { Switch, TextInput } from 'react-native';

export const EventDetailScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const { eventId } = route.params;
    const { userInfo: user } = useAuth();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dogs, setDogs] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDog, setSelectedDog] = useState(null);
    const [formFields, setFormFields] = useState([]);
    const [formResponses, setFormResponses] = useState({});
    const [sharePhone, setSharePhone] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [paymentTrackingId, setPaymentTrackingId] = useState(null);
    const [paymentLoading, setPaymentLoading] = useState(false);

    const [myRegistration, setMyRegistration] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Fetch event, my dogs, AND my registrations to check status
            const [eventData, dogsData, myRegs, savedData, fieldsData] = await Promise.all([
                getEvent(eventId),
                getMyDogs(),
                client.get('/my-registrations').then(res => res.data),
                client.get('/saved-events').then(res => res.data),
                getEventFormFields(eventId)
            ]);
            setEvent(eventData);
            setDogs(dogsData);
            setFormFields(fieldsData || []);

            // Check if saved
            const savedItem = savedData?.find(s => s.event_id === eventId);
            setIsSaved(!!savedItem);

            // Find if I am registered
            const reg = myRegs.find(r => r.event_id === eventId);
            setMyRegistration(reg);
            setPaymentTrackingId(reg?.pesapal_tracking_id || null);

        } catch (error) {
            console.error(error);
            Alert.alert(t('common.error'), t('event_detail.load_error'));
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        // Not used by the user, this is now handled by Admin Scanner
    };

    const handleToggleSave = async () => {
        try {
            setIsSaved(!isSaved); // Optimistic UI
            await toggleSaveEvent(eventId);
        } catch (error) {
            setIsSaved(!isSaved); // Revert on failure
            console.error('Failed to toggle save event:', error);
        }
    };

    const openPaymentUrl = async (url) => {
        if (!url) return false;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const opened = window.open(url, '_blank', 'noopener,noreferrer');
            return !!opened;
        }
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) return false;
        await Linking.openURL(url);
        return true;
    };

    const startEventPayment = async (registration) => {
        if (!registration?.id) return;
        setPaymentLoading(true);
        try {
            const paymentRes = await initiateEventRegistrationPayment(
                registration.id,
                user?.email || '',
                user?.phone_number || '0700000000'
            );
            const trackingId = paymentRes.order_tracking_id || paymentRes.OrderTrackingId || null;
            setPaymentTrackingId(trackingId);
            if (paymentRes.redirect_url) {
                const opened = await openPaymentUrl(paymentRes.redirect_url);
                if (opened) {
                    Alert.alert('Payment opened', 'Complete payment in Pesapal, then return here and tap Confirm payment.');
                } else {
                    Alert.alert('Error', 'Could not open the Pesapal checkout page.');
                }
            } else if (paymentRes.payment_success) {
                await loadData();
            } else {
                Alert.alert('Error', 'Pesapal did not return a checkout link.');
            }
        } catch (error) {
            Alert.alert('Payment failed', error.response?.data?.detail || 'Could not start payment.');
        } finally {
            setPaymentLoading(false);
        }
    };

    const verifyEventPayment = async () => {
        if (!myRegistration?.id) return;
        setPaymentLoading(true);
        try {
            const res = await getEventRegistrationPaymentStatus(myRegistration.id, paymentTrackingId);
            if (res.payment_success) {
                Alert.alert('Payment confirmed', 'Your event ticket is ready.');
                await loadData();
            } else {
                Alert.alert('Not confirmed yet', 'If you just paid, wait a moment and try again.');
            }
        } catch (error) {
            Alert.alert('Payment check failed', error.response?.data?.detail || 'Could not verify payment.');
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!selectedDog && dogs.length > 0) {
            // Optional warning
        }

        // Validate custom fields
        for (const field of formFields) {
            if (field.is_required && !formResponses[field.id]) {
                Alert.alert(t('event_detail.validation_error'), t('event_detail.required_question', { label: field.label }));
                return;
            }
        }

        try {
            const formattedResponses = Object.keys(formResponses).map(fieldId => ({
                field_id: fieldId,
                answer_value: formResponses[fieldId]
            }));

            const registration = await registerForEvent(eventId, {
                event_id: eventId,
                dog_id: selectedDog ? selectedDog.id : null,
                role: 'attendee',
                share_phone: sharePhone,
                form_responses: formattedResponses
            });
            setModalVisible(false);
            if (registration.payment_status === 'pending') {
                setMyRegistration(registration);
                await startEventPayment(registration);
            } else {
                Alert.alert(t('common.success'), t('event_detail.register_success'));
            }
            loadData(); // Refresh to show Check-in button
        } catch (error) {
            Alert.alert(t('common.error'), error.response?.data?.detail || t('event_detail.registration_failed'));
        }
    };

    if (loading || !event) return <View style={styles.center}><Text>{t('common.loading')}</Text></View>;

    const ticketPrice = Number(event.ticket_price || 0);
    const priceLabel = ticketPrice > 0 ? `${event.currency || 'KES'} ${ticketPrice.toLocaleString()}` : 'Free';
    const pendingPayment = myRegistration && (
        String(myRegistration.payment_status || '').toLowerCase() === 'pending' ||
        myRegistration.status === 'pending_payment'
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('event_detail.title')}</Text>
                <TouchableOpacity onPress={handleToggleSave} style={styles.saveButton}>
                    <Ionicons name={isSaved ? "heart" : "heart-outline"} size={26} color={isSaved ? "#D4AF37" : COLORS.primary} />
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.container}>
                {event.poster_url && (
                    <Image source={{ uri: event.poster_url }} style={styles.posterImage} resizeMode="cover" />
                )}
                <Text style={styles.title}>{event.title}</Text>
                <View style={styles.metaPills}>
                    <View style={[styles.pricePill, ticketPrice > 0 ? styles.paidPill : styles.freePill]}>
                        <Ionicons name={ticketPrice > 0 ? 'card-outline' : 'gift-outline'} size={14} color={ticketPrice > 0 ? '#0f7a39' : COLORS.primary} />
                        <Text style={[styles.pricePillText, { color: ticketPrice > 0 ? '#0f7a39' : COLORS.primary }]}>{priceLabel}</Text>
                    </View>
                    {event.is_pinned && (
                        <View style={styles.pinPill}>
                            <Ionicons name="pin" size={13} color={COLORS.primaryDark} />
                            <Text style={styles.pinPillText}>Priority</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.time}>{new Date(event.start_time).toLocaleString()}</Text>
                <Text style={styles.location}>{event.location}</Text>
                <Text style={styles.description}>{event.description}</Text>

                {event.scorecard_enabled !== false && (
                    <View style={styles.scorecardSection}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="clipboard-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.scorecardTitle}>Mbwa Rafiki Coexistence Scorecard</Text>
                        </View>
                        <Text style={styles.scorecardText}>
                            Share baseline or follow-up data for knowledge, attitudes, wellbeing, dog welfare, environment, and social cohesion reporting.
                        </Text>
                        <View style={styles.scorecardActions}>
                            <TouchableOpacity
                                style={styles.scorecardBtn}
                                onPress={() => navigation.navigate('ScorecardSurvey', { eventId: event.id, eventTitle: event.title, surveyType: 'baseline' })}
                            >
                                <Text style={styles.scorecardBtnText}>Baseline Survey</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.scorecardBtn, { backgroundColor: '#4a90e2' }]}
                                onPress={() => navigation.navigate('ScorecardSurvey', { eventId: event.id, eventTitle: event.title, surveyType: 'followup' })}
                            >
                                <Text style={styles.scorecardBtnText}>Follow-up Survey</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={styles.footer}>
                    {myRegistration ? (
                        pendingPayment ? (
                            <View style={styles.paymentCard}>
                                <Ionicons name="card-outline" size={30} color={COLORS.primary} />
                                <Text style={styles.paymentTitle}>Complete payment to receive your ticket</Text>
                                <Text style={styles.paymentAmount}>{myRegistration.currency || event.currency || 'KES'} {Number(myRegistration.amount || ticketPrice || 0).toLocaleString()}</Text>
                                <Text style={styles.paymentCopy}>Your registration is saved, but the QR ticket is issued after Pesapal confirms payment.</Text>
                                <View style={styles.paymentActions}>
                                    <TouchableOpacity
                                        style={[styles.paymentBtn, paymentLoading && { opacity: 0.7 }]}
                                        onPress={() => startEventPayment(myRegistration)}
                                        disabled={paymentLoading}
                                    >
                                        {paymentLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.paymentBtnText}>Pay with Pesapal</Text>}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.verifyBtn, paymentLoading && { opacity: 0.7 }]}
                                        onPress={verifyEventPayment}
                                        disabled={paymentLoading}
                                    >
                                        <Text style={styles.verifyBtnText}>Confirm payment</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.ticketContainer}>
                                <Text style={styles.ticketTitle}>{t('event_detail.ticket_title')}</Text>
                                <Text style={styles.ticketSub}>{t('event_detail.ticket_subtitle')}</Text>

                                <View style={styles.qrCodeWrapper}>
                                    {myRegistration.ticket_token ? (
                                        <View style={{ opacity: myRegistration.status === 'checked-in' ? 0.4 : 1 }}>
                                            <QRCode
                                                value={myRegistration.ticket_token}
                                                size={200}
                                                color="#000"
                                                backgroundColor="#fff"
                                            />
                                        </View>
                                    ) : (
                                        <Text style={{ color: '#999' }}>{t('event_detail.generating_ticket')}</Text>
                                    )}

                                    {myRegistration.status === 'checked-in' && (
                                        <View style={styles.usedBadge}>
                                            <Text style={styles.usedBadgeText}>{t('event_detail.scanned')}</Text>
                                        </View>
                                    )}
                                </View>

                                <Text style={styles.ticketStatus}>
                                    {t('event_detail.status')}: {myRegistration.status === 'checked-in' ? t('event_detail.checked_in') : t('event_detail.valid')}
                                </Text>
                            </View>
                        )
                    ) : (
                        <Button
                            title={ticketPrice > 0 ? `Register and pay ${priceLabel}` : t('event_detail.register_now')}
                            onPress={() => setModalVisible(true)}
                            color={COLORS.primary}
                        />
                    )}
                </View>

                {/* Organizer/Admin Actions */}
                {user?.role === 'admin' && (
                    <View style={styles.adminSection}>
                        <Text style={styles.adminTitle}>{t('event_detail.organizer_tools')}</Text>
                        <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('EventFormBuilder', { eventId: event.id, eventTitle: event.title })}>
                            <Ionicons name="create-outline" size={20} color="#fff" />
                            <Text style={styles.adminBtnText}>{t('event_detail.edit_registration_form')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#4a90e2', marginTop: 10 }]} onPress={() => navigation.navigate('EventResponses', { eventId: event.id, eventTitle: event.title })}>
                            <Ionicons name="people-outline" size={20} color="#fff" />
                            <Text style={styles.adminBtnText}>{t('event_detail.view_responses')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalView}>
                        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
                            <Text style={styles.modalTitle}>{t('event_detail.registration_title')}</Text>
                            <View style={styles.modalPriceBox}>
                                <Text style={styles.modalPriceLabel}>Ticket</Text>
                                <Text style={styles.modalPriceValue}>{priceLabel}</Text>
                                {ticketPrice > 0 && <Text style={styles.modalPriceHelp}>Payment is completed securely through Pesapal after registration.</Text>}
                            </View>
                            
                            <View style={styles.profileSection}>
                                <Text style={styles.sectionTitle}>{t('event_detail.profile_details')}</Text>
                                <Text style={styles.profileText}>{t('event_detail.name')}: {user?.full_name || t('common.na')}</Text>
                                <Text style={styles.profileText}>{t('event_detail.email')}: {user?.email || t('common.na')}</Text>
                                
                                <View style={styles.switchRow}>
                                    <Text style={styles.profileText}>{t('event_detail.share_phone')}</Text>
                                    <Switch
                                        value={sharePhone}
                                        onValueChange={setSharePhone}
                                        trackColor={{ true: '#D4AF37', false: '#eee' }}
                                    />
                                </View>
                                {sharePhone && <Text style={styles.optionalText}>{t('event_detail.your_phone')}: {user?.phone_number || t('event_detail.phone_not_provided')}</Text>}
                            </View>

                            <View style={styles.profileSection}>
                                <Text style={styles.sectionTitle}>{t('event_detail.attending_dog')}</Text>
                                {dogs.length === 0 ? (
                                    <Text style={styles.optionalText}>{t('event_detail.no_dogs')}</Text>
                                ) : (
                                    dogs.map(dog => (
                                        <TouchableOpacity
                                            key={dog.id}
                                            style={[
                                                styles.dogOption,
                                                selectedDog?.id === dog.id && styles.selectedDog
                                            ]}
                                            onPress={() => setSelectedDog(selectedDog?.id === dog.id ? null : dog)}
                                        >
                                            <Text style={{ color: selectedDog?.id === dog.id ? 'white' : 'black' }}>{dog.name}</Text>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>

                            {formFields.length > 0 && (
                                <View style={styles.profileSection}>
                                    <Text style={styles.sectionTitle}>{t('event_detail.organizer_questions')}</Text>
                                    {formFields.map((field) => (
                                        <View key={field.id} style={styles.questionBlock}>
                                            <Text style={styles.questionLabel}>
                                                {field.label} {field.is_required && <Text style={{color: 'red'}}>*</Text>}
                                            </Text>
                                            
                                            {(field.field_type === 'short_answer' || field.field_type === 'scale') && (
                                                <TextInput
                                                    style={styles.textInput}
                                                    placeholder={field.field_type === 'scale' ? "1 - 10" : t('event_detail.your_answer')}
                                                    keyboardType={field.field_type === 'scale' ? "numeric" : "default"}
                                                    value={formResponses[field.id] || ''}
                                                    onChangeText={(t) => setFormResponses(prev => ({...prev, [field.id]: t}))}
                                                />
                                            )}

                                            {field.field_type === 'long_answer' && (
                                                <TextInput
                                                    style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                                                    multiline
                                                    placeholder={t('event_detail.your_answer')}
                                                    value={formResponses[field.id] || ''}
                                                    onChangeText={(t) => setFormResponses(prev => ({...prev, [field.id]: t}))}
                                                />
                                            )}

                                            {(field.field_type === 'dropdown' || field.field_type === 'multiple_choice') && (
                                                <View style={styles.pickerContainer}>
                                                    <Picker
                                                        selectedValue={formResponses[field.id] || ''}
                                                        onValueChange={(val) => setFormResponses(prev => ({...prev, [field.id]: val}))}
                                                    >
                                                        <Picker.Item label={t('event_detail.select_option')} value="" />
                                                        {field.options?.map((opt, i) => (
                                                            <Picker.Item key={i} label={opt.value} value={opt.value} />
                                                        ))}
                                                    </Picker>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.submitBtn} onPress={handleRegister}>
                                    <Text style={styles.submitBtnText}>{ticketPrice > 0 ? `Continue to payment (${priceLabel})` : t('event_detail.complete_registration')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 40, // Adjust for status bar
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    posterImage: { width: '100%', height: 220, borderRadius: 18, marginBottom: 18, backgroundColor: '#f0f0f0' },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, color: COLORS.primary, marginTop: 10 },
    metaPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    pricePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
    paidPill: { backgroundColor: '#e6f6ed', borderWidth: 1, borderColor: '#bde8cc' },
    freePill: { backgroundColor: '#fff8dc', borderWidth: 1, borderColor: '#f0d875' },
    pricePillText: { fontWeight: '900', fontSize: 12 },
    pinPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#D4AF37', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
    pinPillText: { color: COLORS.primaryDark, fontWeight: '900', fontSize: 12 },
    time: { fontSize: 16, color: '#555', marginBottom: 5 },
    location: { fontSize: 16, color: '#555', marginBottom: 20 },
    description: { fontSize: 16, lineHeight: 24 },
    footer: { marginTop: 30 },
    modalView: {
        margin: 20,
        marginTop: 100,
        backgroundColor: "white",
        borderRadius: 20,
        padding: 35,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    dogOption: {
        padding: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        marginBottom: 10,
        width: '100%',
        alignItems: 'center'
    },
    selectedDog: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary
    },
    ticketContainer: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e9ecef',
        marginTop: 20
    },
    ticketTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
    ticketSub: { fontSize: 14, color: '#666', marginBottom: 20 },
    qrCodeWrapper: {
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        position: 'relative'
    },
    usedBadge: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,107,107,0.1)'
    },
    usedBadgeText: {
        color: '#FF6B6B',
        fontSize: 28,
        fontWeight: '900',
        transform: [{ rotate: '-15deg' }],
        letterSpacing: 2
    },
    ticketStatus: {
        marginTop: 20,
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.primary
    },
    paymentCard: {
        padding: 20,
        backgroundColor: '#fff8dc',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f0d875',
        marginTop: 20,
        alignItems: 'center'
    },
    paymentTitle: { marginTop: 10, fontSize: 19, fontWeight: '900', color: COLORS.primary, textAlign: 'center' },
    paymentAmount: { marginTop: 6, fontSize: 24, fontWeight: '900', color: '#0f7a39' },
    paymentCopy: { marginTop: 8, fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 19 },
    paymentActions: { width: '100%', marginTop: 18, gap: 10 },
    paymentBtn: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 12, alignItems: 'center' },
    paymentBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
    verifyBtn: { backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary },
    verifyBtnText: { color: COLORS.primary, fontWeight: '900', fontSize: 15 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    modalView: {
        backgroundColor: "white",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        height: '85%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 20, textAlign: 'center' },
    modalPriceBox: { backgroundColor: '#f8f9fa', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#e9ecef' },
    modalPriceLabel: { color: '#777', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
    modalPriceValue: { color: COLORS.primary, fontSize: 22, fontWeight: '900', marginTop: 3 },
    modalPriceHelp: { color: '#666', fontSize: 12, marginTop: 5, lineHeight: 17 },
    profileSection: { marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#888', marginBottom: 12, textTransform: 'uppercase' },
    profileText: { fontSize: 16, color: '#333', marginBottom: 6 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 },
    optionalText: { fontSize: 14, color: '#999', fontStyle: 'italic' },
    questionBlock: { marginBottom: 16 },
    questionLabel: { fontSize: 16, color: '#333', marginBottom: 8, fontWeight: '500' },
    textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f9f9f9', color: '#333' },
    pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#f9f9f9', overflow: 'hidden' },
    modalActions: { marginTop: 20, marginBottom: 40 },
    submitBtn: { backgroundColor: '#D4AF37', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
    submitBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    cancelBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    cancelBtnText: { color: '#666', fontSize: 16, fontWeight: '600' },
    adminSection: { marginTop: 30, padding: 20, backgroundColor: '#f0f0f0', borderRadius: 12 },
    adminTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
    adminBtn: { flexDirection: 'row', backgroundColor: '#333', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    adminBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
    scorecardSection: { marginTop: 24, padding: 16, backgroundColor: '#fff8dc', borderRadius: 12, borderWidth: 1, borderColor: '#f0d875' },
    scorecardTitle: { marginLeft: 8, fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
    scorecardText: { color: '#555', fontSize: 13, lineHeight: 19 },
    scorecardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
    scorecardBtn: { backgroundColor: COLORS.primary, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10 },
    scorecardBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 }
});
