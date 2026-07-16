import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import client from '../api/client';
import { colors } from '../theme/colors';
import { getBreedsForPetType, getColorsForPetType } from '../constants/data';
import { runtimeConfig } from '../config/runtimeConfig';
import { uploadImagesToSupabase } from '../utils/uploadImages';
import { getActionableErrorMessage, getUploadErrorMessage } from '../utils/apiErrors';

const LostFoundScreen = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('found'); // 'found' or 'lost'
    const [petType, setPetType] = useState('dog');
    const [image, setImage] = useState(null);
    const [matchResult, setMatchResult] = useState(null);
    const [description, setDescription] = useState("");
    const [breed, setBreed] = useState("");
    const [customBreed, setCustomBreed] = useState("");
    const [color, setColor] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const breedOptions = getBreedsForPetType(petType);
    const colorOptions = getColorsForPetType(petType);
    const petLabel = petType === 'cat' ? t('dog_identity.cat', { defaultValue: 'Cat' }) : t('dog_identity.dog', { defaultValue: 'Dog' });

    const handlePetTypeSelect = (nextType) => {
        if (nextType === petType) return;
        setPetType(nextType);
        setBreed('');
        setCustomBreed('');
        setColor('');
        setMatchResult(null);
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('common.error'), t('lost_found.alerts.camera_perm'));
            return;
        }
        let result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });
        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const identifyPet = async () => {
        if (!image) {
            Alert.alert(t('common.error'), t('lost_found.alerts.photo_first'));
            return;
        }
        try {
            const finalBreed = breed === "Other" ? customBreed : breed;
            const res = await client.post('/dogs/identify', {
                breed: finalBreed,
                color,
                pet_type: petType,
                description,
                nose_print_image: image,
            });
            const matchCount = Array.isArray(res.data) ? res.data.length : Number(res.data?.matches || 0);

            if (matchCount > 0) {
                setMatchResult(t('lost_found.alerts.matches_found', { count: matchCount }));
                Alert.alert(t('lost_found.alerts.success_matches'), t('lost_found.alerts.success_matches_desc'));
            } else {
                setMatchResult(t('lost_found.alerts.matches_none'));
            }
        } catch (e) {
            if (__DEV__) console.log(e);
            Alert.alert(t('common.error'), getActionableErrorMessage(e, t('lost_found.alerts.error_process')));
        }
    };

    const submitLostReport = async () => {
        const finalBreed = breed === "Other" ? customBreed : breed;
        const locationText = description.trim();
        if (!locationText) {
            Alert.alert(t('common.error'), t('lost_found.labels.location_info'));
            return;
        }

        let uploadedImages = [];
        try {
            uploadedImages = image
                ? await uploadImagesToSupabase([image], 'cases', runtimeConfig.storageBuckets.caseEvidence)
                : [];
        } catch (uploadError) {
            Alert.alert(t('common.error'), getUploadErrorMessage(uploadError, 'Photo upload failed. Could not upload the lost pet photo.'));
            return;
        }

        try {
            await client.post('/cases', {
                case_type: 'lost_dog',
                title: `Lost ${finalBreed ? `${finalBreed} ` : ''}${petLabel}`,
                description: locationText,
                location: locationText,
                image_url: uploadedImages[0] || null,
                images: uploadedImages,
                breed: finalBreed,
                color,
                pet_type: petType,
            });
        } catch (error) {
            Alert.alert(t('common.error'), getActionableErrorMessage(error, t('lost_found.alerts.error_process')));
            return;
        }

        setMatchResult(null);
        setDescription("");
        setImage(null);
        Alert.alert(t('lost_found.alerts.success_report'), t('lost_found.alerts.success_report_desc'));
    };

    const submitReport = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            if (activeTab === 'found') {
                await identifyPet();
            } else {
                await submitLostReport();
            }
        } catch (e) {
            if (__DEV__) console.log(e);
            Alert.alert(t('common.error'), getActionableErrorMessage(e, t('lost_found.alerts.error_process')));
        } finally {
            setSubmitting(false);
        }
    };

    const getColorLabel = (c) => {
        if (c.key === "merle") return t('lost_found.colors.merle');
        if (c.key === "brindle") return t('lost_found.colors.brindle');
        if (c.key === "other") return t('common.other');
        return c.value;
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'found' && styles.activeTab]}
                    onPress={() => setActiveTab('found')}
                >
                    <Text style={[styles.tabText, activeTab === 'found' && styles.activeTabText]}>{t('lost_found.i_found')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'lost' && styles.activeTab]}
                    onPress={() => setActiveTab('lost')}
                >
                    <Text style={[styles.tabText, activeTab === 'lost' && styles.activeTabText]}>{t('lost_found.i_lost')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>{t('lost_found.title')}</Text>

                <View style={styles.section}>
                    <Text style={styles.subtitle}>{activeTab === 'found' ? t('lost_found.i_found') : t('lost_found.i_lost')}</Text>
                    <Text style={styles.descText}>{activeTab === 'found' ? t('lost_found.i_found_desc') : t('lost_found.i_lost_desc')}</Text>

                    <Text style={styles.label}>Animal Type</Text>
                    <View style={styles.petTypeRow}>
                        {[
                            { value: 'dog', label: t('dog_identity.dog', { defaultValue: 'Dog' }) },
                            { value: 'cat', label: t('dog_identity.cat', { defaultValue: 'Cat' }) },
                        ].map(item => (
                            <TouchableOpacity
                                key={item.value}
                                style={[styles.petTypeBtn, petType === item.value && styles.petTypeBtnActive]}
                                onPress={() => handlePetTypeSelect(item.value)}
                            >
                                <Text style={[styles.petTypeText, petType === item.value && styles.petTypeTextActive]}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {activeTab === 'found' && (
                        <>
                            <Button title={t('lost_found.scan_button')} onPress={pickImage} color={colors.secondary} />
                            {image && <Image source={{ uri: image }} style={styles.preview} />}
                        </>
                    )}

                    <Text style={styles.label}>{t('lost_found.labels.estimated_breed')}</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={breed} onValueChange={setBreed}>
                            <Picker.Item label={`Select ${petLabel} Breed`} value="" />
                            {breedOptions.map(b => (
                                <Picker.Item key={b} label={b} value={b} />
                            ))}
                        </Picker>
                    </View>

                    {breed === "Other" && (
                        <TextInput
                            style={styles.inputSmall}
                            placeholder={t('lost_found.labels.other_breed')}
                            value={customBreed}
                            onChangeText={setCustomBreed}
                        />
                    )}

                    <Text style={styles.label}>{petLabel} {t('lost_found.labels.color')}</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={color} onValueChange={setColor}>
                            <Picker.Item label={`Select ${petLabel} Color`} value="" />
                            {colorOptions.map(c => (
                                <Picker.Item key={c.value} label={getColorLabel(c)} value={c.value} />
                            ))}
                        </Picker>
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder={t('lost_found.labels.location_info')}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                    />

                    <Button
                        title={submitting ? t('common.loading') : (activeTab === 'found' ? t('lost_found.identify_button') : t('lost_found.submit_lost'))}
                        onPress={submitReport}
                        color={colors.primary}
                        disabled={submitting}
                    />
                    {matchResult && <Text style={styles.result}>{matchResult}</Text>}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: colors.background },
    tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    tab: { flex: 1, padding: 15, alignItems: 'center' },
    activeTab: { borderBottomWidth: 3, borderBottomColor: colors.primary },
    tabText: { fontSize: 14, color: '#666', fontWeight: 'bold' },
    activeTabText: { color: colors.primary },
    title: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: 20 },
    subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: colors.primary },
    descText: { fontSize: 14, color: '#666', marginBottom: 20 },
    section: { marginBottom: 20 },
    preview: { width: 200, height: 200, marginVertical: 10, alignSelf: 'center', borderRadius: 10 },
    result: { fontSize: 16, color: 'green', marginTop: 10, fontWeight: 'bold', textAlign: 'center' },
    input: { borderWidth: 1, borderColor: colors.goldAccent, padding: 10, marginBottom: 15, borderRadius: 5, backgroundColor: '#fff', height: 80, textAlignVertical: 'top' },
    inputSmall: { borderWidth: 1, borderColor: colors.goldAccent, padding: 10, marginBottom: 15, borderRadius: 5, backgroundColor: '#fff', height: 45 },
    label: { fontSize: 14, color: colors.primary, fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
    pickerContainer: { borderWidth: 1, borderColor: colors.goldAccent, borderRadius: 5, marginBottom: 10, backgroundColor: '#fff', minHeight: 50, justifyContent: 'center' },
    petTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    petTypeBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: colors.goldAccent, borderRadius: 8, alignItems: 'center', backgroundColor: '#fff' },
    petTypeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    petTypeText: { color: colors.primary, fontWeight: 'bold' },
    petTypeTextActive: { color: '#fff' },
});

export default LostFoundScreen;
