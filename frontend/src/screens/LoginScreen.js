import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { AuthContext } from '../context/AuthContext';
import { ThemeBackground } from '../components/ThemeBackground';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { login, devBypass, googleLogin } = useContext(AuthContext);

    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });

    React.useEffect(() => {
        if (response?.type === 'success') {
            const { authentication } = response;
            googleLogin(authentication.idToken);
        }
    }, [response]);

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
                        <Button title={t('login.login')} onPress={() => login(email, password)} variant="gold" />
                        
                        <View style={styles.divider}>
                            <View style={styles.line} />
                            <Text style={styles.dividerText}>{t('login.or')}</Text>
                            <View style={styles.line} />
                        </View>

                        <TouchableOpacity 
                            style={styles.googleBtn} 
                            onPress={() => promptAsync()}
                            disabled={!request}
                        >
                            <Image 
                                source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' }} 
                                style={styles.googleIcon} 
                            />
                            <Text style={styles.googleBtnText}>{t('login.google_signin')}</Text>
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
        width: 280,
        height: 140,
        marginBottom: SPACING.md,
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
        maxWidth: 400,
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
        marginVertical: SPACING.lg,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dividerText: {
        color: 'rgba(255,255,255,0.6)',
        marginHorizontal: SPACING.md,
        fontSize: 14,
    },
    googleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
        borderRadius: SIZES.radius,
        padding: 12,
        width: '100%',
    },
    googleIcon: {
        width: 24,
        height: 24,
        marginRight: 10,
    },
    googleBtnText: {
        color: '#757575',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LoginScreen;
