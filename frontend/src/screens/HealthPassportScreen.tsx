
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
            Alert.alert("Error", "Could not load health passport");
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        // For now, implement a Share logic which is safe and cross-platform
        try {
            const history = records.map(r => `${r.date.split('T')[0]}: ${r.record_type.toUpperCase()} - ${r.notes || 'No notes'}`).join('\n');
            const message = `Lovedogs 360 Health Passport\n\nDog: ${dog.name}\nBreed: ${dog.breed}\nWeight: ${dog.weight}kg\n\nMedical History:\n${history}`;
            
            await Share.share({
                title: `${dog.name} Health Passport`,
                message: message,
            });
        } catch (error) {
            Alert.alert('Export Failed', 'Could not generate shareable report.');
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Digital Health Passport</Text>
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
                            <Text style={styles.dogBreed}>{dog.breed || 'Unknown Breed'}</Text>
                        </View>
                    </View>
                    <View style={styles.idStats}>
                        <View style={styles.idStatItem}>
                            <Text style={styles.statLabel}>AGE</Text>
                            <Text style={styles.statValue}>{dog.age || '?'} Years</Text>
                        </View>
                        <View style={styles.idStatDivider} />
                        <View style={styles.idStatItem}>
                            <Text style={styles.statLabel}>WEIGHT</Text>
                            <Text style={styles.statValue}>{dog.weight || '?'} kg</Text>
                        </View>
                        <View style={styles.idStatDivider} />
                        <View style={styles.idStatItem}>
                            <Text style={styles.statLabel}>GENDER</Text>
                            <Text style={styles.statValue}>{dog.gender || 'M'}</Text>
                        </View>
                    </View>
                </View>

                {/* RECORDS TIMELINE */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Medical History</Text>
                    {records.length === 0 ? (
                        <Text style={styles.emptyText}>No medical records found.</Text>
                    ) : (
                        records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((record, idx) => (
                            <View key={record.id} style={styles.recordItem}>
                                <View style={styles.recordMeta}>
                                    <View style={[styles.typeTag, { backgroundColor: record.record_type === 'vaccination' ? '#E8F5E9' : '#E3F2FD' }]}>
                                        <Text style={[styles.typeText, { color: record.record_type === 'vaccination' ? '#2E7D32' : '#1565C0' }]}>
                                            {record.record_type.toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={styles.recordDate}>{new Date(record.date).toLocaleDateString()}</Text>
                                </View>
                                <Text style={styles.recordNotes}>{record.notes || 'Routine checkup completed.'}</Text>
                                {record.next_due_date && (
                                    <View style={styles.dueSoon}>
                                        <Ionicons name="alert-circle" size={14} color="#E65100" />
                                        <Text style={styles.dueText}>Next due: {new Date(record.next_due_date).toLocaleDateString()}</Text>
                                    </View>
                                )}
                            </View>
                        ))
                    )}
                </View>

                {/* VETERINARY NOTES STUB */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Clinical Observations</Text>
                    <View style={[styles.recordItem, styles.infoBox]}>
                        <Text style={styles.infoText}>This passport is a digital verification of records provided by the owner through the Lovedogs 360 platform.</Text>
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
    recordItem: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, ...SHADOWS.small },
    recordMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    typeTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    typeText: { fontSize: 10, fontWeight: 'bold' },
    recordDate: { fontSize: 12, color: COLORS.textSecondary },
    recordNotes: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
    dueSoon: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#FFF3E0', padding: 8, borderRadius: 8 },
    dueText: { fontSize: 12, color: '#E65100', fontWeight: 'bold', marginLeft: 6 },
    infoBox: { backgroundColor: '#E3F2FD', borderStyle: 'dashed', borderWidth: 1, borderColor: '#1976D2' },
    infoText: { fontSize: 12, color: '#1565C0', fontStyle: 'italic', textAlign: 'center' },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 10 }
});
