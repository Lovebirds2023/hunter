import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { AuthContext } from '../context/AuthContext';
import { ThemeBackground } from '../components/ThemeBackground';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

const SocialLoginButton = ({ icon, imageUri, label, onPress, disabled, subtle }) => (
    <TouchableOpacity
        style={[styles.socialBtn, subtle && styles.socialBtnSubtle, disabled && styles.socialBtnDisabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.82}
    >
        {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.socialImageIcon} />
        ) : (
            <Ionicons name={icon} size={23} color={disabled ? 'rgba(255,255,255,0.45)' : COLORS.white} />
        )}
        <Text style={[styles.socialBtnText, disabled && styles.socialBtnTextDisabled]}>{label}</Text>
    </TouchableOpacity>
);

const GoogleSignInButton = ({ googleLogin, label, disabledLabel }) => {
    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: googleWebClientId,
        iosClientId: googleIosClientId,
    });

    React.useEffect(() => {
        if (response?.type === 'success') {
            const { authentication } = response;
            if (authentication?.idToken) {
                googleLogin(authentication.idToken);
            }
        }
    }, [response, googleLogin]);

    return (
        <SocialLoginButton
            imageUri="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
            label={request ? label : disabledLabel}
            onPress={() => promptAsync()}
            disabled={!request}
        />
    );
};

const LoginScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { login, googleLogin, isLoading, authNotice, clearAuthNotice } = useContext(AuthContext);
    const canUseGoogleAuth = Platform.OS === 'web'
        ? Boolean(googleWebClientId)
        : Boolean(googleIosClientId || googleWebClientId);

    const handleLogin = async () => {
        clearAuthNotice();
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !password) {
            return;
        }
        await login(cleanEmail, password);
    };

    return (
        <ThemeBackground>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, width: '100%' }}
            >
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    <Image
                        source={require('../../assets/logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />

                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Log in or sign up</Text>
                        <Text style={styles.subtitle}>Access your pet services, health records, events, and Lovedogs360 community.</Text>

                        {authNotice && (
                            <View style={[styles.notice, authNotice.type === 'success' && styles.noticeSuccess]}>
                                <Text style={styles.noticeText}>{authNotice.message}</Text>
                            </View>
                        )}

                        {canUseGoogleAuth ? (
                            <GoogleSignInButton
                                googleLogin={googleLogin}
                                label="Continue with Google"
                                disabledLabel="Google login unavailable"
                            />
                        ) : (
                            <SocialLoginButton
                                imageUri="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
                                label="Google login not configured"
                                disabled
                            />
                        )}

                        <SocialLoginButton icon="logo-apple" label="Continue with Apple" disabled subtle />
                        <SocialLoginButton icon="call-outline" label="Continue with phone" disabled subtle />

                        <View style={styles.divider}>
                            <View style={styles.line} />
                            <Text style={styles.dividerText}>{t('login.or')}</Text>
                            <View style={styles.line} />
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder={t('login.email')}
                            placeholderTextColor="rgba(255,255,255,0.65)"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder={t('login.password')}
                            placeholderTextColor="rgba(255,255,255,0.65)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                        <Button
                            title={t('login.login')}
                            onPress={handleLogin}
                            variant="gold"
                            loading={isLoading}
                            disabled={!email.trim() || !password}
                        />
                        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotLink}>
                            <Text style={styles.forgotText}>Forgot password?</Text>
                        </TouchableOpacity>

                        <Text style={styles.adminHint}>Admin accounts open the control center automatically after login.</Text>
                    </View>

                    <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <Text style={styles.link}>{t('login.no_account')}<Text style={styles.linkBold}>{t('login.register')}</Text></Text>
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
        alignItems: 'center',
        padding: SPACING.lg,
    },
    logo: {
        width: 220,
        height: 110,
        marginBottom: SPACING.sm,
    },
    title: {
        color: COLORS.white,
        fontSize: 30,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.84)',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: SPACING.lg,
    },
    tagline: {
        fontSize: 14,
        color: COLORS.accent,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: SPACING.xl,
        textTransform: 'uppercase',
    },
    formContainer: {
        width: '100%',
        maxWidth: 460,
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
        borderRadius: 28,
        padding: 17,
        marginBottom: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: COLORS.white,
        fontSize: 16,
    },
    link: {
        marginTop: SPACING.lg,
        color: 'rgba(255,255,255,0.95)',
        fontSize: 15,
    },
    linkBold: {
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    skipBtn: {
        marginTop: SPACING.md,
        padding: 12,
        alignItems: 'center',
    },
    skipText: {
        color: COLORS.accent,
        fontSize: 16,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.md,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dividerText: {
        color: 'rgba(255,255,255,0.78)',
        marginHorizontal: SPACING.md,
        fontSize: 13,
        fontWeight: '800',
    },
    socialBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderColor: 'rgba(255,215,0,0.42)',
        borderWidth: 1,
        borderRadius: 28,
        paddingVertical: 15,
        paddingHorizontal: 18,
        width: '100%',
        minHeight: 58,
        marginBottom: SPACING.sm,
    },
    socialBtnSubtle: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.16)',
    },
    socialBtnDisabled: {
        opacity: 0.72,
    },
    socialImageIcon: {
        width: 24,
        height: 24,
        marginRight: 12,
    },
    socialBtnText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
    },
    socialBtnTextDisabled: {
        color: 'rgba(255,255,255,0.62)',
    },
    forgotLink: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    forgotText: {
        color: COLORS.accent,
        fontWeight: '700',
        fontSize: 14,
    },
    adminHint: {
        color: 'rgba(255,255,255,0.68)',
        textAlign: 'center',
        fontSize: 12,
        lineHeight: 17,
        marginTop: SPACING.sm,
    },
    notice: {
        borderWidth: 1,
        borderColor: 'rgba(255, 99, 71, 0.45)',
        backgroundColor: 'rgba(255, 99, 71, 0.14)',
        borderRadius: SIZES.radius,
        padding: 12,
        marginBottom: SPACING.md,
    },
    noticeSuccess: {
        borderColor: 'rgba(76, 175, 80, 0.45)',
        backgroundColor: 'rgba(76, 175, 80, 0.14)',
    },
    noticeText: {
        color: COLORS.white,
        fontSize: 14,
        lineHeight: 19,
        fontWeight: '600',
    },
});

export default LoginScreen;
