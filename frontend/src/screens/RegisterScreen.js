import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { AuthContext } from '../context/AuthContext';
import { ThemeBackground } from '../components/ThemeBackground';
import * as Location from 'expo-location';
import { Picker } from '@react-native-picker/picker';
import { Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const RegisterScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [bio, setBio] = useState("");
    const [role, setRole] = useState("buyer");
    const [countryCode, setCountryCode] = useState("+254"); // Default to Kenya as start
    const [preferredLanguage, setPreferredLanguage] = useState("en");
    const [location, setLocation] = useState(null);
    const [locationAllowed, setLocationAllowed] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [showPassword, setShowPassword] = useState(false);

    const { i18n } = useTranslation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        setPreferredLanguage(lng);
    };

    const requestLocation = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('common.permission_denied'), t('register.location_denied_error'));
            setLocationAllowed(false);
            return false;
        }
        let loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);
        setLocationAllowed(true);
        return true;
    };

    const { register, isLoading } = useContext(AuthContext);

    return (
        <ThemeBackground>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.container}>
                    {/* Step Indicator */}
                    <View style={styles.stepIndicatorContainer}>
                        {[1, 2, 3].map((step) => (
                            <View
                                key={step}
                                style={[
                                    styles.stepDot,
                                    currentStep >= step && styles.activeStepDot,
                                    currentStep === step && styles.currentStepDot
                                ]}
                            />
                        ))}
                    </View>

                    <Text style={styles.title}>{t('register.title')}</Text>
                    <Text style={styles.subtitle}>
                        {currentStep === 1 && t('register.step1_title')}
                        {currentStep === 2 && t('register.step2_title')}
                        {currentStep === 3 && t('register.step3_title')}
                    </Text>

                    {/* Step 1: Basics */}
                    {currentStep === 1 && (
                        <View>
                            <Text style={styles.label}>{t('register.full_name_label')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={t('register.full_name_placeholder')}
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                value={fullName}
                                onChangeText={setFullName}
                                autoCapitalize="words"
                            />

                            <Text style={styles.label}>{t('register.email_label')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={t('register.email_placeholder')}
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />

                            <Text style={styles.label}>{t('register.password_label')}</Text>
                            <View style={styles.passwordInputContainer}>
                                <TextInput
                                    style={[styles.input, { marginBottom: 0, flex: 1 }]}
                                    placeholder={t('register.password_placeholder')}
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIcon}
                                >
                                    <Ionicons
                                        name={showPassword ? "eye-off" : "eye"}
                                        size={24}
                                        color={COLORS.accent}
                                    />
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginTop: 25 }}>
                                <Button title={t('register.next_step')} onPress={() => {
                                    if (!fullName || !email || !password) {
                                        Alert.alert("Wait", "Please complete all fields on this step.");
                                        return;
                                    }
                                    setCurrentStep(2);
                                }} variant="gold" />
                            </View>
                        </View>
                    )}

                    {/* Step 2: Global Profile */}
                    {currentStep === 2 && (
                        <View>
                            <Text style={styles.label}>{t('register.phone_label')}</Text>
                            <View style={styles.phoneInputContainer}>
                                <View style={styles.countryCodePicker}>
                                    <Picker
                                        selectedValue={countryCode}
                                        onValueChange={(itemValue) => setCountryCode(itemValue)}
                                        style={styles.picker}
                                        dropdownIconColor={COLORS.accent}
                                        itemStyle={{ color: COLORS.white }}
                                    >
                                        <Picker.Item label="🇰🇪 +254 (Kenya)" value="+254" />
                                        <Picker.Item label="🇺🇬 +256 (Uganda)" value="+256" />
                                        <Picker.Item label="🇹🇿 +255 (Tanzania)" value="+255" />
                                        <Picker.Item label="🇷🇼 +250 (Rwanda)" value="+250" />
                                        <Picker.Item label="🇬🇧 +44 (UK)" value="+44" />
                                        <Picker.Item label="🇺🇸 +1 (USA)" value="+1" />
                                        <Picker.Item label="🇮🇳 +91 (India)" value="+91" />
                                        <Picker.Item label="🇪🇸 +34 (Spain)" value="+34" />
                                        <Picker.Item label="🇫🇷 +33 (France)" value="+33" />
                                        <Picker.Item label="🇩🇪 +49 (Germany)" value="+49" />
                                        <Picker.Item label="🇧🇷 +55 (Brazil)" value="+55" />
                                        <Picker.Item label="🇦🇪 +971 (UAE)" value="+971" />
                                        <Picker.Item label="🇨🇳 +86 (China)" value="+86" />
                                        <Picker.Item label="🇯🇵 +81 (Japan)" value="+81" />
                                    </Picker>
                                </View>
                                <TextInput
                                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                    placeholder={t('register.phone_placeholder')}
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    keyboardType="phone-pad"
                                />
                            </View>
                            <Text style={styles.inputHint}>{t('register.phone_description')}</Text>

                            <Text style={styles.label}>{t('register.language_label')}</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={preferredLanguage}
                                    onValueChange={(itemValue) => changeLanguage(itemValue)}
                                    style={styles.picker}
                                    dropdownIconColor={COLORS.accent}
                                    itemStyle={{ color: COLORS.white }}
                                >
                                    <Picker.Item label="English (Primary)" value="en" />
                                    <Picker.Item label="Kiswahili" value="sw" />
                                    <Picker.Item label="Español (Spanish)" value="es" />
                                    <Picker.Item label="Français (French)" value="fr" />
                                    <Picker.Item label="Deutsch (German)" value="de" />
                                    <Picker.Item label="Português (Portuguese)" value="pt" />
                                    <Picker.Item label="العربية (Arabic)" value="ar" />
                                    <Picker.Item label="中文 (Chinese)" value="zh" />
                                    <Picker.Item label="हिन्दी (Hindi)" value="hi" />
                                    <Picker.Item label="日本語 (Japanese)" value="ja" />
                                </Picker>
                            </View>

                            <Text style={styles.label}>{t('register.bio_label')}</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder={t('register.bio_placeholder')}
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                value={bio}
                                onChangeText={setBio}
                                multiline
                                numberOfLines={3}
                            />

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                                <TouchableOpacity onPress={() => setCurrentStep(1)} style={styles.secondaryBtn}>
                                    <Text style={styles.secondaryBtnText}>{t('common.back')}</Text>
                                </TouchableOpacity>
                                <View style={{ flex: 1 }}>
                                    <Button title={t('common.continue')} onPress={() => {
                                        if (!phoneNumber) {
                                            Alert.alert("Wait", "Please provide a valid phone number.");
                                            return;
                                        }
                                        setCurrentStep(3);
                                    }} variant="gold" />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Step 3: Access & Role */}
                    {currentStep === 3 && (
                        <View>
                            <View style={styles.roleContainer}>
                                <Text style={styles.roleLabel}>{t('register.join_as')}</Text>
                                <View style={styles.roleOptions}>
                                    <TouchableOpacity onPress={() => setRole('buyer')} style={[styles.roleBtn, role === 'buyer' && styles.activeRole]}>
                                        <Ionicons name="paw" size={24} color={role === 'buyer' ? COLORS.accent : 'rgba(255,255,255,0.5)'} />
                                        <Text style={[styles.roleText, role === 'buyer' && styles.activeRoleText]}>{t('register.pet_owner')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setRole('provider')} style={[styles.roleBtn, role === 'provider' && styles.activeRole]}>
                                        <Ionicons name="briefcase" size={24} color={role === 'provider' ? COLORS.accent : 'rgba(255,255,255,0.5)'} />
                                        <Text style={[styles.roleText, role === 'provider' && styles.activeRoleText]}>{t('register.professional')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <Text style={styles.note}>
                                {t('register.pro_note')}
                                {role === 'provider' && `\n${t('register.list_note')}`}
                            </Text>

                            <View style={locationAllowed ? styles.locationCardSuccess : styles.locationCard}>
                                <View style={styles.locationHeader}>
                                    <Ionicons
                                        name={locationAllowed ? "shield-checkmark" : "map"}
                                        size={28}
                                        color={locationAllowed ? '#4CAF50' : COLORS.accent}
                                    />
                                    <Text style={styles.locationTitle}>
                                        {locationAllowed ? t('common.success') : t('register.secure_access')}
                                    </Text>
                                </View>
                                <Text style={styles.locationBenefitText}>
                                    {locationAllowed
                                        ? t('register.location_success')
                                        : t('register.location_benefit')}
                                </Text>
                                {!locationAllowed && (
                                    <TouchableOpacity onPress={requestLocation} style={styles.premiumAllowBtn}>
                                        <LinearGradient
                                            colors={[COLORS.accent, COLORS.accentDark]}
                                            style={styles.premiumAllowGradient}
                                        >
                                            <Text style={styles.premiumAllowText}>{t('register.allow_location')}</Text>
                                            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <TouchableOpacity onPress={() => setCurrentStep(2)} style={styles.secondaryBtn}>
                                    <Text style={styles.secondaryBtnText}>{t('common.back')}</Text>
                                </TouchableOpacity>
                                <View style={{ flex: 1 }}>
                                    <Button title={t('register.register')} onPress={async () => {
                                        if (!locationAllowed) {
                                            Alert.alert("Required", t('register.location_denied_error'));
                                            return;
                                        }
                                        const success = await register(
                                            fullName,
                                            email,
                                            password,
                                            role,
                                            phoneNumber,
                                            bio,
                                            countryCode,
                                            preferredLanguage,
                                            location?.latitude,
                                            location?.longitude
                                        );
                                        if (success) {
                                            navigation.navigate('Login');
                                        }
                                    }} variant="gold" loading={isLoading} />
                                </View>
                            </View>
                        </View>
                    )}

                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.link}>{t('register.already_account')}<Text style={styles.linkBold}>{t('register.login')}</Text></Text>
                    </TouchableOpacity>


                </ScrollView>
            </KeyboardAvoidingView>
        </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.lg,
        paddingTop: 60,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 4,
        textAlign: 'center',
        color: COLORS.white,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.accent,
        textAlign: 'center',
        marginBottom: SPACING.xl,
        letterSpacing: 0.5,
    },
    label: {
        alignSelf: 'flex-start',
        marginLeft: 5,
        marginBottom: 5,
        fontWeight: 'bold',
        color: COLORS.white,
        fontSize: 14,
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
        borderRadius: SIZES.radius,
        padding: 14,
        marginBottom: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.12)',
        color: COLORS.white,
        fontSize: 16,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    phoneInputContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 5,
    },
    countryCodePicker: {
        width: 130,
        height: 50,
        borderRadius: SIZES.radius,
        justifyContent: 'center',
    },
    pickerContainer: {
        width: '100%',
        height: 50,
        borderRadius: SIZES.radius,
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    picker: {
        color: COLORS.white,
        backgroundColor: COLORS.primaryDark,
        height: 50,
        borderRadius: SIZES.radius,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    inputHint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
        marginTop: -10,
        marginBottom: SPACING.md,
        marginLeft: 5,
        fontStyle: 'italic',
        fontWeight: '500',
    },
    locationCard: {
        backgroundColor: 'rgba(255,215,0,0.05)',
        padding: 20,
        borderRadius: 15,
        marginBottom: 25,
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.3)',
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    locationCardSuccess: {
        backgroundColor: 'rgba(76, 175, 80, 0.05)',
        padding: 20,
        borderRadius: 15,
        marginBottom: 25,
        borderWidth: 1.5,
        borderColor: 'rgba(76, 175, 80, 0.4)',
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12,
    },
    locationTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.accent,
    },
    locationBenefitText: {
        color: 'rgba(255,255,255,0.95)',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 15,
    },
    premiumAllowBtn: {
        borderRadius: 25,
        overflow: 'hidden',
        height: 46,
    },
    premiumAllowGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 20,
    },
    premiumAllowText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 1,
    },
    link: {
        marginTop: 20,
        color: 'rgba(255,255,255,0.95)',
        textAlign: 'center',
        fontSize: 15,
    },
    linkBold: {
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    roleContainer: {
        marginBottom: 15,
        width: '100%',
    },
    roleLabel: {
        fontSize: 16,
        marginBottom: 10,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    roleOptions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    roleBtn: {
        flex: 1,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 10,
        alignItems: 'center',
        marginHorizontal: 5,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    activeRole: {
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(255,215,0,0.1)',
        borderWidth: 2,
    },
    roleText: {
        marginTop: 5,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
    },
    activeRoleText: {
        color: COLORS.accent,
    },
    note: {
        marginBottom: 20,
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        fontStyle: 'italic',
        textAlign: 'center',
        fontWeight: '500',
    },
    skipBtn: {
        marginTop: 15,
        padding: 12,
        alignItems: 'center',
    },
    skipText: {
        color: COLORS.accent,
        fontSize: 16,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    stepIndicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20,
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    activeStepDot: {
        backgroundColor: COLORS.accent,
    },
    currentStepDot: {
        width: 28,
        backgroundColor: COLORS.accent,
    },
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
        borderRadius: SIZES.radius,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginBottom: SPACING.md,
    },
    eyeIcon: {
        paddingHorizontal: 15,
    },
    secondaryBtn: {
        flex: 0.4,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        borderRadius: SIZES.radius,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryBtnText: {
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 'bold',
        fontSize: 15,
    },
});

export default RegisterScreen;
