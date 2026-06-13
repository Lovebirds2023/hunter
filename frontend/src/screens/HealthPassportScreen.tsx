
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import client from '../api/client';
// import * as Print from 'expo-print'; // Optional: Use if available in environment

export const HealthPassportScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { dogId } = route.params;
    const [loading, setLoading] = useState(true);
    const [dog, setDog] = useState<any>(null);
    const [records, setRecords] = useState<any[]>([]);

    useEffect(() => {
        fetchPassportData();
    }, [dogId]);

    const fetchPassportData = async () => {
        try {
            setLoading(true);
            const [dogRes, recordsRes] = await Promise.all([
                client.get(`/dogs/${dogId}`),
                client.get(`/dogs/${dogId}/health-records`)
            ]);
            setDog(dogRes.data);
            setRecords(recordsRes.data);
        } catch (e) {
            console.error("Failed to fetch passport data", e);
            Alert.alert(t('common.error'), t('health_passport.load_error'));
        } finally {
            setLoading(false);
        }
    };

    const getHealthStatus = () => {
        if (records.length === 0) return { status: t('health_passport.status.unknown'), color: '#9E9E9E', icon: 'help-circle' };
        
        const vaccinationRecords = records.filter(r => r.record_type === 'vaccination');
        const overdue = vaccinationRecords.filter(r => r.next_due_date && new Date(r.next_due_date) < new Date());
        
        if (overdue.length > 0) {
            return { status: t('health_passport.status.action_needed'), color: '#D32F2F', icon: 'alert-circle' };
        }
        return { status: t('health_passport.status.healthy'), color: '#388E3C', icon: 'checkmark-circle' };
    };

    const getNextDueDates = () => {
        const dueDates = records
            .filter(r => r.next_due_date)
            .map(r => ({ type: r.record_type, date: new Date(r.next_due_date), notes: r.notes }))
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 3);
        return dueDates;
    };

    const handleExport = async () => {
        try {
            const healthStatus = getHealthStatus();
            const nextDue = getNextDueDates();
            const nextDueText = nextDue.length > 0 
                ? nextDue.map(d => `${d.type.toUpperCase()}: ${d.date.toLocaleDateString()}`).join('\n')
                : t('health_passport.all_up_to_date');
            
            const message = t('health_passport.share_message', {
                name: dog?.name || t('health_passport.unknown'),
                breed: dog?.breed || t('health_passport.unknown'),
                weight: dog?.weight || '?',
                status: healthStatus.status,
                nextDue: nextDueText,
            });
            
            await Share.share({
                title: t('health_passport.share_title', { name: dog.name }),
                message: message,
            });
        } catch (error) {
            Alert.alert(t('health_passport.export_failed'), t('health_passport.export_failed_msg'));
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // If fetching completed but no dog data is available, show retry to avoid blank crash
    if (!dog) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.center}>
                    <Text style={styles.emptyText}>{t('health_passport.unable_load')}</Text>
                    <TouchableOpacity onPress={fetchPassportData} style={styles.retryBtn}>
                        <Text style={styles.retryText}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const healthStatus = getHealthStatus();
    const nextDueDates = getNextDueDates();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('health_passport.title')}</Text>
                <TouchableOpacity onPress={handleExport} style={styles.backBtn}>
                    <Ionicons name="share-outline" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* IDENTITY SECTION */}
                <View style={styles.idCard}>
                    <View style={styles.idHeader}>
                        <View style={styles.profileCircle}>
                            <Ionicons name="paw" size={40} color={COLORS.white} />
                        </View>
                        <View style={styles.idMeta}>
                            <Text style={styles.dogName}>{dog.name}</Text>
                            <Text style={styles.dogBreed}>{dog.breed || t('health_passport.unknown_breed')}</Text>
                        </View>
                    </View>
                    <View style={styles.idStats}>
                        <View style={styles.idStatItem}>
                            <Text style={styles.statLabel}>{t('health_passport.age')}</Text>
                            <Text style={styles.statValue}>{dog.age || '?'} {t('health_passport.years')}</Text>
                        </View>
                        <View style={styles.idStatDivider} />
                        <View style={styles.idStatItem}>
                            <Text style={styles.statLabel}>{t('health_passport.weight')}</Text>
                            <Text style={styles.statValue}>{dog.weight || '?'} kg</Text>
                        </View>
                        <View style={styles.idStatDivider} />
                        <View style={styles.idStatItem}>
                            <Text style={styles.statLabel}>{t('health_passport.gender')}</Text>
                            <Text style={styles.statValue}>{dog.gender || 'M'}</Text>
                        </View>
                    </View>
                </View>

                {/* HEALTH STATUS SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('health_passport.current_status')}</Text>
                    <View style={styles.statusBox}>
                        <View style={[styles.statusIndicator, { backgroundColor: healthStatus.color }]}>
                            <Ionicons name={healthStatus.icon as any} size={28} color={COLORS.white} />
                        </View>
                        <Text style={styles.statusText}>{healthStatus.status}</Text>
                    </View>
                </View>

                {/* NEXT DUE DATES SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('health_passport.next_due_dates')}</Text>
                    {nextDueDates.length === 0 ? (
                        <View style={styles.recordItem}>
                            <Text style={styles.emptyText}>{t('health_passport.all_records_current')}</Text>
                        </View>
                    ) : (
                        nextDueDates.map((due, idx) => (
                            <View key={idx} style={[styles.recordItem, styles.dueItem]}>
                                <View style={styles.dueItemMeta}>
                                    <View style={[styles.dueTypeTag, { backgroundColor: due.type === 'vaccination' ? '#E8F5E9' : '#E3F2FD' }]}>
                                        <Text style={[styles.dueTypeText, { color: due.type === 'vaccination' ? '#2E7D32' : '#1565C0' }]}>
                                            {due.type.toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={styles.dueDateValue}>{due.date.toLocaleDateString()}</Text>
                                </View>
                                {due.notes && <Text style={styles.dueNotes}>{due.notes}</Text>}
                            </View>
                        ))
                    )}
                </View>

                {/* DISCLAIMER */}
                <View style={styles.section}>
                    <View style={[styles.recordItem, styles.infoBox]}>
                        <Text style={styles.infoText}>{t('health_passport.info_text')}</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    content: { padding: SPACING.lg },
    idCard: { backgroundColor: COLORS.primary, borderRadius: 20, padding: 24, ...SHADOWS.medium, marginBottom: 25 },
    idHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    profileCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.accent },
    idMeta: { marginLeft: 20 },
    dogName: { fontSize: 24, fontWeight: 'bold', color: COLORS.white },
    dogBreed: { fontSize: 16, color: COLORS.white, opacity: 0.8 },
    idStats: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15 },
    idStatItem: { flex: 1, alignItems: 'center' },
    idStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
    statLabel: { fontSize: 10, color: COLORS.white, opacity: 0.6, marginBottom: 4 },
    statValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.white },
    section: { marginBottom: 25 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 15 },
    statusBox: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, ...SHADOWS.small, flexDirection: 'row', alignItems: 'center' },
    statusIndicator: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    statusText: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, flex: 1 },
    recordItem: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, ...SHADOWS.small },
    dueItem: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
    dueItemMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    dueTypeTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    dueTypeText: { fontSize: 10, fontWeight: 'bold' },
    dueDateValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
    dueNotes: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
    infoBox: { backgroundColor: '#E3F2FD', borderStyle: 'dashed', borderWidth: 1, borderColor: '#1976D2' },
    infoText: { fontSize: 12, color: '#1565C0', fontStyle: 'italic', textAlign: 'center' },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 10 }
    ,
    retryBtn: { marginTop: 12, backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    retryText: { color: COLORS.white, fontWeight: 'bold' }
});
