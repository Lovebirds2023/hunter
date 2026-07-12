import React, { useEffect, useMemo, useState } from 'react';
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

const DATE_PREVIEW_LIMIT = 8;
const LONG_SCHEDULE_DAYS = 31;

const getSlotStartMs = (slot) => {
    const date = new Date(slot?.start_time);
    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
};

const getSortedBookingSlots = (slots = []) => (
    [...slots].sort((a, b) => getSlotStartMs(a) - getSlotStartMs(b))
);

const scheduleSpansMoreThanMonth = (slots = []) => {
    if (slots.length < 2) return false;
    const first = getSlotStartMs(slots[0]);
    const last = getSlotStartMs(slots[slots.length - 1]);
    if (!Number.isFinite(first) || !Number.isFinite(last)) return false;
    return (last - first) / (24 * 60 * 60 * 1000) > LONG_SCHEDULE_DAYS;
};

const shouldCompactSlots = (slots = []) => (
    slots.length > DATE_PREVIEW_LIMIT || scheduleSpansMoreThanMonth(slots)
);

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
    const [registrationLoading, setRegistrationLoading] = useState(false);
    const [selectedTicketTierId, setSelectedTicketTierId] = useState(null);
    const [selectedBookingSlotId, setSelectedBookingSlotId] = useState(null);
    const [attendeeTypeJustification, setAttendeeTypeJustification] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [discountCode, setDiscountCode] = useState('');
    const [photoConsent, setPhotoConsent] = useState(null);
    const [showAllDetailSlots, setShowAllDetailSlots] = useState(false);
    const [showAllModalSlots, setShowAllModalSlots] = useState(false);

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
            const tiers = Array.isArray(eventData.ticket_tiers) ? eventData.ticket_tiers : [];
            if (tiers.length > 0) {
                setSelectedTicketTierId(prev => prev || tiers[0].id);
            }
            const slots = Array.isArray(eventData.available_slots) ? eventData.available_slots : [];
            if (slots.length === 1) {
                setSelectedBookingSlotId(prev => (
                    slots.some(slot => slot.id === prev) ? prev : slots[0].id
                ));
            } else if (slots.length > 1) {
                setSelectedBookingSlotId(prev => (
                    slots.some(slot => slot.id === prev) ? prev : null
                ));
            } else {
                setSelectedBookingSlotId(null);
            }
            setShowAllDetailSlots(false);
            setShowAllModalSlots(false);

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

    const openCheckoutWindow = () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const checkoutWindow = window.open('', '_blank');
            if (checkoutWindow) {
                checkoutWindow.document.title = 'Lovedogs 360 Pesapal Checkout';
                checkoutWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">Opening secure Pesapal checkout...</p>';
            }
            return checkoutWindow;
        }
        return null;
    };

    const closeCheckoutWindow = (checkoutWindow) => {
        try {
            if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.close();
        } catch {
            // Ignore browser popup cleanup errors.
        }
    };

    const openPaymentUrl = async (url, checkoutWindow = null) => {
        if (!url) return false;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            if (checkoutWindow && !checkoutWindow.closed) {
                checkoutWindow.location.href = url;
                checkoutWindow.focus?.();
                return true;
            }
            const opened = window.open(url, '_blank', 'noopener,noreferrer');
            return !!opened;
        }
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) return false;
        await Linking.openURL(url);
        return true;
    };

    const startEventPayment = async (registration, checkoutWindow = null) => {
        if (!registration?.id) {
            closeCheckoutWindow(checkoutWindow);
            return;
        }
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
                const opened = await openPaymentUrl(paymentRes.redirect_url, checkoutWindow);
                if (opened) {
                    Alert.alert('Payment opened', 'Complete payment in Pesapal, then return here and tap Confirm payment.');
                } else {
                    Alert.alert('Error', 'Could not open the Pesapal checkout page. Allow pop-ups or tap Pay with Pesapal again.');
                }
            } else if (paymentRes.payment_success) {
                closeCheckoutWindow(checkoutWindow);
                await loadData();
            } else {
                closeCheckoutWindow(checkoutWindow);
                Alert.alert('Error', 'Pesapal did not return a checkout link.');
            }
        } catch (error) {
            closeCheckoutWindow(checkoutWindow);
            Alert.alert('Payment failed', error.response?.data?.detail || 'Could not start payment.');
        } finally {
            setPaymentLoading(false);
        }
    };

    const handlePayExistingRegistration = () => {
        const checkoutWindow = openCheckoutWindow();
        startEventPayment(myRegistration, checkoutWindow);
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

        const ticketTiers = Array.isArray(event?.ticket_tiers) ? event.ticket_tiers : [];
        const selectedTier = ticketTiers.find(tier => tier.id === selectedTicketTierId);
        const availableSlots = Array.isArray(event?.available_slots) ? event.available_slots : [];
        const selectedBookingSlot = availableSlots.find(slot => slot.id === selectedBookingSlotId);
        if (availableSlots.length > 0 && !selectedBookingSlot) {
            Alert.alert('Choose a date', 'Select one available date/time before continuing.');
            return;
        }
        if (ticketTiers.length > 0) {
            if (!selectedTier) {
                const categoryNames = ticketTiers
                    .map(tier => tier.label)
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(' or ');
                Alert.alert('Choose registration type', `Select ${categoryNames || 'a registration category'} before continuing.`);
                return;
            }
            if ((attendeeTypeJustification || '').trim().length < 3) {
                Alert.alert('Justification required', 'Briefly explain why this registration type applies to you.');
                return;
            }
            const selectedTierPrice = Number(selectedTier.price || 0);
            const requiresAccessCode = selectedTier.requires_access_code === true ||
                (selectedTier.requires_access_code !== false && selectedTierPrice <= 0);
            if (requiresAccessCode && (accessCode || '').trim().length < 3) {
                Alert.alert('Sponsor code required', 'Enter the sponsor/access code shared with you for this free registration category.');
                return;
            }
        }

        if (photoConsent === null) {
            Alert.alert('Photo consent required', 'Please answer the photo and documentation consent question before continuing.');
            return;
        }

        // Validate custom fields
        for (const field of formFields) {
            if (field.is_required && !formResponses[field.id]) {
                Alert.alert(t('event_detail.validation_error'), t('event_detail.required_question', { label: field.label }));
                return;
            }
        }

        const selectedAmount = selectedTier
            ? Number(selectedTier.price || 0)
            : Number(event?.ticket_price || 0);
        if (selectedAmount <= 0 && (discountCode || '').trim()) {
            Alert.alert('Discount not needed', 'Discount codes can only be used with paid registration categories.');
            return;
        }
        let checkoutWindow = null;
        if (selectedAmount > 0) {
            checkoutWindow = openCheckoutWindow();
        }

        setRegistrationLoading(true);
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
                ticket_tier_id: selectedTier?.id || null,
                attendee_type_justification: ticketTiers.length > 0 ? attendeeTypeJustification.trim() : null,
                access_code: ticketTiers.length > 0 ? accessCode.trim() : null,
                discount_code: selectedAmount > 0 ? discountCode.trim() : null,
                photo_consent: photoConsent,
                booking_slot_id: selectedBookingSlot?.id || null,
                form_responses: formattedResponses
            });
            setModalVisible(false);
            if (registration.payment_status === 'pending') {
                setMyRegistration(registration);
                await startEventPayment(registration, checkoutWindow);
                checkoutWindow = null;
            } else {
                closeCheckoutWindow(checkoutWindow);
                Alert.alert(t('common.success'), t('event_detail.register_success'));
            }
            await loadData(); // Refresh to show Check-in button
        } catch (error) {
            closeCheckoutWindow(checkoutWindow);
            Alert.alert(t('common.error'), error.response?.data?.detail || t('event_detail.registration_failed'));
        } finally {
            setRegistrationLoading(false);
        }
    };

    const availableSlots = useMemo(() => (
        getSortedBookingSlots(Array.isArray(event?.available_slots) ? event.available_slots : [])
    ), [event?.available_slots]);
    const compactAvailableSlots = shouldCompactSlots(availableSlots);
    const detailSlotsToShow = compactAvailableSlots && !showAllDetailSlots
        ? availableSlots.slice(0, DATE_PREVIEW_LIMIT)
        : availableSlots;
    const modalSlotsToShow = compactAvailableSlots && !showAllModalSlots
        ? availableSlots.slice(0, DATE_PREVIEW_LIMIT)
        : availableSlots;
    const detailHasHiddenSlots = detailSlotsToShow.length < availableSlots.length;
    const modalHasHiddenSlots = modalSlotsToShow.length < availableSlots.length;

    if (loading || !event) return <View style={styles.center}><Text>{t('common.loading')}</Text></View>;

    const ticketTiers = Array.isArray(event.ticket_tiers) ? event.ticket_tiers : [];
    const hasTicketTiers = ticketTiers.length > 0;
    const selectedTicketTier = ticketTiers.find(tier => tier.id === selectedTicketTierId) || ticketTiers[0] || null;
    const ticketPrice = Number(event.ticket_price || 0);
    const selectedTicketPrice = Number(selectedTicketTier?.price || (hasTicketTiers ? 0 : ticketPrice) || 0);
    const selectedTicketCurrency = selectedTicketTier?.currency || event.currency || 'KES';
    const priceLabel = hasTicketTiers
        ? 'Free + paid options'
        : (ticketPrice > 0 ? `${event.currency || 'KES'} ${ticketPrice.toLocaleString()}` : 'Free');
    const selectedPriceLabel = selectedTicketPrice > 0
        ? `${selectedTicketCurrency} ${selectedTicketPrice.toLocaleString()}`
        : 'Free';
    const selectedTierRequiresAccessCode = Boolean(selectedTicketTier) && (
        selectedTicketTier.requires_access_code === true ||
        (selectedTicketTier.requires_access_code !== false && selectedTicketPrice <= 0)
    );
    const hasAvailableSlots = availableSlots.length > 0;
    const formatSlotTime = (slot) => {
        if (!slot?.start_time) return '';
        const start = new Date(slot.start_time);
        const end = slot.end_time ? new Date(slot.end_time) : null;
        const startLabel = Number.isNaN(start.getTime()) ? String(slot.start_time) : start.toLocaleString();
        const endLabel = end && !Number.isNaN(end.getTime())
            ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
        return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
    };
    const pendingPayment = myRegistration && (
        String(myRegistration.payment_status || '').toLowerCase() === 'pending' ||
        myRegistration.status === 'pending_payment'
    );
    const scorecardTitle = event.scorecard_title || 'Community Impact Assessment';
    const scorecardDescription = event.scorecard_description || 'Share baseline or follow-up feedback for M&E, outcome tracking, and partner reporting.';

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
                    <View style={[styles.pricePill, (hasTicketTiers || ticketPrice > 0) ? styles.paidPill : styles.freePill]}>
                        <Ionicons name={(hasTicketTiers || ticketPrice > 0) ? 'card-outline' : 'gift-outline'} size={14} color={(hasTicketTiers || ticketPrice > 0) ? '#0f7a39' : COLORS.primary} />
                        <Text style={[styles.pricePillText, { color: (hasTicketTiers || ticketPrice > 0) ? '#0f7a39' : COLORS.primary }]}>{priceLabel}</Text>
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

                {hasAvailableSlots && (
                    <View style={styles.scheduleSection}>
                        <View style={styles.scheduleHeader}>
                            <Ionicons name="calendar-number-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.scheduleTitle}>Available booking dates</Text>
                        </View>
                        <Text style={styles.scheduleHelpText}>
                            Select the date/time you want before registering.
                        </Text>
                        {detailSlotsToShow.map(slot => {
                            const isSelected = selectedBookingSlotId === slot.id;
                            return (
                                <TouchableOpacity
                                    key={slot.id}
                                    style={[styles.scheduleItem, isSelected && styles.selectedScheduleItem]}
                                    onPress={() => setSelectedBookingSlotId(slot.id)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.scheduleItemTitle, isSelected && styles.selectedScheduleText]}>{slot.label}</Text>
                                        <Text style={[styles.scheduleItemTime, isSelected && styles.selectedScheduleText]}>{formatSlotTime(slot)}</Text>
                                        {!!slot.location && <Text style={[styles.scheduleItemMeta, isSelected && styles.selectedScheduleText]}>{slot.location}</Text>}
                                        {!!slot.notes && <Text style={[styles.scheduleItemMeta, isSelected && styles.selectedScheduleText]}>{slot.notes}</Text>}
                                    </View>
                                    <View style={styles.scheduleItemRight}>
                                        {Number(slot.capacity || 0) > 0 && (
                                            <View style={[styles.scheduleCapacityPill, isSelected && styles.selectedScheduleCapacityPill]}>
                                                <Text style={[styles.scheduleCapacityText, isSelected && styles.selectedScheduleCapacityText]}>{slot.capacity} spots</Text>
                                            </View>
                                        )}
                                        <Ionicons
                                            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                                            size={22}
                                            color={isSelected ? '#fff' : COLORS.primary}
                                        />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        {compactAvailableSlots && (showAllDetailSlots || detailHasHiddenSlots) && (
                            <TouchableOpacity
                                style={styles.viewMoreDatesButton}
                                onPress={() => setShowAllDetailSlots(prev => !prev)}
                            >
                                <Ionicons name={showAllDetailSlots ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
                                <Text style={styles.viewMoreDatesText}>
                                    {showAllDetailSlots
                                        ? 'View fewer dates'
                                        : `View more dates (${availableSlots.length - detailSlotsToShow.length} more)`}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {event.scorecard_enabled !== false && (
                    <View style={styles.scorecardSection}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="clipboard-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.scorecardTitle}>{scorecardTitle}</Text>
                        </View>
                        <Text style={styles.scorecardText}>
                            {scorecardDescription}
                        </Text>
                        <View style={styles.scorecardActions}>
                            <TouchableOpacity
                                style={styles.scorecardBtn}
                                onPress={() => navigation.navigate('ScorecardSurvey', {
                                    eventId: event.id,
                                    eventTitle: event.title,
                                    surveyType: 'baseline',
                                    scorecardTitle,
                                    scorecardDescription,
                                })}
                            >
                                <Text style={styles.scorecardBtnText}>Baseline Assessment</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.scorecardBtn, { backgroundColor: '#4a90e2' }]}
                                onPress={() => navigation.navigate('ScorecardSurvey', {
                                    eventId: event.id,
                                    eventTitle: event.title,
                                    surveyType: 'followup',
                                    scorecardTitle,
                                    scorecardDescription,
                                })}
                            >
                                <Text style={styles.scorecardBtnText}>Follow-up Assessment</Text>
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
                                {myRegistration.booking_slot_label && (
                                    <Text style={styles.paymentCopy}>
                                        Booking: {myRegistration.booking_slot_label} {myRegistration.booking_start_time ? `| ${new Date(myRegistration.booking_start_time).toLocaleString()}` : ''}
                                    </Text>
                                )}
                                <Text style={styles.paymentCopy}>Your registration is saved, but the QR ticket is issued after Pesapal confirms payment.</Text>
                                <View style={styles.paymentActions}>
                                    <TouchableOpacity
                                        style={[styles.paymentBtn, paymentLoading && { opacity: 0.7 }]}
                                        onPress={handlePayExistingRegistration}
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
                                {myRegistration.booking_slot_label && (
                                    <Text style={styles.ticketSlot}>
                                        {myRegistration.booking_slot_label} {myRegistration.booking_start_time ? `| ${new Date(myRegistration.booking_start_time).toLocaleString()}` : ''}
                                    </Text>
                                )}
                            </View>
                        )
                    ) : (
                        <Button
                            title={hasTicketTiers ? 'Choose registration type' : (ticketPrice > 0 ? `Register and pay ${priceLabel}` : t('event_detail.register_now'))}
                            onPress={() => setModalVisible(true)}
                            color={COLORS.primary}
                        />
                    )}
                </View>

                {/* Organizer/Admin Actions */}
                {['admin', 'super_admin'].includes(user?.role) && (
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
                                <Text style={styles.modalPriceLabel}>{hasTicketTiers ? 'Registration type' : 'Ticket'}</Text>
                                <Text style={styles.modalPriceValue}>{hasTicketTiers ? selectedPriceLabel : priceLabel}</Text>
                                {selectedTicketPrice > 0 && <Text style={styles.modalPriceHelp}>Payment is completed securely through Pesapal after registration.</Text>}
                            </View>

                            {hasTicketTiers && (
                                <View style={styles.profileSection}>
                                    <Text style={styles.sectionTitle}>Choose your category</Text>
                                    {ticketTiers.map((tier) => {
                                        const tierPrice = Number(tier.price || 0);
                                        const isSelected = selectedTicketTierId === tier.id;
                                        return (
                                            <TouchableOpacity
                                                key={tier.id}
                                                style={[styles.tierOption, isSelected && styles.selectedTierOption]}
                                                onPress={() => setSelectedTicketTierId(tier.id)}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.tierTitle, isSelected && styles.selectedTierText]}>{tier.label}</Text>
                                                    {!!tier.description && <Text style={[styles.tierDescription, isSelected && styles.selectedTierText]}>{tier.description}</Text>}
                                                </View>
                                                <Text style={[styles.tierPrice, isSelected && styles.selectedTierText]}>
                                                    {tierPrice > 0 ? `${tier.currency || event.currency || 'KES'} ${tierPrice.toLocaleString()}` : 'FREE'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                    <Text style={styles.questionLabel}>
                                        {event.attendee_type_question || 'Briefly explain why this registration type applies to you.'} <Text style={{ color: 'red' }}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={[styles.textInput, { height: 86, textAlignVertical: 'top' }]}
                                        multiline
                                        placeholder="Example: I am attending as a community participant from..."
                                        value={attendeeTypeJustification}
                                        onChangeText={setAttendeeTypeJustification}
                                    />
                                    {selectedTierRequiresAccessCode && (
                                        <View style={styles.accessCodeBox}>
                                            <Text style={styles.questionLabel}>
                                                Sponsor/access code <Text style={{ color: 'red' }}>*</Text>
                                            </Text>
                                            <TextInput
                                                style={styles.textInput}
                                                placeholder="Enter code from your sponsor"
                                                value={accessCode}
                                                autoCapitalize="characters"
                                                onChangeText={(value) => setAccessCode(value.toUpperCase())}
                                            />
                                            <Text style={styles.accessCodeHelp}>
                                                This code is one-use and confirms your sponsor-approved free registration.
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {selectedTicketPrice > 0 && (
                                <View style={styles.profileSection}>
                                    <Text style={styles.sectionTitle}>Discount code</Text>
                                    <View style={styles.accessCodeBox}>
                                        <Text style={styles.questionLabel}>Paid/self-sponsored discount code</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Optional"
                                            value={discountCode}
                                            autoCapitalize="characters"
                                            onChangeText={(value) => setDiscountCode(value.toUpperCase())}
                                        />
                                        <Text style={styles.accessCodeHelp}>
                                            If the code is valid, the discount is applied before Pesapal payment opens.
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {hasAvailableSlots && (
                                <View style={styles.profileSection}>
                                    <Text style={styles.sectionTitle}>Choose available date/time</Text>
                                    <Text style={styles.slotHelpText}>Pick one available date/time for this registration.</Text>
                                    {modalSlotsToShow.map((slot) => {
                                        const isSelected = selectedBookingSlotId === slot.id;
                                        return (
                                            <TouchableOpacity
                                                key={slot.id}
                                                style={[styles.slotOption, isSelected && styles.selectedSlotOption]}
                                                onPress={() => setSelectedBookingSlotId(slot.id)}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.slotTitle, isSelected && styles.selectedSlotText]}>{slot.label}</Text>
                                                    <Text style={[styles.slotTime, isSelected && styles.selectedSlotText]}>{formatSlotTime(slot)}</Text>
                                                    {!!slot.location && <Text style={[styles.slotMeta, isSelected && styles.selectedSlotText]}>{slot.location}</Text>}
                                                    {!!slot.notes && <Text style={[styles.slotMeta, isSelected && styles.selectedSlotText]}>{slot.notes}</Text>}
                                                </View>
                                                {Number(slot.capacity || 0) > 0 && (
                                                    <Text style={[styles.slotCapacity, isSelected && styles.selectedSlotText]}>{slot.capacity} spots</Text>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                    {compactAvailableSlots && (showAllModalSlots || modalHasHiddenSlots) && (
                                        <TouchableOpacity
                                            style={styles.modalViewMoreDatesButton}
                                            onPress={() => setShowAllModalSlots(prev => !prev)}
                                        >
                                            <Ionicons name={showAllModalSlots ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
                                            <Text style={styles.viewMoreDatesText}>
                                                {showAllModalSlots
                                                    ? 'View fewer dates'
                                                    : `View more dates (${availableSlots.length - modalSlotsToShow.length} more)`}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

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
                                <Text style={styles.sectionTitle}>Photo and documentation consent</Text>
                                <Text style={styles.questionLabel}>
                                    Do you consent to Lovedogs 360 taking and using photos or videos of you during this event for documentation, reporting, and promotion of our activities? <Text style={{ color: 'red' }}>*</Text>
                                </Text>
                                <View style={styles.consentOptionRow}>
                                    <TouchableOpacity
                                        style={[styles.consentOption, photoConsent === true && styles.selectedConsentOption]}
                                        onPress={() => setPhotoConsent(true)}
                                    >
                                        <Ionicons name={photoConsent === true ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={photoConsent === true ? '#fff' : COLORS.primary} />
                                        <Text style={[styles.consentOptionText, photoConsent === true && styles.selectedConsentText]}>Yes, I consent</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.consentOption, photoConsent === false && styles.selectedNoConsentOption]}
                                        onPress={() => setPhotoConsent(false)}
                                    >
                                        <Ionicons name={photoConsent === false ? 'close-circle' : 'ellipse-outline'} size={20} color={photoConsent === false ? '#fff' : '#8a4b00'} />
                                        <Text style={[styles.consentOptionText, photoConsent === false && styles.selectedConsentText]}>No, I do not consent</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.consentHelpText}>
                                    You can still register if you choose no. This answer helps our team respect your preference during documentation.
                                </Text>
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
                                <TouchableOpacity
                                    style={[styles.submitBtn, (registrationLoading || paymentLoading) && { opacity: 0.7 }]}
                                    onPress={handleRegister}
                                    disabled={registrationLoading || paymentLoading}
                                >
                                    {(registrationLoading || paymentLoading)
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={styles.submitBtnText}>{selectedTicketPrice > 0 ? `Continue to Pesapal payment (${selectedPriceLabel})` : t('event_detail.complete_registration')}</Text>}
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
    scheduleSection: {
        marginTop: 22,
        padding: 16,
        backgroundColor: '#f8fbff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#d9e9ff'
    },
    scheduleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    scheduleTitle: { marginLeft: 8, fontSize: 17, fontWeight: '900', color: COLORS.primary },
    scheduleHelpText: { color: '#555', fontSize: 13, lineHeight: 18, marginBottom: 10 },
    scheduleItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e8f1ff',
        borderRadius: 12,
        backgroundColor: '#fff',
        marginBottom: 10
    },
    selectedScheduleItem: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    selectedScheduleText: { color: '#fff' },
    scheduleItemRight: { alignItems: 'flex-end', gap: 8 },
    scheduleItemTitle: { fontSize: 15, fontWeight: '900', color: '#222' },
    scheduleItemTime: { marginTop: 3, fontSize: 13, color: '#444', lineHeight: 18 },
    scheduleItemMeta: { marginTop: 3, fontSize: 12, color: '#666', lineHeight: 17 },
    scheduleCapacityPill: {
        backgroundColor: '#fff8dc',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#f0d875'
    },
    scheduleCapacityText: { color: COLORS.primary, fontSize: 11, fontWeight: '900' },
    selectedScheduleCapacityPill: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.42)' },
    selectedScheduleCapacityText: { color: '#fff' },
    viewMoreDatesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d9e9ff',
        backgroundColor: '#fff'
    },
    viewMoreDatesText: { color: COLORS.primary, fontWeight: '900', fontSize: 13 },
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
    tierOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        backgroundColor: '#fff'
    },
    selectedTierOption: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary
    },
    tierTitle: { fontSize: 15, fontWeight: '900', color: '#222' },
    tierDescription: { fontSize: 12, color: '#666', marginTop: 3, lineHeight: 17 },
    tierPrice: { fontSize: 13, fontWeight: '900', color: '#0f7a39' },
    selectedTierText: { color: '#fff' },
    accessCodeBox: {
        marginTop: 14,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d9e9ff',
        backgroundColor: '#f8fbff'
    },
    accessCodeHelp: { marginTop: 6, color: '#666', fontSize: 12, lineHeight: 17 },
    slotOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#d9e9ff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        backgroundColor: '#f8fbff'
    },
    selectedSlotOption: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary
    },
    slotTitle: { fontSize: 15, fontWeight: '900', color: '#222' },
    slotTime: { fontSize: 12, color: '#555', marginTop: 3, lineHeight: 17 },
    slotMeta: { fontSize: 12, color: '#666', marginTop: 3, lineHeight: 17 },
    slotCapacity: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
    selectedSlotText: { color: '#fff' },
    slotHelpText: { color: '#666', fontSize: 12, lineHeight: 17, marginBottom: 10 },
    modalViewMoreDatesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d9e9ff',
        backgroundColor: '#f8fbff'
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
    ticketSlot: {
        marginTop: 8,
        fontSize: 13,
        color: '#555',
        textAlign: 'center',
        lineHeight: 18
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
    consentOptionRow: { gap: 10 },
    consentOption: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, backgroundColor: '#fff' },
    selectedConsentOption: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    selectedNoConsentOption: { backgroundColor: '#8a4b00', borderColor: '#8a4b00' },
    consentOptionText: { color: '#333', fontWeight: '800', flex: 1 },
    selectedConsentText: { color: '#fff' },
    consentHelpText: { marginTop: 8, color: '#777', fontSize: 12, lineHeight: 17 },
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
