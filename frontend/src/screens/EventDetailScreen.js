import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Button, ScrollView, Alert, Modal, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { getEvent, registerForEvent, toggleSaveEvent, getEventFormFields } from '../api/events';
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

            await registerForEvent(eventId, {
                event_id: eventId,
                dog_id: selectedDog ? selectedDog.id : null,
                role: 'attendee',
                share_phone: sharePhone,
                form_responses: formattedResponses
            });
            Alert.alert(t('common.success'), t('event_detail.register_success'));
            setModalVisible(false);
            loadData(); // Refresh to show Check-in button
        } catch (error) {
            Alert.alert(t('common.error'), error.response?.data?.detail || t('event_detail.registration_failed'));
        }
    };

    if (loading || !event) return <View style={styles.center}><Text>{t('common.loading')}</Text></View>;

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
                <Text style={styles.title}>{event.title}</Text>
                <Text style={styles.time}>{new Date(event.start_time).toLocaleString()}</Text>
                <Text style={styles.location}>{event.location}</Text>
                <Text style={styles.description}>{event.description}</Text>

                <View style={styles.footer}>
                    {myRegistration ? (
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
                    ) : (
                        <Button title={t('event_detail.register_now')} onPress={() => setModalVisible(true)} color={COLORS.primary} />
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
                                    <Text style={styles.submitBtnText}>{t('event_detail.complete_registration')}</Text>
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
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, color: COLORS.primary, marginTop: 10 },
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
    adminBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 }
});
