import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { AuthContext } from '../context/AuthContext';
import { ThemeBackground } from '../components/ThemeBackground';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
    getGoogleAuthRequestConfig,
    getGoogleAuthStatus,
    getGoogleIdTokenFromResponse,
} from '../api/googleAuthConfig';

WebBrowser.maybeCompleteAuthSession();

const SocialLoginButton = ({ imageUri, label, onPress, disabled }) => (
    <TouchableOpacity
        style={[styles.socialBtn, disabled && styles.socialBtnDisabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.82}
    >
        <Image source={{ uri: imageUri }} style={styles.socialImageIcon} />
        <Text style={[styles.socialBtnText, disabled && styles.socialBtnTextDisabled]}>{label}</Text>
    </TouchableOpacity>
);

const GoogleSignInButton = ({ googleLogin, label, disabledLabel, onAuthNotice }) => {
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest(getGoogleAuthRequestConfig());

    React.useEffect(() => {
        if (response?.type === 'success') {
            const idToken = getGoogleIdTokenFromResponse(response);
            if (idToken) {
                googleLogin(idToken);
            } else {
                onAuthNotice('Google did not return an ID token. Please try again or use email/password.');
            }
        } else if (response?.type === 'error') {
            onAuthNotice(response.error?.message || 'Google login failed before reaching the server.');
        }
    }, [response, googleLogin, onAuthNotice]);

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
    const [localNotice, setLocalNotice] = useState(null);
    const { login, googleLogin, isLoading, authNotice, clearAuthNotice } = useContext(AuthContext);
    const googleAuthStatus = getGoogleAuthStatus();
    const canUseGoogleAuth = googleAuthStatus.isAvailable;
    const visibleNotice = localNotice || authNotice;

    const handleLogin = async () => {
        setLocalNotice(null);
        clearAuthNotice();
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !password) {
            return;
        }
        await login(cleanEmail, password);
    };

    const showUnavailableNotice = (message) => {
        clearAuthNotice();
        setLocalNotice({ type: 'info', message });
    };

    const showGoogleError = React.useCallback((message) => {
        clearAuthNotice();
        setLocalNotice({ type: 'error', message });
    }, [clearAuthNotice]);

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
                        <Text style={styles.title}>{t('login.title')}</Text>

                        {visibleNotice && (
                            <View style={[
                                styles.notice,
                                visibleNotice.type === 'error' && styles.noticeError,
                                visibleNotice.type === 'success' && styles.noticeSuccess,
                                visibleNotice.type === 'info' && styles.noticeInfo,
                            ]}>
                                <View style={styles.noticeContent}>
                                    <Text style={styles.noticeIcon}>
                                        {visibleNotice.type === 'success' && '✓'}
                                        {visibleNotice.type === 'error' && '✕'}
                                        {visibleNotice.type === 'info' && 'ℹ'}
                                    </Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.noticeText}>{visibleNotice.message}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {canUseGoogleAuth ? (
                            <GoogleSignInButton
                                googleLogin={googleLogin}
                                label={t('login.continue_google')}
                                disabledLabel={t('login.google_unavailable')}
                                onAuthNotice={showGoogleError}
                            />
                        ) : (
                            <SocialLoginButton
                                imageUri="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
                                label={t('login.setup_google')}
                                onPress={() => showUnavailableNotice(googleAuthStatus.reason || t('login.google_setup_notice'))}
                            />
                        )}

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
                            <Text style={styles.forgotText}>{t('login.forgot_password')}</Text>
                        </TouchableOpacity>
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
        borderWidth: 2,
        borderColor: 'rgba(255, 99, 71, 0.6)',
        backgroundColor: 'rgba(255, 99, 71, 0.25)',
        borderRadius: SIZES.radius,
        padding: 14,
        marginBottom: SPACING.md,
        shadowColor: 'rgba(255, 99, 71, 0.4)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    noticeError: {
        borderColor: 'rgba(255, 70, 70, 0.7)',
        backgroundColor: 'rgba(255, 70, 70, 0.28)',
        shadowColor: 'rgba(255, 70, 70, 0.5)',
    },
    noticeSuccess: {
        borderColor: 'rgba(76, 175, 80, 0.65)',
        backgroundColor: 'rgba(76, 175, 80, 0.28)',
        shadowColor: 'rgba(76, 175, 80, 0.4)',
    },
    noticeInfo: {
        borderColor: 'rgba(255,215,0,0.55)',
        backgroundColor: 'rgba(255,215,0,0.20)',
        shadowColor: 'rgba(255,215,0,0.3)',
    },
    noticeContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    noticeIcon: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 2,
    },
    noticeText: {
        color: COLORS.white,
        fontSize: 14,
        lineHeight: 19,
        fontWeight: '600',
    },
});

export default LoginScreen;
