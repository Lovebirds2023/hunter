import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, Alert, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ThemeBackground } from '../components/ThemeBackground';
import { COLORS, SPACING } from '../constants/theme';
import { Button } from '../components/Button';
import client from '../api/client';
import { BREEDS, COLORS_DESC } from '../constants/data';

// Only import CameraView for native platforms
let CameraView: any = null;
let useCameraPermissions: any = () => [{ granted: false }, async () => {}];
if (Platform.OS !== 'web') {
    // Dynamic require to avoid web bundler crash
    const ExpoCamera = require('expo-camera');
    CameraView = ExpoCamera.CameraView;
    useCameraPermissions = ExpoCamera.useCameraPermissions;
}

export const DogIdentityScreen = ({ navigation }: any) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraRef, setCameraRef] = useState<any | null>(null);

    // Multi-step state
    const [currentStep, setCurrentStep] = useState(0); // 0: Bio, 1: nose, 2: body, 3: mark
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pet type
    const [petType, setPetType] = useState<'dog' | 'cat'>('dog');
    const isDog = petType === 'dog';

    // Pet Bio State
    const [dogName, setDogName] = useState('');
    const [breed, setBreed] = useState('');
    const [customBreed, setCustomBreed] = useState('');
    const [color, setColor] = useState('');
    const [customColor, setCustomColor] = useState('');
    const [age, setAge] = useState('');
    const [weight, setWeight] = useState('');
    const [description, setDescription] = useState('');

    // Image State
    const [capturedImages, setCapturedImages] = useState<string[]>([]);

    const steps = [
        { title: isDog ? 'Canine Bio' : 'Feline Bio', instruction: `Enter your ${isDog ? "dog" : "cat"}'s basic characteristics`, icon: 'list' },
        { title: isDog ? 'Nose Print' : 'Nose Print', instruction: `Align ${isDog ? "nose" : "nose"} print here (Biometric ID)`, icon: 'medical' },
        { title: 'Full Body', instruction: `Capture full body of the ${isDog ? "dog" : "cat"} (Visual ID)`, icon: 'fitness' },
        { title: 'Unique Marks', instruction: 'Capture any birth marks or scars (Special ID)', icon: 'heart' }
    ];

    if (Platform.OS !== 'web') {
        if (!permission) return <View />;
        if (!permission.granted && currentStep > 0) {
            return (
                <ThemeBackground>
                    <SafeAreaView style={styles.container}>
                        <View style={styles.permissionContainer}>
                            <Text style={styles.message}>We need your permission to show the camera</Text>
                            <Button onPress={requestPermission} title="grant permission" />
                        </View>
                    </SafeAreaView>
                </ThemeBackground>
            );
        }
    }

    const nextStep = () => {
        if (currentStep === 0) {
            if (!dogName || !breed || !color) {
                Alert.alert("Missing Info", "Please provide Name, Breed and Color to proceed.");
                return;
            }
            if (breed === 'Other' && !customBreed.trim()) {
                Alert.alert("Missing Info", "Please specify the custom breed.");
                return;
            }
            if (color === 'Other' && !customColor.trim()) {
                Alert.alert("Missing Info", "Please specify the custom color.");
                return;
            }
        }
        setCurrentStep(currentStep + 1);
    };

    const takePicture = async () => {
        if (cameraRef) {
            try {
                const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
                if (photo) {
                    processCapturedImage(photo.uri);
                }
            } catch (error) {
                console.error("Failed to take picture", error);
            }
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled) {
            processCapturedImage(result.assets[0].uri);
        }
    };

    const processCapturedImage = (uri: string) => {
        const newImages = [...capturedImages, uri];
        setCapturedImages(newImages);
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        } else {
            finishIdentity(newImages);
        }
    };

    const finishIdentity = async (images: string[]) => {
        setIsSubmitting(true);
        try {
            const payload = {
                name: dogName,
                breed: breed === 'Other' ? customBreed : breed,
                color: color === 'Other' ? customColor : color,
                age: parseFloat(age) || 0,
                weight: parseFloat(weight) || 0,
                height: 0,
                pet_type: petType,
                body_structure: "Normal",
                bio: description,
                nose_print_image: images[0],
                body_image: images[1],
                birthmark_image: images[2]
            };

            await client.post('/dogs', payload);

            Alert.alert(
                `${isDog ? 'Dog' : 'Cat'} Registered!`, 
                `The ${isDog ? 'canine' : 'feline'} passport has been created successfully. Proximity matching is now active.`,
                [{ text: "Great", onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error("Registration error", error);
            Alert.alert("Error", "Failed to register dog. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderBioForm = () => (
        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.formSectionTitle}>What are you registering?</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <TouchableOpacity
                    style={[styles.petTypeBtn, isDog && styles.petTypeBtnActive]}
                    onPress={() => setPetType('dog')}
                >
                    <Text style={{ fontSize: 28 }}>🐕</Text>
                    <Text style={[styles.petTypeBtnText, isDog && styles.petTypeBtnTextActive]}>Dog</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.petTypeBtn, !isDog && styles.petTypeBtnActive]}
                    onPress={() => setPetType('cat')}
                >
                    <Text style={{ fontSize: 28 }}>🐱</Text>
                    <Text style={[styles.petTypeBtnText, !isDog && styles.petTypeBtnTextActive]}>Cat</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.formSectionTitle}>Identification Details</Text>
            
            <Text style={styles.label}>{isDog ? "Dog's Name" : "Cat's Name"}</Text>
            <TextInput 
                style={styles.input} 
                value={dogName} 
                onChangeText={setDogName} 
                placeholder={isDog ? "e.g. Buddy" : "e.g. Whiskers"}
                placeholderTextColor="rgba(255,255,255,0.4)"
            />

            <Text style={styles.label}>Breed</Text>
            <View style={styles.pickerWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {BREEDS.map(b => (
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
                    placeholder="Specify breed..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={customBreed}
                    onChangeText={setCustomBreed}
                />
            )}

            <Text style={styles.label}>Primary Color</Text>
            <View style={styles.colorGrid}>
                {COLORS_DESC.map(c => (
                    <TouchableOpacity
                        key={c.value}
                        style={[styles.colorChip, color === c.value && styles.colorChipActive]}
                        onPress={() => setColor(c.value)}
                    >
                        <Text style={[styles.colorChipText, color === c.value && styles.colorChipTextActive]}>
                            {c.value}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {color === 'Other' && (
                <TextInput
                    style={[styles.input, { marginTop: 10 }]}
                    placeholder="Describe color..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={customColor}
                    onChangeText={setCustomColor}
                />
            )}

            <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.label}>Approx. Age (Years)</Text>
                    <TextInput 
                        style={styles.input} 
                        value={age} 
                        onChangeText={setAge} 
                        keyboardType="numeric" 
                        placeholder="e.g. 2" 
                        placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Approx. Weight (KG)</Text>
                    <TextInput 
                        style={styles.input} 
                        value={weight} 
                        onChangeText={setWeight} 
                        keyboardType="numeric" 
                        placeholder="e.g. 25" 
                        placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                </View>
            </View>

            <Text style={styles.label}>Unique Identifiers (Description)</Text>
            <TextInput 
                style={[styles.input, styles.textArea]} 
                value={description} 
                onChangeText={setDescription} 
                placeholder="Describe any unique birthmarks, scars, or characteristics that can help identify your dog if lost (e.g. 'White spot on left paw', 'Torn right ear')..." 
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                numberOfLines={5}
            />

            <Button 
                title="PROCEED TO BIOMETRICS" 
                onPress={nextStep} 
                style={{ marginTop: 20 }}
                variant="gold"
            />
        </ScrollView>
    );

    const renderCameraUI = () => {
        // On web, only show image picker (no camera API)
        if (Platform.OS === 'web') {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={styles.webUploadBox}>
                        <Ionicons name={steps[currentStep].icon as any} size={56} color={COLORS.accent} />
                        <Text style={styles.webUploadTitle}>{steps[currentStep].title}</Text>
                        <Text style={styles.webUploadSubtitle}>{steps[currentStep].instruction}</Text>
                        <Text style={styles.webUploadNote}>Camera capture is available on mobile. On web, please upload from your gallery.</Text>
                    </View>
                    <View style={styles.actions}>
                        <Button
                            title="UPLOAD FROM GALLERY"
                            onPress={pickImage}
                            variant="gold"
                            disabled={isSubmitting}
                        />
                    </View>
                </View>
            );
        }

        // Native camera UI
        return (
            <View style={{ flex: 1 }}>
                <View style={styles.cameraContainer}>
                    <CameraView style={styles.camera} ref={(ref: any) => setCameraRef(ref)}>
                        <View style={styles.scanTarget}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                            <Ionicons name={steps[currentStep].icon as any} size={40} color={COLORS.accent} style={{ opacity: 0.5 }} />
                        </View>
                    </CameraView>
                </View>

                <View style={styles.actions}>
                    <Button
                        title={`CAPTURE ${steps[currentStep].title.toUpperCase()}`}
                        onPress={takePicture}
                        style={styles.mainBtn}
                        variant="gold"
                        loading={isSubmitting}
                    />
                    <Button
                        title="UPLOAD FROM GALLERY"
                        onPress={pickImage}
                        variant="outline"
                        disabled={isSubmitting}
                    />
                </View>
            </View>
        );
    };

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    style={{ flex: 1 }}
                >
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.accent} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Pet Identity</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text style={styles.stepTitle}>STEP {currentStep + 1}: {steps[currentStep].title}</Text>
                            <Text style={styles.subtitle}>{steps[currentStep].instruction}</Text>
                        </View>

                        {currentStep === 0 ? renderBioForm() : renderCameraUI()}

                        <View style={styles.progressContainer}>
                            {steps.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.progressBar,
                                        i <= currentStep && styles.progressBarActive,
                                        ((i === 0 && dogName && breed && color) || (i > 0 && i <= capturedImages.length)) ? styles.progressBarDone : null
                                    ]}
                                />
                            ))}
                        </View>

                        <View style={styles.guaranteed}>
                            <Text style={styles.guaranteedText}>Powered by Lovedogs Biometrics & Similarity Engine</Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, paddingHorizontal: SPACING.lg },
    header: { alignItems: 'center', marginBottom: SPACING.md },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
    stepTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.white, textAlign: 'center' },
    subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 4 },
    progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: SPACING.md },
    progressBar: { height: 6, width: 35, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3 },
    progressBarActive: { backgroundColor: COLORS.accent },
    progressBarDone: { backgroundColor: COLORS.accent },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginTop: SPACING.xs },
    backButton: { padding: 8 },
    cameraContainer: { height: 280, borderRadius: 20, marginVertical: SPACING.lg, overflow: 'hidden', backgroundColor: '#000' },
    camera: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
    message: { textAlign: 'center', marginBottom: SPACING.md, color: COLORS.white, fontSize: 16 },
    scanTarget: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center' },
    corner: { position: 'absolute', width: 40, height: 40, borderColor: COLORS.accent },
    topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
    topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
    bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
    bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
    actions: { width: '100%' },
    mainBtn: { marginBottom: SPACING.md },
    guaranteed: { alignItems: 'center', marginBottom: SPACING.md },
    guaranteedText: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 },
    formScroll: { flex: 1, marginTop: 10 },
    formSectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.accent, marginBottom: 15 },
    label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 8, marginTop: 12 },
    input: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)', color: COLORS.white },
    textArea: { height: 100, textAlignVertical: 'top' },
    row: { flexDirection: 'row' },
    pickerWrapper: { marginBottom: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    chipTextActive: { color: COLORS.primary, fontWeight: 'bold' },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    colorChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 8, marginBottom: 8 },
    colorChipActive: { backgroundColor: 'rgba(255,215,0,0.2)', borderWidth: 1, borderColor: COLORS.accent },
    colorChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
    colorChipTextActive: { color: COLORS.accent, fontWeight: 'bold' },
    webUploadBox: {
        alignItems: 'center',
        padding: 30,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
        marginBottom: 24,
        width: '100%',
    },
    webUploadTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white, marginTop: 16, marginBottom: 8 },
    webUploadSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 12 },
    webUploadNote: { fontSize: 11, color: 'rgba(255,215,0,0.5)', textAlign: 'center', fontStyle: 'italic' },
    // Pet type selector styles
    petTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
    petTypeBtnActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(255,215,0,0.12)' },
    petTypeBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },
    petTypeBtnTextActive: { color: COLORS.accent },
});

