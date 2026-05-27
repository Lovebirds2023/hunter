
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useFocusEffect } from '@react-navigation/native';

export const DogDetailsScreen = ({ route, navigation }) => {
    const { dog: initialDog } = route.params;
    const [dog, setDog] = useState(initialDog);
    const [healthRecords, setHealthRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editBio, setEditBio] = useState('');

    const fetchDogDetails = async () => {
        // Fetch fresh dog details in case of updates
        try {
            // Note: We don't have a direct get /dogs/{id} endpoint yet, but we can assume we might need one or just update local state.
            // For now, let's just rely on the passed param or if we added an endpoint.
            // Actually, we added PUT /dogs/{id} but not explicit GET /dogs/{id}. 
            // We can assume the list refresh in Profile will handle it, but for local state update we can just use the response from PUT.
        } catch (e) { }
    };

    const fetchHealthRecords = async () => {
        try {
            const res = await client.get(`/dogs/${dog.id}/health-records`);
            setHealthRecords(res.data);
        } catch (e) {
            if (__DEV__) console.log('Error fetching health records', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchHealthRecords();
            setDog(initialDog); // Reset to initial or if we had a way to fetch fresh.
            setEditBio(initialDog.bio || '');
        }, [initialDog])
    );

    const handleSaveDog = async () => {
        try {
            const res = await client.put(`/dogs/${dog.id}`, {
                bio: editBio
            });
            setDog(res.data);
            setIsEditing(false);
            Alert.alert("Success", "Dog details updated!");
        } catch (e) {
            if (__DEV__) console.log("Error updating dog", e);
            Alert.alert("Error", "Could not update dog details");
        }
    };

    const renderHealthRecord = ({ item }) => (
        <View style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <Text style={styles.recordType}>{item.record_type.toUpperCase()}</Text>
                <Text style={styles.recordDate}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            {item.next_due_date && (
                <Text style={styles.dueDate}>Next Due: {new Date(item.next_due_date).toLocaleDateString()}</Text>
            )}
            {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{dog.name}</Text>
                <TouchableOpacity onPress={() => { setEditBio(dog.bio || ''); setIsEditing(true); }}>
                    <Ionicons name="pencil" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.imageGallery}>
                    <View style={styles.mainImageContainer}>
                        <Image source={dog.body_image ? { uri: dog.body_image } : require('../../assets/dog_placeholder.png')} style={styles.mainImage} />
                        <Text style={styles.imageLabel}>Body</Text>
                    </View>
                    <View style={styles.smallImages}>
                        <View style={styles.smallImageContainer}>
                            <Image source={dog.nose_print_image ? { uri: dog.nose_print_image } : require('../../assets/dog_placeholder.png')} style={styles.smallImage} />
                            <Text style={styles.imageLabel}>Nose Print</Text>
                        </View>
                        <View style={styles.smallImageContainer}>
                            <Image source={dog.birthmark_image ? { uri: dog.birthmark_image } : require('../../assets/dog_placeholder.png')} style={styles.smallImage} />
                            <Text style={styles.imageLabel}>Birth Mark</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoText}>Breed: <Text style={styles.infoValue}>{dog.breed}</Text></Text>
                    <Text style={styles.infoText}>Color: <Text style={styles.infoValue}>{dog.color}</Text></Text>
                    <Text style={styles.infoText}>Size: <Text style={styles.infoValue}>{dog.body_structure}</Text></Text>
                    {dog.bio && (
                        <View style={styles.bioContainer}>
                            <Text style={styles.bioLabel}>About {dog.name}:</Text>
                            <Text style={styles.bioText}>{dog.bio}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.healthSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Health Records</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('AddHealthRecord', { dogId: dog.id, dogName: dog.name })}>
                            <Text style={styles.addButton}>+ Add Record</Text>
                        </TouchableOpacity>
                    </View>

                    {healthRecords.length === 0 ? (
                        <Text style={styles.emptyText}>No health records found.</Text>
                    ) : (
                        healthRecords.map(item => (
                            <View key={item.id} style={styles.recordWrapper}>
                                {renderHealthRecord({ item })}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            <Modal visible={isEditing} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit {dog.name}</Text>
                        <Text style={styles.label}>Bio / Notes</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={editBio}
                            onChangeText={setEditBio}
                            multiline
                            numberOfLines={4}
                            placeholder="Tell us about your dog..."
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                                <Text style={styles.btnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDog}>
                                <Text style={[styles.btnText, { color: 'white' }]}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    scrollContent: { paddingBottom: SPACING.xl },
    imageGallery: { padding: SPACING.md },
    mainImageContainer: { alignItems: 'center', marginBottom: SPACING.sm },
    mainImage: { width: '100%', height: 200, borderRadius: 10, resizeMode: 'cover' },
    smallImages: { flexDirection: 'row', justifyContent: 'space-between' },
    smallImageContainer: { width: '48%', alignItems: 'center' },
    smallImage: { width: '100%', height: 100, borderRadius: 10, resizeMode: 'cover' },
    imageLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
    infoSection: { padding: SPACING.md, backgroundColor: COLORS.white, margin: SPACING.md, borderRadius: 10 },
    infoText: { fontSize: 16, marginBottom: 5, color: COLORS.textSecondary },
    infoValue: { fontWeight: '600', color: COLORS.text },
    bioContainer: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
    bioLabel: { fontWeight: 'bold', marginBottom: 5, color: COLORS.primary },
    bioText: { fontStyle: 'italic', color: COLORS.text },
    healthSection: { padding: SPACING.md },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    addButton: { color: COLORS.primary, fontWeight: 'bold' },
    recordWrapper: { marginBottom: SPACING.sm },
    recordCard: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: COLORS.secondary },
    recordHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    recordType: { fontWeight: 'bold', color: COLORS.primary },
    recordDate: { color: COLORS.textSecondary },
    dueDate: { color: COLORS.accent, fontWeight: '600', marginTop: 5 },
    notes: { fontStyle: 'italic', marginTop: 5, color: COLORS.textSecondary },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.md },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 15, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    label: { fontWeight: '600', marginBottom: 5, color: '#444' },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9' },
    textArea: { height: 100, textAlignVertical: 'top' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    cancelBtn: { padding: 12, borderRadius: 8, flex: 1, marginRight: 10, backgroundColor: '#eee', alignItems: 'center' },
    saveBtn: { padding: 12, borderRadius: 8, flex: 1, marginLeft: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
    btnText: { fontWeight: 'bold' }
});
