import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';

export const AdminProgramReportsScreen = ({ route, navigation }) => {
    // Optional: event_id from route to show specific event report
    const { event_id } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState({
        total_participants: 120,
        completion_t1: 95,
        completion_t2: 80,
        completion_t3: 50,
        completion_t4: 30,
        impact: {
            stress_reduction: '22%',
            wellbeing_increase: '15%',
            bond_strength: '30%',
            welfare_stable: '98%'
        }
    });

    useEffect(() => {
        // In a full implementation, we'd call an endpoint like GET /admin/events/:id/report
        // For now, we simulate fetching aggregated data
        setTimeout(() => setLoading(false), 800);
    }, []);

    const ProgressRow = ({ label, percentage }) => (
        <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{label}</Text>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
            </View>
            <Text style={styles.progressValue}>{percentage}%</Text>
        </View>
    );

    const MetricCard = ({ title, value, icon, color }) => (
        <View style={[styles.metricCard, { borderTopColor: color, borderTopWidth: 4 }]}>
            <Ionicons name={icon} size={28} color={color} style={{ marginBottom: 10 }} />
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricTitle}>{title}</Text>
            <Text style={styles.metricDesc}>avg. improvement</Text>
        </View>
    );

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary}/></View>;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 15 }}>
                    <Ionicons name="arrow-back" size={28} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Impact Report</Text>
            </View>

            <View style={styles.topSummary}>
                <Text style={styles.summaryTitle}>Lovedogs 360 Program</Text>
                <Text style={styles.summarySubtitle}>Longitudinal Data Analysis (T1 - T4)</Text>
            </View>

            <Text style={styles.sectionTitle}>Journey Progression</Text>
            <View style={styles.card}>
                <Text style={styles.cardInfo}>Total Registrations: {reportData.total_participants}</Text>
                <ProgressRow label="T1 (Baseline)" percentage={reportData.completion_t1} />
                <ProgressRow label="T2 (Post-Session)" percentage={reportData.completion_t2} />
                <ProgressRow label="T3 (8-Week Follow-up)" percentage={reportData.completion_t3} />
                <ProgressRow label="T4 (6-Month Follow-up)" percentage={reportData.completion_t4} />
            </View>

            <Text style={styles.sectionTitle}>Calculated Impact Metrics</Text>
            <View style={styles.metricsGrid}>
                <MetricCard title="Stress Reduction" value={reportData.impact.stress_reduction} icon="trending-down" color="#4CAF50" />
                <MetricCard title="Wellbeing Increase" value={reportData.impact.wellbeing_increase} icon="trending-up" color="#2196F3" />
                <MetricCard title="Bond Strength" value={reportData.impact.bond_strength} icon="heart" color="#E91E63" />
                <MetricCard title="Welfare Stability" value={reportData.impact.welfare_stable} icon="paw" color="#FF9800" />
            </View>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: COLORS.primary },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    topSummary: { backgroundColor: COLORS.primary, padding: 20, paddingBottom: 40, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    summaryTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
    summarySubtitle: { fontSize: 16, color: '#e0e0e0', marginTop: 5 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', margin: 20, marginBottom: 10, color: COLORS.secondary },
    card: { backgroundColor: 'white', marginHorizontal: 20, padding: 20, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    cardInfo: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 20 },
    progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    progressLabel: { flex: 2, fontSize: 14, color: '#555' },
    progressBarBg: { flex: 3, height: 10, backgroundColor: '#eee', borderRadius: 5, overflow: 'hidden', marginHorizontal: 10 },
    progressBarFill: { height: '100%', backgroundColor: COLORS.primary },
    progressValue: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#333', textAlign: 'right' },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15, marginBottom: 30 },
    metricCard: { width: '45%', margin: '2.5%', backgroundColor: 'white', padding: 15, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    metricValue: { fontSize: 22, fontWeight: 'bold', color: '#333' },
    metricTitle: { fontSize: 14, fontWeight: 'bold', color: '#666', marginTop: 5 },
    metricDesc: { fontSize: 10, color: '#999', marginTop: 2 }
});
