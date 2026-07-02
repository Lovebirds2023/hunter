import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { AuthContext } from '../context/AuthContext';
import { ThemeBackground } from '../components/ThemeBackground';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { isSupabaseConfigured, supabase } from '../../supabase';

const readWebRecoveryParams = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return {};

    const searchParams = new URLSearchParams(window.location.search || '');
    const hashValue = (window.location.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hashValue);
    const readParam = (key) => searchParams.get(key) || hashParams.get(key) || '';

    return {
        code: readParam('code'),
        accessToken: readParam('access_token'),
        refreshToken: readParam('refresh_token'),
        type: readParam('type'),
        error: readParam('error_description') || readParam('error'),
    };
};

const ForgotPasswordScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isRecoveryLink, setIsRecoveryLink] = useState(false);
    const [recoverySessionReady, setRecoverySessionReady] = useState(false);
    const [isHandlingRecovery, setIsHandlingRecovery] = useState(false);
    const [localNotice, setLocalNotice] = useState(null);
    const { requestPasswordReset, isLoading, authNotice, clearAuthNotice } = useContext(AuthContext);
    const visibleNotice = localNotice || authNotice;
    const loading = isLoading || isHandlingRecovery;

    useEffect(() => {
        const initializeRecoverySession = async () => {
            const params = readWebRecoveryParams();
            const hasRecoveryCode = Boolean(params.code);
            const hasRecoveryTokens = Boolean(params.accessToken && params.refreshToken);

            if (params.error) {
                setIsRecoveryLink(true);
                setLocalNotice({ type: 'error', message: params.error });
                return;
            }

            if (!hasRecoveryCode && !hasRecoveryTokens) return;

            setIsRecoveryLink(true);
            setIsHandlingRecovery(true);
            setLocalNotice(null);
            clearAuthNotice();

            try {
                if (!isSupabaseConfigured) {
                    throw new Error(t('forgot_password.recovery_error'));
                }

                const result = hasRecoveryCode
                    ? await supabase.auth.exchangeCodeForSession(params.code)
                    : await supabase.auth.setSession({
                        access_token: params.accessToken,
                        refresh_token: params.refreshToken,
                    });

                if (result.error) throw result.error;

                setRecoverySessionReady(true);
                setLocalNotice({ type: 'success', message: t('forgot_password.recovery_ready') });

                if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history?.replaceState) {
                    window.history.replaceState({}, document.title, window.location.pathname || '/reset-password');
                }
            } catch (error) {
                setRecoverySessionReady(false);
                setLocalNotice({
                    type: 'error',
                    message: error?.message || t('forgot_password.recovery_error'),
                });
            } finally {
                setIsHandlingRecovery(false);
            }
        };

        initializeRecoverySession();
    }, []);

    const handleRequestReset = async () => {
        setLocalNotice(null);
        clearAuthNotice();
        await requestPasswordReset(email.trim().toLowerCase());
    };

    const handleResetPassword = async () => {
        setLocalNotice(null);
        clearAuthNotice();

        if (newPassword.length < 8) {
            setLocalNotice({ type: 'error', message: t('forgot_password.weak_password') });
            return;
        }

        if (newPassword !== confirmPassword) {
            setLocalNotice({ type: 'error', message: t('forgot_password.password_mismatch') });
            return;
        }

        if (!recoverySessionReady) {
            setLocalNotice({ type: 'error', message: t('forgot_password.recovery_error') });
            return;
        }

        setIsHandlingRecovery(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            await supabase.auth.signOut();
            setNewPassword('');
            setConfirmPassword('');
            setRecoverySessionReady(false);
            setLocalNotice({ type: 'success', message: t('forgot_password.password_updated') });
        } catch (error) {
            setLocalNotice({
                type: 'error',
                message: error?.message || t('forgot_password.recovery_error'),
            });
        } finally {
            setIsHandlingRecovery(false);
        }
    };

    return (
        <ThemeBackground>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, width: '100%' }}
            >
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    <View style={styles.formContainer}>
                        <Text style={styles.title}>{t('forgot_password.title')}</Text>
                        <Text style={styles.subtitle}>
                            {isRecoveryLink ? t('forgot_password.recovery_subtitle') : t('forgot_password.subtitle')}
                        </Text>

                        {visibleNotice && (
                            <View style={[styles.notice, visibleNotice.type === 'success' && styles.noticeSuccess]}>
                                <Text style={styles.noticeText}>{visibleNotice.message}</Text>
                            </View>
                        )}

                        {isRecoveryLink ? (
                            <>
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('forgot_password.new_password')}
                                    placeholderTextColor="rgba(255,255,255,0.65)"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('forgot_password.confirm_password')}
                                    placeholderTextColor="rgba(255,255,255,0.65)"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                />
                                <Button
                                    title={t('forgot_password.update_password')}
                                    onPress={handleResetPassword}
                                    variant="gold"
                                    loading={loading}
                                    disabled={!recoverySessionReady || newPassword.length < 8 || confirmPassword.length < 8}
                                />
                            </>
                        ) : (
                            <>
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('forgot_password.email')}
                                    placeholderTextColor="rgba(255,255,255,0.65)"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                                <Button
                                    title={t('forgot_password.send_instructions')}
                                    onPress={handleRequestReset}
                                    variant="gold"
                                    loading={loading}
                                    disabled={!email.trim()}
                                />
                            </>
                        )}

                        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backLink}>
                            <Text style={styles.backText}>{t('forgot_password.back_to_login')}</Text>
                        </TouchableOpacity>
                    </View>
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
    formContainer: {
        width: '100%',
        maxWidth: 420,
    },
    title: {
        color: COLORS.white,
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.82)',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: SPACING.md,
        textAlign: 'center',
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
        borderRadius: SIZES.radius,
        padding: 14,
        marginBottom: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: COLORS.white,
        fontSize: 16,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.18)',
        marginVertical: SPACING.lg,
    },
    backLink: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    backText: {
        color: COLORS.accent,
        fontWeight: '700',
        fontSize: 15,
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

export default ForgotPasswordScreen;
