import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, Image, Modal, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { COLORS, SPACING } from '../constants/theme';

// Common data lists
const BREEDS = ["German Shepherd", "Bulldog", "Labrador", "Golden Retriever", "Poodle", "Beagle", "Rottweiler", "Other"];
const COLORS_LIST = ["Black", "White", "Brown", "Tan", "Spotted", "Merle", "Brindle", "Other"];
const SIZES = ["Small", "Medium", "Large", "Giant"];
const GENDERS = ["Male", "Female"];

const DogRegistrationScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [dogs, setDogs] = useState([]);
    const [name, setName] = useState('');
    const [breed, setBreed] = useState(BREEDS[0]);
    const [color, setColor] = useState(COLORS_LIST[0]);
    const [size, setSize] = useState(SIZES[0]);
    const [gender, setGender] = useState(GENDERS[0]);
    const [age, setAge] = useState('');
    const [weight, setWeight] = useState('');

    // Camera & Image State
    const [noseImage, setNoseImage] = useState(null);
    const [bodyImage, setBodyImage] = useState(null);
    const [birthMarkImage, setBirthMarkImage] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraType, setCameraType] = useState('nose'); // 'nose', 'body', 'birthmark'

    const [permission, requestPermission] = useCameraPermissions();
    const [cameraRef, setCameraRef] = useState(null);

    const pickImage = async (type) => {
        // Enforce sequence logic if needed, but gallery is usually flexible
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled) {
            if (type === 'nose') setNoseImage(result.assets[0].uri);
            else if (type === 'body') setBodyImage(result.assets[0].uri);
            else if (type === 'birthmark') setBirthMarkImage(result.assets[0].uri);
        }
    };

    const handleCameraLaunch = (type) => {
        setCameraType(type);
        if (!permission || !permission.granted) {
            requestPermission();
        } else {
            setShowCamera(true);
        }
    };

    const takePicture = async () => {
        if (cameraRef) {
            const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
            if (cameraType === 'nose') {
                setNoseImage(photo.uri);
                // Auto-advance to next if desired, but let's keep it manual per buttons
            } else if (cameraType === 'body') {
                setBodyImage(photo.uri);
            } else {
                setBirthMarkImage(photo.uri);
            }
            setShowCamera(false);
        }
    };

    const registerDog = async () => {
        if (!noseImage || !bodyImage || !birthMarkImage) {
            Alert.alert(t('common.error'), t('dog_registration.alerts.missing_photos'));
            return;
        }

        try {
            // 1. Create Dog
            const res = await client.post('/dogs/', {
                name, breed, color,
                height: 0, weight: parseFloat(weight) || 0, body_structure: size, // using age and weight
                nose_print_image: noseImage,
                body_image: bodyImage,
                birthmark_image: birthMarkImage
            });

            Alert.alert(t('common.success'), t('dog_registration.alerts.success', { name }));

            fetchDogs();
            setName(''); setAge(''); setNoseImage(null); setBodyImage(null); setBirthMarkImage(null);
            setBreed(BREEDS[0]); setColor(COLORS_LIST[0]); setSize(SIZES[0]); setGender(GENDERS[0]);

        } catch (e) {
            if (__DEV__) console.log(e);
            Alert.alert(t('common.error'), t('dog_registration.alerts.error'));
        }
    };

    if (showCamera) {
        let overlayText = t('dog_registration.camera.align_nose');
        if (cameraType === 'body') overlayText = t('dog_registration.camera.capture_body');
        if (cameraType === 'birthmark') overlayText = t('dog_registration.camera.capture_marks');

        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
                <View style={styles.cameraContainer}>
                    <CameraView style={{ flex: 1 }} ref={ref => setCameraRef(ref)}>
                        <View style={styles.cameraOverlay}>
                            <Text style={styles.cameraText}>{overlayText}</Text>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowCamera(false)}>
                                <Ionicons name="close-circle" size={40} color="white" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.captureContainer}>
                            <TouchableOpacity style={styles.captureBtn} onPress={takePicture} />
                        </View>
                    </CameraView>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('dog_registration.title')}</Text>
                <View style={{ width: 32 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    <Text style={styles.sectionHeader}>{t('dog_registration.section_info')}</Text>
                    <TextInput style={styles.input} placeholder={t('dog_registration.labels.name')} value={name} onChangeText={setName} />
                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 5 }}>
                            <TextInput style={styles.input} placeholder={t('dog_registration.labels.age')} value={age} onChangeText={setAge} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 5 }}>
                            <TextInput style={styles.input} placeholder={t('dog_registration.labels.weight') || "Weight (kg)"} value={weight} onChangeText={setWeight} keyboardType="numeric" />
                        </View>
                    </View>

                    {/* ... (Breed/Color Pickers) ... */}
                    <Text style={styles.label}>{t('dog_registration.labels.breed')}</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={breed} onValueChange={setBreed}>
                            {BREEDS.map(b => <Picker.Item key={b} label={b} value={b} />)}
                        </Picker>
                    </View>

                    <Text style={styles.label}>{t('dog_registration.labels.color')}</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={color} onValueChange={setColor}>
                            {COLORS_LIST.map(c => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 5 }}>
                            <Text style={styles.label}>{t('dog_registration.labels.size')}</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={size} onValueChange={setSize}>
                                    {SIZES.map(s_val => <Picker.Item key={s_val} label={t(`dog_registration.sizes.${s_val.toLowerCase()}`)} value={s_val} />)}
                                </Picker>
                            </View>
                        </View>
                        <View style={{ flex: 1, marginLeft: 5 }}>
                            <Text style={styles.label}>{t('dog_registration.labels.gender')}</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={gender} onValueChange={setGender}>
                                    {GENDERS.map(g_val => <Picker.Item key={g_val} label={t(`dog_registration.genders.${g_val.toLowerCase()}`)} value={g_val} />)}
                                </Picker>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.sectionHeader}>{t('dog_registration.section_id')}</Text>

                    <View style={styles.imageSection}>
                        <Text style={styles.label}>{t('dog_registration.labels.nose_print')}</Text>
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => handleCameraLaunch('nose')}>
                                <Ionicons name="camera" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage('nose')}>
                                <Ionicons name="image" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                        {noseImage && <Image source={{ uri: noseImage }} style={styles.previewImage} />}
                    </View>

                    <View style={styles.imageSection}>
                        <Text style={styles.label}>{t('dog_registration.labels.body_photo')}</Text>
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => handleCameraLaunch('body')}>
                                <Ionicons name="camera" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage('body')}>
                                <Ionicons name="image" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                        {bodyImage && <Image source={{ uri: bodyImage }} style={styles.previewImage} />}
                    </View>

                    <View style={styles.imageSection}>
                        <Text style={styles.label}>{t('dog_registration.labels.birth_marks')}</Text>
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => handleCameraLaunch('birthmark')}>
                                <Ionicons name="camera" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage('birthmark')}>
                                <Ionicons name="image" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                        {birthMarkImage && <Image source={{ uri: birthMarkImage }} style={styles.previewImage} />}
                    </View>

                    <Button title={t('dog_registration.title')} onPress={registerDog} color={COLORS.primary} />

                    <Text style={[styles.header, { marginTop: 30 }]}>{t('dog_registration.my_dogs')}</Text>
                    {dogs.map(dog => (
                        <View key={dog.id} style={styles.dogItem}>
                            <Text style={styles.dogName}>{dog.name} ({dog.breed})</Text>
                            <Text>Color: {dog.color}, Size: {dog.size}</Text>
                        </View>
                    ))}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { padding: 20, paddingBottom: 50 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#f5f5f5' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 15, color: '#444' },
    header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    dogItem: { padding: 15, backgroundColor: '#fff', marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    dogName: { fontWeight: 'bold', fontSize: 16 },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 12, marginBottom: 15, borderRadius: 8, backgroundColor: '#fff' },
    label: { marginBottom: 5, fontWeight: '600', color: '#666' },
    pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 15, backgroundColor: '#fff', height: 50, justifyContent: 'center' },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    imageSection: { marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#eee', padding: 10, borderRadius: 8, borderStyle: 'dashed' },
    previewImage: { width: 150, height: 150, marginTop: 10, borderRadius: 10 },
    btnRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 10 },
    iconBtn: { padding: 10, backgroundColor: '#fff', borderRadius: 50, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    cameraContainer: { flex: 1 },
    cameraOverlay: { position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
    cameraText: { color: 'white', fontSize: 20, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 5 },
    closeBtn: { position: 'absolute', top: 0, right: 20 },
    captureContainer: { position: 'absolute', bottom: 40, alignSelf: 'center' },
    captureBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', borderWidth: 5, borderColor: '#ccc' }
});

export default DogRegistrationScreen;
