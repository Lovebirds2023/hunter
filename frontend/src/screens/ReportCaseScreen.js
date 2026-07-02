import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    View, Text, StyleSheet, TextInput, ScrollView,
    TouchableOpacity, Image, Alert, SafeAreaView,
    KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { ThemeBackground } from '../components/ThemeBackground';
import { Button } from '../components/Button';
import client from '../api/client';
import { getBreedsForPetType, getColorsForPetType } from '../constants/data';
import { uploadImagesToSupabase } from '../utils/uploadImages';
import { runtimeConfig } from '../config/runtimeConfig';
import {
    ImageFrameGuide,
    getImageFrameAspectRatio,
    getImagePickerAspect,
} from '../components/ImageFrameGuide';
import {
    formatCoordinatePair,
    formatLocationAccuracy,
    getReliableCurrentLocation,
    hasValidCoordinatePair,
    reverseGeocodeToAddress,
} from '../utils/locationAccuracy';

const CASE_TYPES = [
    { value: 'lost_dog', icon: 'search', color: '#4488FF' },
    { value: 'found_dog', icon: 'eye', color: '#00C851' },
    { value: 'rabies_bite', icon: 'warning', color: '#FF4444' },
    { value: 'vehicle_hit', icon: 'car', color: '#FF8800' },
    { value: 'injured_stray', icon: 'medkit', color: '#FF6600' },
    { value: 'abuse', icon: 'alert-circle', color: '#CC0000' },
    { value: 'other', icon: 'ellipsis-horizontal', color: '#888888' },
];

const MAX_IMAGES = 5;
const PET_TYPES = [
    { value: 'dog', label: 'Dog', icon: 'paw' },
    { value: 'cat', label: 'Cat', icon: 'sparkles' },
];
const PET_SIZES = ['Small', 'Medium', 'Large', 'Giant'];
const SEX_OPTIONS = ['Unknown', 'Male', 'Female'];

const ReportCaseScreen = ({ navigation, route }) => {
    const { t } = useTranslation();
    const initialType = route.params?.preSelectType || '';
    const [caseType, setCaseType] = useState(initialType);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [locationAccuracy, setLocationAccuracy] = useState(null);
    const [breed, setBreed] = useState('');
    const [customBreed, setCustomBreed] = useState('');
    const [color, setColor] = useState('');
    const [customColor, setCustomColor] = useState('');
    const [petType, setPetType] = useState('dog');
    const [sex, setSex] = useState('Unknown');
    const [petSize, setPetSize] = useState('');
    const [microchipId, setMicrochipId] = useState('');
    const [collarDescription, setCollarDescription] = useState('');
    const [uniqueMarkings, setUniqueMarkings] = useState('');
    const [images, setImages] = useState([]);
    const [imageFrameRatio, setImageFrameRatio] = useState('4:3');
    const [submitting, setSubmitting] = useState(false);
    const [fetchingLocation, setFetchingLocation] = useState(false);
    const isLostFoundCase = caseType === 'lost_dog' || caseType === 'found_dog';
    const breedOptions = getBreedsForPetType(petType);
    const colorOptions = getColorsForPetType(petType);
    const petLabelTitle = petType === 'cat' ? 'Cat' : 'Dog';

    const handlePetTypeSelect = (nextType) => {
        if (nextType === petType) return;
        setPetType(nextType);
        setBreed('');
        setCustomBreed('');
        setColor('');
        setCustomColor('');
    };

    const getCurrentLocation = async () => {
        setFetchingLocation(true);
        try {
            const result = await getReliableCurrentLocation();
            setLatitude(result.coords.latitude);
            setLongitude(result.coords.longitude);
            setLocationAccuracy(result.accuracyMeters);

            const address = await reverseGeocodeToAddress(result.coords).catch(() => '');
            if (address) {
                setLocation(address);
            }

            if (result.isLowAccuracy) {
                Alert.alert(
                    'Location captured',
                    `${formatLocationAccuracy(result.accuracyMeters)}. Move outdoors or enable precise location, then tap the locate button again if you need a more exact point.`
                );
            }
        } catch (error) {
            console.error(error);
            if (error.code === 'permission_denied') {
                Alert.alert(t('common.permission_denied'), t('common.location_req'));
            } else if (error.code === 'services_disabled') {
                Alert.alert(t('common.error'), 'Please turn on GPS/location services and try again.');
            } else {
                Alert.alert(t('common.error'), t('common.location_fail'));
            }
        } finally {
            setFetchingLocation(false);
        }
    };

    const handleLocationTextChange = (value) => {
        setLocation(value);
        if (latitude !== null || longitude !== null) {
            setLatitude(null);
            setLongitude(null);
            setLocationAccuracy(null);
        }
    };

    const pickImageFromGallery = async () => {
        if (images.length >= MAX_IMAGES) {
            Alert.alert(t('report.form.alerts.limit_reached'), t('report.form.alerts.photo_limit', { count: MAX_IMAGES }));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: getImagePickerAspect(imageFrameRatio, '4:3'),
            quality: 0.8,
        });
        if (!result.canceled) {
            setImages(prev => [...prev, result.assets[0].uri]);
        }
    };

    const takePhoto = async () => {
        if (images.length >= MAX_IMAGES) {
            Alert.alert(t('report.form.alerts.limit_reached'), t('report.form.alerts.photo_limit', { count: MAX_IMAGES }));
            return;
        }

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('common.camera_perm'), t('common.camera_req'));
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: getImagePickerAspect(imageFrameRatio, '4:3'),
            quality: 0.8,
        });
        if (!result.canceled) {
            setImages(prev => [...prev, result.assets[0].uri]);
        }
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!caseType) {
            Alert.alert(t('common.error'), t('report.form.alerts.type_required'));
            return;
        }
        if (!title.trim()) {
            Alert.alert(t('common.error'), t('report.form.alerts.title_required'));
            return;
        }

        setSubmitting(true);
        try {
            const uploadedImages = images.length > 0
                ? await uploadImagesToSupabase(images, 'cases', runtimeConfig.storageBuckets.caseEvidence)
                : [];

            const res = await client.post('/cases', {
                case_type: caseType,
                title: title.trim(),
                description: description.trim(),
                image_url: uploadedImages.length > 0 ? uploadedImages[0] : null,
                images: uploadedImages,
                breed: breed === 'Other' ? customBreed : breed,
                color: color === 'Other' ? customColor : color,
                pet_type: isLostFoundCase ? petType : null,
                sex: isLostFoundCase && sex !== 'Unknown' ? sex : null,
                size: isLostFoundCase ? petSize : null,
                microchip_id: isLostFoundCase ? microchipId.trim() : null,
                collar_description: isLostFoundCase ? collarDescription.trim() : null,
                unique_markings: isLostFoundCase ? uniqueMarkings.trim() : null,
                location: location.trim(),
                latitude: latitude,
                longitude: longitude,
                location_accuracy_meters: locationAccuracy,
            });
            const matchCount = res.data?.match_count || 0;
            const topConfidence = res.data?.top_match_confidence;
            const successMessage = matchCount > 0
                ? `${t('report.form.alerts.success')} We found ${matchCount} possible match${matchCount === 1 ? '' : 'es'}${topConfidence ? `, up to ${Math.round(topConfidence)}% confidence` : ''}.`
                : t('report.form.alerts.success');

            Alert.alert(t('report.form.title'), successMessage, [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (e) {
            if (__DEV__) console.log('Submit case error', e);
            Alert.alert(t('common.error'), t('report.form.alerts.error'));
        } finally {
            setSubmitting(false);
        }
    };

    const previewAspectRatio = getImageFrameAspectRatio(imageFrameRatio, '4:3');

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{t('report.form.title')}</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <Text style={styles.sectionTitle}>{t('report.form.question')}</Text>
                        <View style={styles.caseTypeGrid}>
                            {CASE_TYPES.map((ct) => (
                                <TouchableOpacity
                                    key={ct.value}
                                    style={[
                                        styles.caseTypeBtn,
                                        (ct.value === 'lost_dog' || ct.value === 'found_dog') && { width: '48%', height: 80, justifyContent: 'center' },
                                        caseType === ct.value && { borderColor: ct.color, backgroundColor: `${ct.color}20` }
                                    ]}
                                    onPress={() => setCaseType(ct.value)}
                                >
                                    <View style={{ alignItems: 'center', width: '100%' }}>
                                        <Ionicons
                                            name={ct.icon}
                                            size={ct.value === 'lost_dog' || ct.value === 'found_dog' ? 28 : 22}
                                            color={caseType === ct.value ? ct.color : 'rgba(255,255,255,0.5)'}
                                        />
                                        <Text style={[
                                            styles.caseTypeBtnText,
                                            ct.value === 'lost_dog' || ct.value === 'found_dog' && { fontSize: 13, marginTop: 4 },
                                            caseType === ct.value && { color: ct.color }
                                        ]}>
                                            {t(`report.types.${ct.value}`)}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {isLostFoundCase && (
                            <View style={styles.lostFoundFields}>
                                <Text style={styles.matchHint}>
                                    Add clear details and photos. Lovedogs 360 will compare this report with opposite lost/found reports and registered pet profiles.
                                </Text>

                                <Text style={styles.fieldSectionTitle}>Animal type</Text>
                                <View style={styles.segmentRow}>
                                    {PET_TYPES.map(item => (
                                        <TouchableOpacity
                                            key={item.value}
                                            style={[styles.segmentBtn, petType === item.value && styles.segmentBtnActive]}
                                            onPress={() => handlePetTypeSelect(item.value)}
                                        >
                                            <Ionicons name={item.icon} size={16} color={petType === item.value ? COLORS.primary : COLORS.accent} />
                                            <Text style={[styles.segmentText, petType === item.value && styles.segmentTextActive]}>{item.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.label}>{t('report.labels.breed')}</Text>
                                <View style={styles.pickerWrapper}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {breedOptions.map(b => (
                                            <TouchableOpacity
                                                key={b}
                                                style={[styles.chip, breed === b && styles.chipActive]}
                                                onPress={() => setBreed(b)}
                                            >
                                                <Text style={[styles.chipText, breed === b && styles.chipTextActive]}>{b}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {breed === 'Other' && (
                                    <TextInput
                                        style={styles.input}
                                        placeholder={t('report.labels.custom_breed')}
                                        placeholderTextColor="rgba(255,255,255,0.4)"
                                        value={customBreed}
                                        onChangeText={setCustomBreed}
                                    />
                                )}

                                <Text style={styles.label}>
                                    {t('report.labels.pet_color', { pet: petLabelTitle, defaultValue: `${petLabelTitle} Color` })}
                                </Text>
                                <View style={styles.colorGrid}>
                                    {colorOptions.map(c => (
                                        <TouchableOpacity
                                            key={c.value}
                                            style={[styles.colorChip, color === c.value && styles.colorChipActive]}
                                            onPress={() => setColor(c.value)}
                                        >
                                            <Text style={[styles.colorChipText, color === c.value && styles.colorChipTextActive]}>
                                                {c.key === 'other' ? t('common.other') : c.value}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {color === 'Other' && (
                                    <TextInput
                                        style={[styles.input, { marginTop: 10 }]}
                                        placeholder={petType === 'cat' ? 'Describe the cat color...' : t('report.labels.describe_color')}
                                        placeholderTextColor="rgba(255,255,255,0.4)"
                                        value={customColor}
                                        onChangeText={setCustomColor}
                                    />
                                )}

                                <Text style={styles.label}>Size</Text>
                                <View style={styles.colorGrid}>
                                    {PET_SIZES.map(size => (
                                        <TouchableOpacity
                                            key={size}
                                            style={[styles.colorChip, petSize === size && styles.colorChipActive]}
                                            onPress={() => setPetSize(size)}
                                        >
                                            <Text style={[styles.colorChipText, petSize === size && styles.colorChipTextActive]}>{size}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.label}>Sex</Text>
                                <View style={styles.colorGrid}>
                                    {SEX_OPTIONS.map(option => (
                                        <TouchableOpacity
                                            key={option}
                                            style={[styles.colorChip, sex === option && styles.colorChipActive]}
                                            onPress={() => setSex(option)}
                                        >
                                            <Text style={[styles.colorChipText, sex === option && styles.colorChipTextActive]}>{option}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.label}>Microchip or tag number, if visible</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Optional ID, tag, or microchip number"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={microchipId}
                                    onChangeText={setMicrochipId}
                                    autoCapitalize="characters"
                                />

                                <Text style={styles.label}>Collar or tag description</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Example: red collar, blue tag, bell"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={collarDescription}
                                    onChangeText={setCollarDescription}
                                />

                                <Text style={styles.label}>Unique markings</Text>
                                <TextInput
                                    style={[styles.input, styles.smallTextArea]}
                                    placeholder="Example: white left paw, scar near ear, black tail tip"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={uniqueMarkings}
                                    onChangeText={setUniqueMarkings}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>
                        )}

                        <Text style={styles.label}>{t('report.form.labels.title')}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={t('report.form.placeholders.title')}
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={title}
                            onChangeText={setTitle}
                        />

                        <Text style={styles.label}>{t('report.form.labels.description')}</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder={t('report.form.placeholders.description')}
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={4}
                        />

                        <Text style={styles.label}>{t('report.form.labels.location')}</Text>
                        <View style={styles.locationInputRow}>
                            <Ionicons name="location" size={18} color={COLORS.accent} style={{ marginRight: 8 }} />
                            <TextInput
                                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                placeholder={t('report.form.placeholders.location')}
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                value={location}
                                onChangeText={handleLocationTextChange}
                            />
                            <TouchableOpacity
                                style={[styles.autoLocationBtn, fetchingLocation && { opacity: 0.6 }]}
                                onPress={getCurrentLocation}
                                disabled={fetchingLocation}
                            >
                                <Ionicons name="navigate" size={20} color={COLORS.accent} />
                            </TouchableOpacity>
                        </View>
                        {hasValidCoordinatePair({ latitude, longitude }) && (
                            <Text style={styles.coordinateText}>
                                GPS: {formatCoordinatePair({ latitude, longitude })} | {formatLocationAccuracy(locationAccuracy)}
                            </Text>
                        )}

                        <View style={styles.photoHeaderRow}>
                            <Text style={[styles.label, { marginTop: SPACING.md }]}>{t('report.form.labels.photo')}</Text>
                            <Text style={styles.photoCountText}>({images.length}/{MAX_IMAGES})</Text>
                        </View>
                        {isLostFoundCase && (
                            <Text style={styles.photoGuidance}>
                                {petType === 'cat'
                                    ? 'Best for matching: face, full body side, unique markings, and collar/tag if present.'
                                    : 'Best for matching: face, full body side, unique markings, collar/tag, and nose close-up for dogs.'}
                            </Text>
                        )}
                        <ImageFrameGuide
                            title="Report photo frame"
                            guidance="Choose the frame before taking or selecting a photo. Use the editor to zoom and move the animal so the important details stay inside the frame."
                            ratios={['4:3', '1:1', '3:2', '2:3']}
                            selectedRatio={imageFrameRatio}
                            onSelectRatio={setImageFrameRatio}
                            dark
                        />

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                            <TouchableOpacity 
                                style={[styles.addImageBtn, images.length >= MAX_IMAGES && { opacity: 0.5 }]} 
                                onPress={takePhoto}
                                disabled={images.length >= MAX_IMAGES}
                            >
                                <Ionicons name="camera" size={32} color={COLORS.accent} />
                                <Text style={styles.addImageText}>{t('report.form.buttons.camera')}</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={[styles.addImageBtn, { marginLeft: 10 }, images.length >= MAX_IMAGES && { opacity: 0.5 }]} 
                                onPress={pickImageFromGallery}
                                disabled={images.length >= MAX_IMAGES}
                            >
                                <Ionicons name="images" size={32} color={COLORS.accent} />
                                <Text style={styles.addImageText}>{t('report.form.buttons.gallery')}</Text>
                            </TouchableOpacity>

                            {images.map((img, idx) => (
                                <View key={idx} style={[styles.imagePreviewWrapper, { marginLeft: 10, aspectRatio: previewAspectRatio }]}>
                                    <Image source={{ uri: img }} style={styles.imagePreviewSmall} resizeMode="cover" />
                                    <TouchableOpacity style={styles.removeImageBtnSmall} onPress={() => removeImage(idx)}>
                                        <Ionicons name="close-circle" size={20} color="#FF4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>

                        <Button
                            title={submitting ? 'Saving report...' : t('report.form.buttons.submit')}
                            onPress={handleSubmit}
                            loading={submitting}
                            disabled={submitting}
                            variant="gold"
                            style={{ marginTop: SPACING.lg }}
                        />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
    scrollContent: { padding: SPACING.lg, paddingBottom: 40 },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.accent,
        marginBottom: SPACING.sm,
    },
    caseTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    caseTypeBtn: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginBottom: SPACING.sm,
    },
    caseTypeBtnText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginLeft: 8,
        fontWeight: '600',
        flexShrink: 1,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 6,
        marginTop: SPACING.xs,
    },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
        borderRadius: SIZES.radius,
        padding: 14,
        marginBottom: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: COLORS.white,
        fontSize: 15,
    },
    textArea: { height: 100, textAlignVertical: 'top' },
    smallTextArea: { minHeight: 76, textAlignVertical: 'top' },
    locationInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    autoLocationBtn: {
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    coordinateText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        marginTop: -10,
        marginBottom: 10,
        marginLeft: 26,
    },
    imageScroll: {
        marginBottom: SPACING.md,
        marginTop: 10,
    },
    imagePreviewWrapper: {
        position: 'relative',
        width: 128,
        borderRadius: 12,
        overflow: 'hidden',
    },
    imagePreviewSmall: {
        width: '100%',
        height: '100%',
    },
    removeImageBtnSmall: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 10,
    },
    addImageBtn: {
        width: 100,
        height: 100,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addImageText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        marginTop: 4,
        fontWeight: 'bold'
    },
    lostFoundFields: {
        backgroundColor: 'rgba(255,215,0,0.05)',
        padding: 12,
        borderRadius: 14,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.1)',
    },
    matchHint: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 12,
        lineHeight: 18,
        marginBottom: SPACING.sm,
    },
    fieldSectionTitle: {
        color: COLORS.accent,
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 8,
        marginTop: 4,
    },
    segmentRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: SPACING.sm,
    },
    segmentBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.18)',
    },
    segmentBtnActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    segmentText: {
        color: COLORS.accent,
        fontWeight: '800',
        marginLeft: 6,
        fontSize: 13,
    },
    segmentTextActive: {
        color: COLORS.primary,
    },
    pickerWrapper: {
        marginBottom: 12,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    chipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    chipText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    chipTextActive: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    colorChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginRight: 8,
        marginBottom: 8,
    },
    colorChipActive: {
        backgroundColor: 'rgba(255,215,0,0.2)',
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    colorChipText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
    },
    colorChipTextActive: {
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    photoHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    photoCountText: {
        fontSize: 12,
        color: COLORS.accent,
        fontWeight: 'bold',
        marginTop: SPACING.md
    },
    photoGuidance: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 4,
    }
});

export { ReportCaseScreen };
export default ReportCaseScreen;
