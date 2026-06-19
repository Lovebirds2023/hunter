import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { ThemeBackground } from '../components/ThemeBackground';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import {
    getGoogleAuthErrorFromUrl,
    getGoogleIdTokenFromUrl,
} from '../api/googleAuthConfig';

const getCurrentWebUrl = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
    return window.location.href;
};

const replaceWebUrl = (path) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history?.replaceState) return;
    window.history.replaceState({}, document.title, path);
};

const GoogleAuthCallbackScreen = ({ navigation }) => {
    const { googleLogin, authNotice, clearAuthNotice } = useContext(AuthContext);
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('Finishing Google sign-in...');
    const handledRef = useRef(false);

    useEffect(() => {
        if (handledRef.current) return;
        handledRef.current = true;

        const finishGoogleLogin = async () => {
            const currentUrl = getCurrentWebUrl();
            const idToken = getGoogleIdTokenFromUrl(currentUrl);
            const googleError = getGoogleAuthErrorFromUrl(currentUrl);

            if (idToken) {
                replaceWebUrl('/auth/google');
                const success = await googleLogin(idToken);
                if (success) {
                    replaceWebUrl('/');
                    setStatus('success');
                    setMessage('Google sign-in complete. Taking you into the app...');
                } else {
                    setStatus('error');
                    setMessage(authNotice?.message || 'Google sign-in could not be verified. Please try again.');
                }
                return;
            }

            clearAuthNotice();
            replaceWebUrl('/auth/google');

            if (googleError) {
                setStatus('error');
                setMessage(`Google returned an error: ${googleError}`);
                return;
            }

            setStatus('info');
            setMessage('This Google callback link only works after you choose a Google account. Go back and tap Continue with Google to start sign-in.');
        };

        finishGoogleLogin();
    }, [authNotice?.message, clearAuthNotice, googleLogin]);

    const goToLogin = () => {
        if (navigation?.replace) {
            navigation.replace('Login');
        } else {
            navigation?.navigate?.('Login');
        }
    };

    return (
        <ThemeBackground>
            <View style={styles.container}>
                <View style={styles.panel}>
                    {status === 'loading' && <ActivityIndicator size="large" color={COLORS.accent} style={styles.loader} />}
                    <Text style={styles.title}>
                        {status === 'loading' ? 'Google Sign-In' : status === 'success' ? 'Signed In' : 'Google Sign-In Help'}
                    </Text>
                    <Text style={styles.message}>{message}</Text>
                    {status !== 'loading' && status !== 'success' && (
                        <TouchableOpacity style={styles.button} onPress={goToLogin} activeOpacity={0.85}>
                            <Text style={styles.buttonText}>Back to Login</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    panel: {
        width: '100%',
        maxWidth: 460,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.35)',
        borderRadius: SIZES.radius,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: SPACING.xl,
        alignItems: 'center',
    },
    loader: {
        marginBottom: SPACING.md,
    },
    title: {
        color: COLORS.white,
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    message: {
        color: 'rgba(255,255,255,0.86)',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
    },
    button: {
        marginTop: SPACING.lg,
        borderRadius: 28,
        backgroundColor: COLORS.accent,
        paddingVertical: 14,
        paddingHorizontal: 24,
        minWidth: 180,
        alignItems: 'center',
    },
    buttonText: {
        color: COLORS.primary,
        fontSize: 15,
        fontWeight: '900',
    },
});

export default GoogleAuthCallbackScreen;
