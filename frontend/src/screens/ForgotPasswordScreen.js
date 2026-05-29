import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { Button } from '../components/Button';
import { AuthContext } from '../context/AuthContext';
import { ThemeBackground } from '../components/ThemeBackground';
import { COLORS, SPACING, SIZES } from '../constants/theme';

const ForgotPasswordScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const { requestPasswordReset, resetPassword, isLoading, authNotice, clearAuthNotice } = useContext(AuthContext);

    const handleRequestReset = async () => {
        clearAuthNotice();
        await requestPasswordReset(email.trim().toLowerCase());
    };

    const handleResetPassword = async () => {
        clearAuthNotice();
        const result = await resetPassword(resetToken.trim(), newPassword);
        if (result.success) {
            setNewPassword('');
            setResetToken('');
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
                        <Text style={styles.title}>Reset Password</Text>
                        <Text style={styles.subtitle}>Enter your account email to start a password reset.</Text>

                        {authNotice && (
                            <View style={[styles.notice, authNotice.type === 'success' && styles.noticeSuccess]}>
                                <Text style={styles.noticeText}>{authNotice.message}</Text>
                            </View>
                        )}

                        <TextInput
                            style={styles.input}
                            placeholder="Email address"
                            placeholderTextColor="rgba(255,255,255,0.65)"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <Button
                            title="Send reset instructions"
                            onPress={handleRequestReset}
                            variant="gold"
                            loading={isLoading}
                            disabled={!email.trim()}
                        />

                        <View style={styles.divider} />

                        <Text style={styles.subtitle}>Already have a reset code?</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Reset code"
                            placeholderTextColor="rgba(255,255,255,0.65)"
                            value={resetToken}
                            onChangeText={setResetToken}
                            autoCapitalize="none"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="New password"
                            placeholderTextColor="rgba(255,255,255,0.65)"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry
                        />
                        <Button
                            title="Update password"
                            onPress={handleResetPassword}
                            variant="gold"
                            loading={isLoading}
                            disabled={!resetToken.trim() || newPassword.length < 8}
                        />

                        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backLink}>
                            <Text style={styles.backText}>Back to login</Text>
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
