import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getServiceResponses } from '../api/marketplace';
import { COLORS, SPACING } from '../constants/theme';
import { useTranslation } from 'react-i18next';

const ServiceResponsesScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const { serviceId, serviceTitle } = route.params;
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchResponses();
    }, []);

    const fetchResponses = async () => {
        try {
            const data = await getServiceResponses(serviceId);
            setResponses(data || []);
        } catch (error) {
            console.error('Error fetching responses:', error);
            Alert.alert(t('common.error'), t('service_responses.load_error'));
        } finally {
            setLoading(false);
        }
    };

    const handleContact = (phone) => {
        if (!phone) {
            Alert.alert(t('service_responses.privacy'), t('service_responses.no_phone'));
            return;
        }
        Linking.openURL(`tel:${phone}`);
    };

    const renderResponseItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.buyerName}>{item.buyer.full_name}</Text>
                    <Text style={styles.orderInfo}>{t('service_responses.order_info', { id: item.order_id.split('-').pop(), date: new Date(item.created_at).toLocaleDateString() })}</Text>
                </View>
                <TouchableOpacity 
                    style={[styles.contactBtn, !item.buyer.phone && styles.contactBtnDisabled]} 
                    onPress={() => handleContact(item.buyer.phone)}
                >
                    <Ionicons name="call" size={18} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {item.responses.length > 0 ? (
                <View style={styles.answersSection}>
                    <Text style={styles.sectionTitle}>{t('service_responses.form_answers')}</Text>
                    {item.responses.map((resp, idx) => (
                        <View key={idx} style={styles.answerRow}>
                            <Text style={styles.questionText}>{resp.field_label}</Text>
                            <Text style={styles.answerText}>{resp.answer_value || t('event_responses.no_answer')}</Text>
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.emptyAnswers}>
                    <Text style={styles.emptyAnswersText}>{t('service_responses.no_fields')}</Text>
                </View>
            )}

            <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status}</Text>
            </View>
        </View>
    );

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ marginTop: 10, color: COLORS.textSecondary }}>{t('service_responses.fetching')}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{t('service_responses.title')}</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>{serviceTitle}</Text>
                    </View>
                </View>

                <FlatList
                    data={responses}
                    keyExtractor={(item) => item.order_id}
                    renderItem={renderResponseItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyText}>{t('service_responses.no_bookings')}</Text>
                            <Text style={styles.emptySubtext}>{t('service_responses.no_bookings_subtitle')}</Text>
                        </View>
                    }
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: SPACING.md, 
        backgroundColor: '#fff', 
        borderBottomWidth: 1, 
        borderBottomColor: '#eee' 
    },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    headerSubtitle: { fontSize: 13, color: COLORS.textSecondary },
    listContent: { padding: SPACING.md },
    emptyContainer: { alignItems: 'center', padding: 40, marginTop: 40 },
    emptyText: { fontSize: 18, color: '#333', marginTop: 16, fontWeight: 'bold' },
    emptySubtext: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    buyerName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    orderInfo: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    contactBtn: { backgroundColor: COLORS.primary, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    contactBtnDisabled: { backgroundColor: '#ccc' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
    answersSection: { marginTop: 4 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary, marginBottom: 8, textTransform: 'uppercase' },
    answerRow: { marginBottom: 10 },
    questionText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
    answerText: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
    emptyAnswers: { paddingVertical: 8 },
    emptyAnswersText: { fontSize: 12, color: '#999', fontStyle: 'italic' },
    statusBadge: { position: 'absolute', top: 16, right: 60, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#e8f5e9' },
    statusText: { fontSize: 10, fontWeight: 'bold', color: '#2e7d32', textTransform: 'uppercase' }
});

export default ServiceResponsesScreen;
