import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator, Image, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import client from '../api/client';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const WellnessHubScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [dogs, setDogs] = useState<any[]>([]);
    const [activeDogIndex, setActiveDogIndex] = useState(0);
    
    const [healthStats, setHealthStats] = useState<{ vaccinations: number; appointments: number; records: any[] }>({ vaccinations: 0, appointments: 0, records: [] });
    const [wellnessScore, setWellnessScore] = useState<any>(null);
    const [advisorInsights, setAdvisorInsights] = useState<any>(null);
    
    const fetchGlobalData = async () => {
        try {
            setLoading(true);
            const [dogsRes, scoreRes] = await Promise.all([
                client.get('/my-dogs'),
                client.get('/health/wellness-score').catch(() => ({ data: null }))
            ]);
            
            const fetchedDogs = dogsRes.data;
            setDogs(fetchedDogs);
            setWellnessScore(scoreRes.data);
            
            if (fetchedDogs.length > 0) {
                await fetchDogSpecificData(fetchedDogs[0].id);
            }
        } catch (e) {
            console.error("Wellness fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchDogSpecificData = async (dogId: string) => {
        try {
            const [advisorRes, recordRes] = await Promise.all([
                client.get(`/health/advisor/${dogId}`).catch(() => ({ data: null })),
                client.get(`/dogs/${dogId}/health-records`).catch(() => ({ data: [] }))
            ]);
            
            setAdvisorInsights(advisorRes.data);
            
            const records = recordRes.data || [];
            const vax = records.filter((r: any) => r.record_type === 'vaccination').length;
            const appts = records.filter((r: any) => r.record_type === 'checkup').length;
            
            setHealthStats({
                vaccinations: vax,
                appointments: appts,
                records: records
            });
        } catch (e) {
            if (__DEV__) console.log("Dog specific fetch failed", e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchGlobalData();
        }, [])
    );

    const onDogSelect = async (index: number) => {
        setActiveDogIndex(index);
        setAdvisorInsights(null); // Clear while loading
        if (dogs[index]) {
            await fetchDogSpecificData(dogs[index].id);
        }
    };

    const handleAddRecord = (defaultType = '') => {
        if (!activeDog) {
            Alert.alert(
                t('wellness.dog_required_title'),
                t('wellness.dog_required_records'),
                [
                    { text: t('common.cancel'), style: "cancel" },
                    { text: t('wellness.add_pet'), onPress: () => navigation.navigate("DogRegistration") }
                ]
            );
            return;
        }
        navigation.navigate('AddHealthRecord', { dogId: activeDog.id, dogName: activeDog.name, defaultRecordType: defaultType });
    };

    const handlePassport = () => {
        if (!activeDog) {
            Alert.alert(t('wellness.dog_required_title'), t('wellness.dog_required_passport'), [
                { text: t('common.cancel'), style: "cancel" },
                { text: t('wellness.add_pet'), onPress: () => navigation.navigate("DogRegistration") }
            ]);
            return;
        }
        navigation.navigate('HealthPassport', { dogId: activeDog.id });
    };

    const ProgressCircle = ({ label, count, color }: any) => (
        <View style={styles.statBox}>
            <View style={[styles.circle, { borderColor: color }]}>
                <Text style={[styles.statCount, { color: color }]}>{count}</Text>
            </View>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    const activeDog = dogs[activeDogIndex];

    const getValidDate = (value: unknown) => {
        if (!value) return null;
        const date = new Date(String(value));
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const startOfToday = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    };

    const daysUntil = (date: Date) => Math.ceil((date.getTime() - startOfToday().getTime()) / MS_PER_DAY);

    const getRecordTypeLabel = (recordType: unknown) => {
        const key = String(recordType || '').trim();
        if (!key) return t('health.types.checkup');
        const fallback = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
        return t(`health.types.${key}`, { defaultValue: fallback });
    };

    const buildWellnessTip = () => {
        const advisorTip = typeof advisorInsights?.pro_tip === 'string' ? advisorInsights.pro_tip.trim() : '';
        if (advisorTip) return advisorTip;

        const firstAdvisorInsight = advisorInsights?.insights?.find((insight: unknown) => (
            typeof insight === 'string' && insight.trim().length > 0
        ));
        if (firstAdvisorInsight) {
            return t('wellness.pro_tips.advisor_key_takeaway', {
                insight: firstAdvisorInsight.trim(),
            });
        }

        if (!activeDog) {
            return t('wellness.pro_tips.no_pet');
        }

        const records = healthStats.records || [];
        const petName = activeDog.name || t('health_passport.unknown');
        const dueRecords = records
            .reduce((items: { record: any; dueDate: Date }[], record: any) => {
                const dueDate = getValidDate(record.next_due_date);
                if (dueDate) items.push({ record, dueDate });
                return items;
            }, [])
            .sort((a: any, b: any) => a.dueDate.getTime() - b.dueDate.getTime());

        const overdue = dueRecords.find(({ dueDate }: any) => daysUntil(dueDate) < 0);
        if (overdue) {
            return t('wellness.pro_tips.overdue', {
                name: petName,
                type: getRecordTypeLabel(overdue.record.record_type),
            });
        }

        const dueToday = dueRecords.find(({ dueDate }: any) => daysUntil(dueDate) === 0);
        if (dueToday) {
            return t('wellness.pro_tips.due_today', {
                name: petName,
                type: getRecordTypeLabel(dueToday.record.record_type),
            });
        }

        const dueSoon = dueRecords.find(({ dueDate }: any) => {
            const days = daysUntil(dueDate);
            return days > 0 && days <= 14;
        });
        if (dueSoon) {
            return t('wellness.pro_tips.due_soon', {
                name: petName,
                type: getRecordTypeLabel(dueSoon.record.record_type),
                count: daysUntil(dueSoon.dueDate),
            });
        }

        if (records.length === 0) {
            return t('wellness.pro_tips.no_records', { name: petName });
        }

        if (!records.some((record: any) => record.record_type === 'vaccination')) {
            return t('wellness.pro_tips.no_vaccination', { name: petName });
        }

        if (!records.some((record: any) => record.record_type === 'checkup')) {
            return t('wellness.pro_tips.no_checkup', { name: petName });
        }

        if (records.some((record: any) => record.record_type === 'medication')) {
            return t('wellness.pro_tips.medication', { name: petName });
        }

        if (records.some((record: any) => record.record_type === 'surgery')) {
            return t('wellness.pro_tips.surgery', { name: petName });
        }

        const age = Number(activeDog.age);
        if (Number.isFinite(age) && age > 0 && age < 1) {
            return t('wellness.pro_tips.young_pet', { name: petName });
        }
        if (Number.isFinite(age) && age >= 7) {
            return t('wellness.pro_tips.senior_pet', { name: petName });
        }

        const latestRecordDate = records
            .map((record: any) => getValidDate(record.date))
            .filter(Boolean)
            .sort((a: any, b: any) => b.getTime() - a.getTime())[0];
        if (latestRecordDate && Math.floor((Date.now() - latestRecordDate.getTime()) / MS_PER_DAY) <= 14) {
            return t('wellness.pro_tips.recent_record', { name: petName });
        }

        const rotatingTipKeys = [
            'rotate_hydration',
            'rotate_body_condition',
            'rotate_preventives',
            'rotate_notes',
        ];
        const seedText = String(activeDog.id || activeDog.name || '');
        const seed = seedText.split('').reduce((sum, char) => sum + char.charCodeAt(0), records.length);
        const index = (Math.floor(Date.now() / MS_PER_DAY) + seed) % rotatingTipKeys.length;
        return t(`wellness.pro_tips.${rotatingTipKeys[index]}`, { name: petName });
    };

    const proTipText = buildWellnessTip();

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('wellness.title')}</Text>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => handleAddRecord()}
                >
                    <Ionicons name="add" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            
                {/* DOG SELECTOR */}
                {dogs.length > 0 ? (
                    <View style={styles.dogSelectorContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.lg }}>
                            {dogs.map((dog, index) => (
                                <TouchableOpacity 
                                    key={dog.id} 
                                    style={[styles.dogPill, activeDogIndex === index && styles.dogPillActive]}
                                    onPress={() => onDogSelect(index)}
                                >
                                    <Image source={dog.body_image ? {uri: dog.body_image} : require('../../assets/dog_placeholder.png')} style={styles.dogPillImage} />
                                    <Text style={{ fontSize: 14, marginRight: 2 }}>{dog.pet_type === 'cat' ? '🐱' : '🐕'}</Text>
                                    <Text style={[styles.dogPillText, activeDogIndex === index && styles.dogPillTextActive]}>{dog.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                ) : (
                    <View style={{ paddingHorizontal: SPACING.lg, marginTop: 10, marginBottom: 10 }}>
                        <View style={[styles.advisorCard, { borderLeftColor: COLORS.primary }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                <Ionicons name="information-circle" size={24} color={COLORS.primary} />
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginLeft: 8 }}>{t('wellness.setup_required')}</Text>
                            </View>
                            <Text style={styles.insightText}>
                                {t('wellness.setup_desc')}
                            </Text>
                            <TouchableOpacity 
                                style={[styles.passportBtn, { marginTop: 15, marginBottom: 0 }]}
                                onPress={() => navigation.navigate("DogRegistration")}
                            >
                                <Ionicons name="add" size={20} color={COLORS.white} />
                                <Text style={styles.passportBtnText}>{t('wellness.register_pet')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={{ paddingHorizontal: SPACING.lg }}>
                    {/* HEALTH ADVISOR INSIGHTS FOR ACTIVE DOG */}
                    {advisorInsights && advisorInsights.insights?.length > 0 ? (
                        <View style={styles.advisorCard}>
                            <View style={styles.advisorHeader}>
                                <Ionicons name="sparkles" size={20} color={COLORS.secondary} />
                                <Text style={styles.advisorTitle}>{t('wellness.health_advisor', { name: activeDog?.name })}</Text>
                            </View>
                            {advisorInsights.insights.map((insight: string, idx: number) => (
                                <View key={idx} style={styles.insightRow}>
                                    <Text style={styles.insightBullet}>•</Text>
                                    <Text style={styles.insightText}>{insight}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        activeDog && (
                            <View style={[styles.advisorCard, { borderColor: '#E0E0E0', borderLeftColor: '#BDBDBD' }]}>
                                <Text style={styles.insightText}>{t('wellness.no_insights', { name: activeDog.name })}</Text>
                            </View>
                        )
                    )}

                    <TouchableOpacity
                        style={styles.passportBtn}
                        onPress={handlePassport}
                    >
                        <Ionicons name="document-attach" size={20} color={COLORS.white} />
                        <Text style={styles.passportBtnText}>{t('wellness.view_passport')}</Text>
                    </TouchableOpacity>

                    {/* Quick Stats Grid */}
                    <View style={styles.statsGrid}>
                        <ProgressCircle label={t('wellness.active_vaccinations')} count={healthStats.vaccinations} color="#4CAF50" />
                        <ProgressCircle label={t('wellness.upcoming_vets')} count={healthStats.appointments} color="#FF9800" />
                    </View>

                    {/* Wellness Categories */}
                    <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                        <Text style={styles.sectionTitle}>{t('wellness.track_wellness')}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => handleAddRecord('vaccination')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                            <Ionicons name="medkit" size={22} color="#2E7D32" />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionName}>{t('wellness.sections.vaccination_title', 'Vaccinations')}</Text>
                            <Text style={styles.actionDesc}>{t('wellness.log_vaccines')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.actionRow}
                        onPress={() => handleAddRecord('diet')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
                            <Ionicons name="nutrition" size={22} color="#7B1FA2" />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionName}>{t('wellness.sections.diet_title')}</Text>
                            <Text style={styles.actionDesc}>{t('wellness.update_weight')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.actionRow}
                        onPress={() => handleAddRecord('medication')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#E1F5FE' }]}>
                            <Ionicons name="medical" size={22} color="#0288D1" />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionName}>{t('wellness.medication')}</Text>
                            <Text style={styles.actionDesc}>{t('wellness.log_medications')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.actionRow}
                        onPress={() => handleAddRecord('surgery')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#FFEBEE' }]}>
                            <Ionicons name="bandage" size={22} color="#C62828" />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionName}>{t('wellness.surgery')}</Text>
                            <Text style={styles.actionDesc}>{t('wellness.log_surgeries')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.actionRow}
                        onPress={() => handleAddRecord('vet_notes')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
                            <Ionicons name="document-text" size={22} color="#E65100" />
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionName}>{t('wellness.sections.vet_notes_title')}</Text>
                            <Text style={styles.actionDesc}>{t('wellness.save_notes')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                    </TouchableOpacity>

                    {/* Pro Tip */}
                    <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryDark]}
                        style={styles.proTip}
                    >
                        <Ionicons name="bulb" size={24} color={COLORS.accent} />
                        <View style={styles.proTipContent}>
                            <Text style={styles.proTipTitle}>{t('wellness.pro_tip')}</Text>
                            <Text style={styles.proTipText}>{proTipText}</Text>
                        </View>
                    </LinearGradient>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    container: { flex: 1 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: SPACING.lg, marginTop: 10, marginBottom: 20 },
    backBtn: { padding: 8, backgroundColor: COLORS.white, borderRadius: 12, ...SHADOWS.small },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    
    dogSelectorContainer: { height: 60, marginBottom: SPACING.md },
    dogPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 25, paddingHorizontal: 12, paddingVertical: 8, marginRight: 15, borderWidth: 2, borderColor: 'transparent', ...SHADOWS.small },
    dogPillActive: { borderColor: COLORS.primary, backgroundColor: '#F0F7FF' },
    dogPillImage: { width: 30, height: 30, borderRadius: 15, marginRight: 10, backgroundColor: '#EEE' },
    dogPillText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
    dogPillTextActive: { color: COLORS.primary, fontWeight: 'bold' },

    // ADVISOR CARD
    advisorCard: { backgroundColor: '#F0F7FF', borderRadius: 20, padding: 20, marginBottom: SPACING.lg, borderLeftWidth: 4, borderLeftColor: COLORS.secondary },
    advisorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    advisorTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginLeft: 8 },
    insightRow: { flexDirection: 'row', marginBottom: 8 },
    insightBullet: { fontSize: 18, color: COLORS.secondary, marginRight: 8, marginTop: -2 },
    insightText: { fontSize: 13, color: COLORS.text, flex: 1, lineHeight: 18 },

    passportBtn: { flexDirection: 'row', backgroundColor: COLORS.secondary, padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg, ...SHADOWS.small },
    passportBtnText: { color: COLORS.white, fontWeight: 'bold', marginLeft: 10, fontSize: 14 },

    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg },
    statBox: { backgroundColor: COLORS.white, width: (width - SPACING.lg*2 - 15) / 2, borderRadius: 20, padding: SPACING.md, alignItems: 'center', ...SHADOWS.small },
    circle: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    statCount: { fontSize: 20, fontWeight: 'bold' },
    statLabel: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
    
    sectionHeader: { marginBottom: SPACING.md },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    actionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 16, marginBottom: 12, ...SHADOWS.small },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    actionContent: { flex: 1, marginLeft: 15 },
    actionName: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
    actionDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    proTip: { flexDirection: 'row', padding: 20, borderRadius: 20, marginTop: 10, alignItems: 'center' },
    proTipContent: { marginLeft: 15, flex: 1 },
    proTipTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.accent },
    proTipText: { fontSize: 13, color: COLORS.white, opacity: 0.9, lineHeight: 18 }
});
