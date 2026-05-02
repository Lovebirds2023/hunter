import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import client from '../api/client';
import { colors } from '../theme/colors';

const LostFoundScreen = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('found'); // 'found' or 'lost'
    const [image, setImage] = useState(null);
    const [matchResult, setMatchResult] = useState(null);
    const [description, setDescription] = useState("");
    const [breed, setBreed] = useState("German Shepherd");
    const [customBreed, setCustomBreed] = useState("");
    const [color, setColor] = useState("Black");

    const BREEDS = ["German Shepherd", "Bulldog", "Labrador", "Golden Retriever", "Poodle", "Beagle", "Rottweiler", "Other"];
    const COLORS_LIST = ["Black", "White", "Brown", "Tan", "Spotted", "Merle", "Brindle", "Other"];

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

    const identifyDog = async () => {
        if (!image) {
            Alert.alert(t('common.error'), t('lost_found.alerts.photo_first'));
            return;
        }
        try {
            const finalBreed = breed === "Other" ? customBreed : breed;
            const res = await client.post('/dogs/report-lost', {
                name: "Unidentified",
                breed: finalBreed,
                color,
                height: 0,
                weight: 0,
                body_structure: "Unknown",
                nose_print_image: image
            });

            if (res.data.matches > 0) {
                setMatchResult(t('lost_found.alerts.matches_found', { count: res.data.matches }));
                Alert.alert(t('lost_found.alerts.success_matches'), t('lost_found.alerts.success_matches_desc'));
            } else {
                setMatchResult(t('lost_found.alerts.matches_none'));
            }
        } catch (e) {
            if (__DEV__) console.log(e);
            Alert.alert(t('common.error'), t('lost_found.alerts.error_process'));
        }
    };

    const submitReport = async () => {
        if (activeTab === 'found') {
            await identifyDog();
        } else {
            // Logic for lost report could be different, but for now we reuse identifying if they have photo
            Alert.alert(t('lost_found.alerts.success_report'), t('lost_found.alerts.success_report_desc'));
        }
    };

    const getColorLabel = (c) => {
        if (c === "Merle") return t('lost_found.colors.merle');
        if (c === "Brindle") return t('lost_found.colors.brindle');
        return c;
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

                    {activeTab === 'found' && (
                        <>
                            <Button title={t('lost_found.scan_button')} onPress={pickImage} color={colors.secondary} />
                            {image && <Image source={{ uri: image }} style={styles.preview} />}
                        </>
                    )}

                    <Text style={styles.label}>{t('lost_found.labels.estimated_breed')}</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={breed} onValueChange={setBreed}>
                            {BREEDS.map(b => (
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

                    <Text style={styles.label}>{t('lost_found.labels.color')}</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={color} onValueChange={setColor}>
                            {COLORS_LIST.map(c => (
                                <Picker.Item key={c} label={getColorLabel(c)} value={c} />
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
                        title={activeTab === 'found' ? t('lost_found.identify_button') : t('lost_found.submit_lost')}
                        onPress={submitReport}
                        color={colors.primary}
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
    pickerContainer: { borderWidth: 1, borderColor: colors.goldAccent, borderRadius: 5, marginBottom: 10, backgroundColor: '#fff', height: 50, justifyContent: 'center' },
});

export default LostFoundScreen;
