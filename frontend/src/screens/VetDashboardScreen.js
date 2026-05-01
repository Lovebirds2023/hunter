import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { SyncContext } from '../context/SyncContext';

export const VetDashboardScreen = ({ route, navigation }) => {
    const { event_id } = route.params;
    const { queueObservation } = useContext(SyncContext);
    
    const [selectedParticipant, setSelectedParticipant] = useState("user-123"); 
    const [dogId, setDogId] = useState("dog-456");
    const [notes, setNotes] = useState("");

    const handleAction = async (actionType) => {
        const obs = {
            participant_id: selectedParticipant,
            dog_id: dogId,
            behavior: actionType,
            intensity: 'High',
            notes: notes,
            timestamp: new Date().toISOString()
        };
        await queueObservation(event_id, obs);
        
        Alert.alert("Recorded", `Action '${actionType}' recorded offline.`);
        setNotes("");
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 15 }}>
                    <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Professional Observer Dashboard</Text>
            </View>

            <View style={styles.infoBox}>
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Participant: John Doe</Text>
                <Text style={{ fontSize: 16, color: '#444', marginTop: 5 }}>Dog: Max (Golden Retriever)</Text>
            </View>

            <Text style={styles.sectionHeader}>Pre-Session Welfare Check</Text>
            <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#4CAF50' }]} onPress={() => handleAction('vet_approved')}>
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text style={styles.btnText}>Clear for Session</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#f44336' }]} onPress={() => handleAction('vet_rejected')}>
                    <Ionicons name="close-circle" size={20} color="white" />
                    <Text style={styles.btnText}>Flag for Review</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>Training Observation Notes</Text>
            <View style={styles.inputContainer}>
                <TextInput 
                    style={styles.input}
                    placeholder="Enter training observations and welfare notes..."
                    multiline
                    numberOfLines={4}
                    value={notes}
                    onChangeText={setNotes}
                />
            </View>

            <TouchableOpacity style={styles.logBtn} onPress={() => handleAction('vet_observation_note')}>
                <Text style={styles.logBtnText}>Log Observation Note (Offline-ready)</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fcfcfc' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: 'white' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    infoBox: { margin: 20, padding: 15, backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', marginLeft: 20, marginTop: 10, marginBottom: 10, color: COLORS.secondary },
    actionRow: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between', marginBottom: 20 },
    btn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 10, width: '48%', justifyContent: 'center' },
    btnText: { color: 'white', fontWeight: 'bold', marginLeft: 5 },
    inputContainer: { paddingHorizontal: 20, marginBottom: 20 },
    input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 15, fontSize: 16, textAlignVertical: 'top' },
    logBtn: { marginHorizontal: 20, backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
    logBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
