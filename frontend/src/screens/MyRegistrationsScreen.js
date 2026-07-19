import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { getMyRegistrations } from '../api/events';

export const MyRegistrationsScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await getMyRegistrations();
            setRegistrations(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }) => {
        const eventTitle = item.event?.title || t('my_registrations.event_id', { id: item.event_id });
        const bookingDate = item.booking_start_time ? new Date(item.booking_start_time) : null;
        return (
            <View style={styles.card}>
                <Text style={styles.title}>{eventTitle}</Text>
                <Text style={styles.detail}>{t('my_registrations.registration_number', { id: item.id.slice(0, 8) })}</Text>
                <Text style={styles.detail}>{t('my_registrations.status')}: <Text style={{ fontWeight: 'bold', color: item.status === 'registered' ? 'green' : 'gray' }}>{item.status}</Text></Text>
                {item.ticket_tier_label && <Text style={styles.detail}>Registration type: {item.ticket_tier_label}</Text>}
                {item.booking_slot_label && <Text style={styles.detail}>Booking: {item.booking_slot_label}</Text>}
                {bookingDate && <Text style={styles.detail}>Date/time: {bookingDate.toLocaleString()}</Text>}
                <Text style={styles.detail}>{t('my_registrations.role', { role: item.role })}</Text>
                {item.dog_id && <Text style={styles.detail}>{t('my_registrations.dog_id', { id: item.dog_id.slice(0, 8) })}</Text>}
                <View style={styles.qrPlaceholder}>
                    <Text style={{ textAlign: 'center', color: '#888' }}>{t('my_registrations.qr_coming_soon')}</Text>
                </View>
            </View>
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('my_registrations.title')}</Text>
                <View style={{ width: 24 }} />
            </View>
            {registrations.length === 0 ? (
                <Text style={styles.emptyText}>{t('my_registrations.empty')}</Text>
            ) : (
                <FlatList
                    data={registrations}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 40, // Adjust for status bar
        paddingBottom: 10,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    backButton: { padding: 5 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: {
        backgroundColor: 'white',
        padding: 15,
        marginHorizontal: 15,
        marginTop: 15,
        borderRadius: 10,
        elevation: 2
    },
    title: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
    detail: { marginBottom: 3, color: '#444' },
    qrPlaceholder: {
        height: 100,
        backgroundColor: '#f0f0f0',
        marginTop: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5
    },
    emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#666' }
});
