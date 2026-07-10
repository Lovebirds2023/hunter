import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEventResponses, getEventFormFields } from '../api/events';
import moment from 'moment';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const EventResponsesScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const { eventId, eventTitle } = route.params;
    const { userInfo } = useContext(AuthContext);
    const isAdmin = ['admin', 'super_admin'].includes(userInfo?.role);

    const [responses, setResponses] = useState([]);
    const [formFields, setFormFields] = useState([]);
    const [loading, setLoading] = useState(true);

    const openEventBroadcast = () => {
        navigation.navigate('AdminHome', {
            initialTab: 'announcements',
            broadcastTargetGroup: 'event_registrants',
            broadcastEventId: eventId,
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [respData, fieldsData] = await Promise.all([
                getEventResponses(eventId),
                getEventFormFields(eventId)
            ]);
            setResponses(respData || []);
            setFormFields(fieldsData || []);
        } catch (error) {
            console.error('Error fetching responses:', error);
            Alert.alert(t('common.error'), t('event_responses.load_error'));
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerTitleRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.headerTitle}>{t('event_responses.title')}</Text>
                </View>
                {isAdmin && (
                    <TouchableOpacity style={styles.broadcastBtn} onPress={openEventBroadcast}>
                        <Ionicons name="megaphone-outline" size={15} color="#4B0082" />
                        <Text style={styles.broadcastBtnText}>Broadcast</Text>
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.headerSubtitle}>{eventTitle}</Text>
            <Text style={styles.statsText}>{t('event_responses.total', { count: responses.length })}</Text>
        </View>
    );

    const formatBookingTime = (item) => {
        if (!item.booking_start_time) return null;
        const start = moment(item.booking_start_time);
        const end = item.booking_end_time ? moment(item.booking_end_time) : null;
        if (!start.isValid()) return item.booking_start_time;
        return end?.isValid()
            ? `${start.format('MMM D, YYYY h:mm A')} - ${end.format('h:mm A')}`
            : start.format('MMM D, YYYY h:mm A');
    };

    const renderResponseItem = ({ item, index }) => {
        const bookingTime = formatBookingTime(item);
        const photoConsentLabel = item.photo_consent === true
            ? 'Consent given'
            : item.photo_consent === false
                ? 'No consent'
                : 'Not answered';
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {(item.user_name || 'U').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{item.user_name || t('event_responses.unknown_user')}</Text>
                        <Text style={styles.userEmail}>{item.user_email}</Text>
                        
                        {(item.share_phone || isAdmin) && item.user_phone ? (
                            <Text style={styles.userPhone}>
                                <Ionicons name="call-outline" size={12} /> {item.user_phone}
                            </Text>
                        ) : null}
                    </View>
                    
                    <View style={[styles.statusBadge, item.status === 'checked-in' ? styles.statusCheckedIn : {}]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>

                {item.dog_name && (
                    <View style={styles.dogRow}>
                        <Ionicons name="paw" size={16} color="#D4AF37" />
                        <Text style={styles.dogName}>{t('event_responses.attending_with', { name: item.dog_name })}</Text>
                    </View>
                )}

                {(item.ticket_tier_label || item.attendee_type_justification || item.booking_slot_label) && (
                    <View style={styles.tierBox}>
                        {item.ticket_tier_label && (
                            <View style={styles.tierHeader}>
                                <Text style={styles.tierLabel}>Registration type</Text>
                                <Text style={styles.tierValue}>{item.ticket_tier_label}</Text>
                            </View>
                        )}
                        {item.booking_slot_label && (
                            <View style={styles.bookingRow}>
                                <Ionicons name="calendar-number-outline" size={16} color="#6d5b12" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tierLabel}>Booking date/time</Text>
                                    <Text style={styles.tierValue}>{item.booking_slot_label}</Text>
                                    {bookingTime && <Text style={styles.bookingTime}>{bookingTime}</Text>}
                                </View>
                            </View>
                        )}
                        {item.attendee_type_justification && (
                            <View style={styles.qaRow}>
                                <Text style={styles.questionText}>Type justification</Text>
                                <Text style={styles.answerText}>{item.attendee_type_justification}</Text>
                            </View>
                        )}
                        <Text style={styles.paymentLine}>
                            {item.payment_status || 'free'} - {item.currency || 'KES'} {Number(item.amount || 0).toLocaleString()}
                        </Text>
                    </View>
                )}

                <View style={[styles.consentBox, item.photo_consent === false && styles.noConsentBox]}>
                    <Ionicons
                        name={item.photo_consent === true ? 'camera-outline' : item.photo_consent === false ? 'camera-reverse-outline' : 'help-circle-outline'}
                        size={17}
                        color={item.photo_consent === true ? '#0f7a39' : item.photo_consent === false ? '#8a4b00' : '#777'}
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.consentLabel}>Photo/documentation consent</Text>
                        <Text style={styles.consentValue}>{photoConsentLabel}</Text>
                    </View>
                </View>

                <View style={styles.responsesContainer}>
                    {formFields.length > 0 ? (
                        formFields.map(field => {
                            const answer = item.responses?.find(r => r.field_id === field.id)?.answer_value;
                            return (
                                <View key={field.id} style={styles.qaRow}>
                                    <Text style={styles.questionText}>{field.label}</Text>
                                    <Text style={styles.answerText}>{answer || t('event_responses.no_answer')}</Text>
                                </View>
                            );
                        })
                    ) : (
                        <Text style={styles.noFormText}>{t('event_responses.no_form_fields')}</Text>
                    )}
                </View>

                <View style={styles.footerRow}>
                    <Text style={styles.dateText}>{t('event_responses.registered', { date: moment(item.created_at).format('MMM D, YYYY') })}</Text>
                </View>
            </View>
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#D4AF37"/></View>;

    return (
        <View style={styles.container}>
            <FlatList
                ListHeaderComponent={renderHeader}
                data={responses}
                keyExtractor={(item) => item.id}
                renderItem={renderResponseItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>{t('event_responses.no_registrations')}</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 16 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', flexShrink: 1 },
    broadcastBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff8dc', borderWidth: 1, borderColor: '#D4AF37', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
    broadcastBtnText: { color: '#4B0082', fontSize: 12, fontWeight: '800' },
    headerSubtitle: { fontSize: 16, color: '#666', marginTop: 4 },
    statsText: { fontSize: 14, color: '#D4AF37', fontWeight: 'bold', marginTop: 12 },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D4AF37', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
    userEmail: { fontSize: 13, color: '#666', marginTop: 2 },
    userPhone: { fontSize: 13, color: '#444', marginTop: 2 },
    statusBadge: { backgroundColor: '#e6f7ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    statusCheckedIn: { backgroundColor: '#e6ffed' },
    statusText: { fontSize: 12, color: '#0066cc', fontWeight: '500', textTransform: 'capitalize' },
    dogRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fefaf0', padding: 8, borderRadius: 8, marginBottom: 12 },
    dogName: { marginLeft: 8, fontSize: 14, color: '#D4AF37', fontWeight: '500' },
    tierBox: { backgroundColor: '#fff8dc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#f0d875', marginBottom: 12 },
    tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    tierLabel: { fontSize: 12, color: '#6d5b12', fontWeight: '700', textTransform: 'uppercase' },
    tierValue: { fontSize: 13, color: '#1A1A1A', fontWeight: '900' },
    bookingRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 10 },
    bookingTime: { fontSize: 12, color: '#6d5b12', marginTop: 3 },
    paymentLine: { fontSize: 12, color: '#6d5b12', fontWeight: '700', marginTop: 4, textTransform: 'capitalize' },
    consentBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e6f6ed', borderWidth: 1, borderColor: '#bde8cc', padding: 10, borderRadius: 8, marginBottom: 12 },
    noConsentBox: { backgroundColor: '#fff4e6', borderColor: '#f0c28c' },
    consentLabel: { fontSize: 11, color: '#555', fontWeight: '800', textTransform: 'uppercase' },
    consentValue: { fontSize: 14, color: '#1A1A1A', fontWeight: '900', marginTop: 2 },
    responsesContainer: { backgroundColor: '#fafafa', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    qaRow: { marginBottom: 12 },
    questionText: { fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 4 },
    answerText: { fontSize: 14, color: '#333' },
    noFormText: { fontSize: 14, color: '#999', fontStyle: 'italic', textAlign: 'center', padding: 10 },
    footerRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', alignItems: 'flex-end' },
    dateText: { fontSize: 12, color: '#999' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyText: { fontSize: 18, color: '#333', marginTop: 16 }
});

export default EventResponsesScreen;
