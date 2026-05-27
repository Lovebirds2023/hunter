import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { SyncContext } from '../context/SyncContext';

const BEHAVIORS = [
    { id: 'engagement', label: 'Engagement', icon: 'happy-outline', color: '#4CAF50' },
    { id: 'calmness', label: 'Calmness', icon: 'leaf-outline', color: '#2196F3' },
    { id: 'panting', label: 'Panting', icon: 'water-outline', color: '#FF9800' },
    { id: 'freezing', label: 'Freezing', icon: 'snow-outline', color: '#f44336' },
    { id: 'avoidance', label: 'Avoidance', icon: 'walk-outline', color: '#9C27B0' },
    { id: 'yawning', label: 'Yawning/Lip licking', icon: 'sad-outline', color: '#FF5722' }
];

const INTENSITIES = ['Low', 'Medium', 'High'];

export const FacilitatorDashboardScreen = ({ route, navigation }) => {
    const { event_id } = route.params;
    const { queueObservation } = useContext(SyncContext);
    
    // For MVP, we assume we want to log for a "general" participant or specific selected one.
    // In a full app we'd fetch a list of registered participants. Here we mock participant selection.
    const [selectedParticipant, setSelectedParticipant] = useState("user-123"); 
    const [selectedBehavior, setSelectedBehavior] = useState(null);
    const [selectedIntensity, setSelectedIntensity] = useState('Medium');

    const handleLogBehavior = async (behaviorId) => {
        const obs = {
            participant_id: selectedParticipant,
            behavior: behaviorId,
            intensity: selectedIntensity,
            timestamp: new Date().toISOString()
        };
        await queueObservation(event_id, obs);
        
        // Visual feedback
        Alert.alert("Logged", `Behavior '${behaviorId}' logged successfully (Offline-ready)`);
        setSelectedBehavior(null);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 15 }}>
                    <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Live Session Log</Text>
            </View>

            <View style={styles.infoBox}>
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Active Participant: John Doe & Max (Dog)</Text>
                <Text style={{ color: '#666', marginTop: 5 }}>Tap behaviors below to instantly log them with a timestamp.</Text>
            </View>

            <View style={styles.intensitySelector}>
                <Text style={{ fontWeight: 'bold', marginRight: 10 }}>Intensity:</Text>
                {INTENSITIES.map(int => (
                    <TouchableOpacity 
                        key={int} 
                        style={[styles.intensityBtn, selectedIntensity === int && styles.intensityActive]}
                        onPress={() => setSelectedIntensity(int)}
                    >
                        <Text style={[styles.intensityText, selectedIntensity === int && { color: 'white' }]}>{int}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.grid}>
                {BEHAVIORS.map(b => (
                    <TouchableOpacity 
                        key={b.id} 
                        style={styles.gridItem}
                        onPress={() => handleLogBehavior(b.id)}
                    >
                        <View style={[styles.iconBox, { backgroundColor: b.color + '20' }]}>
                            <Ionicons name={b.icon} size={32} color={b.color} />
                        </View>
                        <Text style={styles.gridLabel}>{b.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity 
                style={styles.flagBtn}
                onPress={() => handleLogBehavior('adverse_event')}
            >
                <Ionicons name="warning" size={24} color="white" style={{ marginRight: 10 }} />
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Flag Adverse Event</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fcfcfc' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: 'white' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    infoBox: { margin: 20, padding: 15, backgroundColor: '#E8F4F8', borderRadius: 10 },
    intensitySelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
    intensityBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eee', marginRight: 10 },
    intensityActive: { backgroundColor: COLORS.primary },
    intensityText: { color: '#333', fontWeight: '500' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10 },
    gridItem: { width: '45%', margin: '2.5%', backgroundColor: 'white', padding: 20, borderRadius: 15, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    iconBox: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    gridLabel: { fontWeight: 'bold', color: '#444' },
    flagBtn: { margin: 20, backgroundColor: '#f44336', padding: 20, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }
});
