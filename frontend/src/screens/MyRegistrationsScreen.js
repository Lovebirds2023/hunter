import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { getMyRegistrations } from '../api/events';

export const MyRegistrationsScreen = ({ navigation }) => {
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

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <Text style={styles.title}>Registration #{item.id.slice(0, 8)}</Text>
            <Text style={styles.detail}>Event ID: {item.event_id}</Text>
            <Text style={styles.detail}>Status: <Text style={{ fontWeight: 'bold', color: item.status === 'registered' ? 'green' : 'gray' }}>{item.status}</Text></Text>
            <Text style={styles.detail}>Role: {item.role}</Text>
            {item.dog_id && <Text style={styles.detail}>Dog ID: {item.dog_id.slice(0, 8)}...</Text>}
            <View style={styles.qrPlaceholder}>
                <Text style={{ textAlign: 'center', color: '#888' }}>QR Code (Coming Soon)</Text>
            </View>
        </View>
    );

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Registrations</Text>
                <View style={{ width: 24 }} />
            </View>
            {registrations.length === 0 ? (
                <Text style={styles.emptyText}>You have no registrations yet.</Text>
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
