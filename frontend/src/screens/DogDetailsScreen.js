import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useFocusEffect } from '@react-navigation/native';

const buildEditForm = (dog = {}) => ({
    name: dog.name || '',
    breed: dog.breed || '',
    color: dog.color || '',
    age: dog.age === null || dog.age === undefined ? '' : String(dog.age),
    weight: dog.weight === null || dog.weight === undefined ? '' : String(dog.weight),
    body_structure: dog.body_structure || '',
    bio: dog.bio || '',
});

const numberOrZero = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const DogDetailsScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const { dog: initialDog } = route.params;
    const [dog, setDog] = useState(initialDog);
    const [healthRecords, setHealthRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [editForm, setEditForm] = useState(buildEditForm(initialDog));

    const setField = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const fetchDogDetails = async (dogId) => {
        try {
            const res = await client.get(`/dogs/${dogId}`);
            setDog(res.data);
            setEditForm(buildEditForm(res.data));
        } catch (e) {
            if (__DEV__) console.log('Error fetching pet details', e);
        }
    };

    const fetchHealthRecords = async (dogId) => {
        setLoading(true);
        try {
            const res = await client.get(`/dogs/${dogId}/health-records`);
            setHealthRecords(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            if (__DEV__) console.log('Error fetching health records', e);
            setHealthRecords([]);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            const activeDog = route.params?.dog || initialDog;
            if (!activeDog?.id) return undefined;
            setDog(activeDog);
            setEditForm(buildEditForm(activeDog));
            fetchDogDetails(activeDog.id);
            fetchHealthRecords(activeDog.id);
            return undefined;
        }, [route.params?.dog?.id])
    );

    const openEditor = () => {
        setEditForm(buildEditForm(dog));
        setIsEditing(true);
    };

    const handleSaveDog = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const payload = {
                name: editForm.name.trim() || dog.name,
                breed: editForm.breed.trim(),
                color: editForm.color.trim(),
                age: numberOrZero(editForm.age),
                weight: numberOrZero(editForm.weight),
                pet_type: dog.pet_type || 'dog',
                body_structure: editForm.body_structure.trim(),
                bio: editForm.bio,
            };
            const res = await client.put(`/dogs/${dog.id}`, payload);
            setDog(res.data);
            setEditForm(buildEditForm(res.data));
            setIsEditing(false);
            Alert.alert(t('common.success'), t('dog_details.updated', { defaultValue: 'Pet updated successfully.' }));
        } catch (e) {
            if (__DEV__) console.log('Error updating pet', e);
            Alert.alert(t('common.error'), t('dog_details.update_error', { defaultValue: 'Could not update this pet.' }));
        } finally {
            setSaving(false);
        }
    };

    const deleteDog = async () => {
        if (deleting || !dog?.id) return;
        setDeleting(true);
        try {
            await client.delete(`/dogs/${dog.id}`);
            setDeleteModalVisible(false);
            Alert.alert(t('common.success'), t('dog_details.deleted', { defaultValue: 'Pet deleted successfully.' }));
            navigation.goBack();
        } catch (e) {
            if (__DEV__) console.log('Error deleting pet', e);
            const message = e?.response?.data?.detail || t('dog_details.delete_error', { defaultValue: 'Could not delete this pet.' });
            Alert.alert(t('common.error'), message);
        } finally {
            setDeleting(false);
        }
    };

    const confirmDeleteDog = () => {
        if (deleting) return;
        setDeleteModalVisible(true);
    };

    const renderHealthRecord = ({ item }) => (
        <View style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <Text style={styles.recordType}>{String(item.record_type || '').toUpperCase()}</Text>
                <Text style={styles.recordDate}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            {item.next_due_date && (
                <Text style={styles.dueDate}>{t('dog_details.next_due')}: {new Date(item.next_due_date).toLocaleDateString()}</Text>
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
                <Text style={styles.headerTitle} numberOfLines={1}>{dog.name}</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={openEditor} style={styles.iconButton}>
                        <Ionicons name="pencil" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={confirmDeleteDog} style={styles.iconButton} disabled={deleting}>
                        <Ionicons name="trash-outline" size={22} color={COLORS.error || '#B3261E'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.imageGallery}>
                    <View style={styles.mainImageContainer}>
                        <Image source={dog.body_image ? { uri: dog.body_image } : require('../../assets/dog_placeholder.png')} style={styles.mainImage} />
                        <Text style={styles.imageLabel}>{t('dog_details.body')}</Text>
                    </View>
                    <View style={styles.smallImages}>
                        <View style={styles.smallImageContainer}>
                            <Image source={dog.nose_print_image ? { uri: dog.nose_print_image } : require('../../assets/dog_placeholder.png')} style={styles.smallImage} />
                            <Text style={styles.imageLabel}>{t('dog_details.nose_print')}</Text>
                        </View>
                        <View style={styles.smallImageContainer}>
                            <Image source={dog.birthmark_image ? { uri: dog.birthmark_image } : require('../../assets/dog_placeholder.png')} style={styles.smallImage} />
                            <Text style={styles.imageLabel}>{t('dog_details.birth_mark')}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoText}>{t('dog_details.breed')}: <Text style={styles.infoValue}>{dog.breed || '-'}</Text></Text>
                    <Text style={styles.infoText}>{t('dog_details.color')}: <Text style={styles.infoValue}>{dog.color || '-'}</Text></Text>
                    <Text style={styles.infoText}>{t('dog_details.size')}: <Text style={styles.infoValue}>{dog.body_structure || '-'}</Text></Text>
                    <Text style={styles.infoText}>{t('dog_details.age', { defaultValue: 'Age' })}: <Text style={styles.infoValue}>{dog.age ?? '-'}</Text></Text>
                    <Text style={styles.infoText}>{t('dog_details.weight', { defaultValue: 'Weight' })}: <Text style={styles.infoValue}>{dog.weight ?? '-'}</Text></Text>
                    {dog.bio ? (
                        <View style={styles.bioContainer}>
                            <Text style={styles.bioLabel}>{t('dog_details.about_pet', { name: dog.name })}</Text>
                            <Text style={styles.bioText}>{dog.bio}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.healthSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('dog_details.health_records')}</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('AddHealthRecord', { dogId: dog.id, dogName: dog.name })}>
                            <Text style={styles.addButton}>{t('dog_details.add_record')}</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <Text style={styles.emptyText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
                    ) : healthRecords.length === 0 ? (
                        <Text style={styles.emptyText}>{t('dog_details.no_records')}</Text>
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
                        <Text style={styles.modalTitle}>{t('dog_details.edit_pet', { name: dog.name })}</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>{t('dog_details.name', { defaultValue: 'Name' })}</Text>
                            <TextInput style={styles.input} value={editForm.name} onChangeText={value => setField('name', value)} />
                            <Text style={styles.label}>{t('dog_details.breed')}</Text>
                            <TextInput style={styles.input} value={editForm.breed} onChangeText={value => setField('breed', value)} />
                            <Text style={styles.label}>{t('dog_details.color')}</Text>
                            <TextInput style={styles.input} value={editForm.color} onChangeText={value => setField('color', value)} />
                            <View style={styles.formRow}>
                                <View style={styles.formCol}>
                                    <Text style={styles.label}>{t('dog_details.age', { defaultValue: 'Age' })}</Text>
                                    <TextInput style={styles.input} value={editForm.age} onChangeText={value => setField('age', value)} keyboardType="numeric" />
                                </View>
                                <View style={styles.formCol}>
                                    <Text style={styles.label}>{t('dog_details.weight', { defaultValue: 'Weight' })}</Text>
                                    <TextInput style={styles.input} value={editForm.weight} onChangeText={value => setField('weight', value)} keyboardType="numeric" />
                                </View>
                            </View>
                            <Text style={styles.label}>{t('dog_details.size')}</Text>
                            <TextInput style={styles.input} value={editForm.body_structure} onChangeText={value => setField('body_structure', value)} />
                            <Text style={styles.label}>{t('dog_details.bio_notes')}</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={editForm.bio}
                                onChangeText={value => setField('bio', value)}
                                multiline
                                numberOfLines={4}
                                placeholder={t('dog_details.bio_placeholder')}
                            />
                        </ScrollView>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)} disabled={saving}>
                                <Text style={styles.btnText}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDog} disabled={saving}>
                                <Text style={[styles.btnText, { color: 'white' }]}>{saving ? t('common.saving', { defaultValue: 'Saving...' }) : t('common.save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={deleteModalVisible} animationType="fade" transparent onRequestClose={() => !deleting && setDeleteModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.deleteModalContent}>
                        <View style={styles.deleteIconCircle}>
                            <Ionicons name="trash-outline" size={30} color={COLORS.error || '#B3261E'} />
                        </View>
                        <Text style={styles.modalTitle}>{t('dog_details.delete_title', { defaultValue: 'Delete pet?' })}</Text>
                        <Text style={styles.deleteMessage}>
                            {t('dog_details.delete_message', { name: dog.name, defaultValue: `Delete ${dog.name}? This cannot be undone.` })}
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)} disabled={deleting}>
                                <Text style={styles.btnText}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.deleteBtn, deleting && styles.disabledBtn]} onPress={deleteDog} disabled={deleting}>
                                {deleting ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={[styles.btnText, { color: 'white' }]}>{t('common.delete', { defaultValue: 'Delete' })}</Text>
                                )}
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
    backButton: { padding: 6 },
    headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: COLORS.primary, marginHorizontal: SPACING.sm },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { padding: 8, marginLeft: 4 },
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { maxHeight: '90%', backgroundColor: 'white', borderRadius: 15, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    label: { fontWeight: '600', marginBottom: 5, color: '#444' },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9' },
    textArea: { height: 100, textAlignVertical: 'top' },
    formRow: { flexDirection: 'row', gap: 12 },
    formCol: { flex: 1 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    cancelBtn: { padding: 12, borderRadius: 8, flex: 1, marginRight: 10, backgroundColor: '#eee', alignItems: 'center' },
    saveBtn: { padding: 12, borderRadius: 8, flex: 1, marginLeft: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
    deleteBtn: { padding: 12, borderRadius: 8, flex: 1, marginLeft: 10, backgroundColor: COLORS.error || '#B3261E', alignItems: 'center' },
    disabledBtn: { opacity: 0.7 },
    deleteModalContent: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: 'white', borderRadius: 15, padding: 20, alignItems: 'center' },
    deleteIconCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FCEEEE', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    deleteMessage: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 10 },
    btnText: { fontWeight: 'bold' },
});
