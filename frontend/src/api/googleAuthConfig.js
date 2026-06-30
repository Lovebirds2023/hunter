import { Platform } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import appConfig from '../../app.json';

const embeddedExtra =
    Constants?.expoConfig?.extra
    || Constants?.manifest?.extra
    || Constants?.manifest2?.extra?.expoClient?.extra
    || appConfig?.expo?.extra
    || {};
const embeddedGoogleClientIds = embeddedExtra.googleClientIds || {};

const ENV_GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const ENV_GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ENV_GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const ENV_GOOGLE_REDIRECT_PATH = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_PATH;
const ENV_GOOGLE_REDIRECT_URI = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI;

const cleanConfigValue = (value) => (typeof value === 'string' ? value.trim() : '');
const readConfigValue = (envValue, embeddedValue, fallback = '') => (
    cleanConfigValue(envValue) || cleanConfigValue(embeddedValue) || fallback
);

export const GOOGLE_REDIRECT_PATH = readConfigValue(
    ENV_GOOGLE_REDIRECT_PATH,
    embeddedExtra.googleRedirectPath,
    'auth/google'
);
export const GOOGLE_REDIRECT_URI = readConfigValue(
    ENV_GOOGLE_REDIRECT_URI,
    embeddedExtra.googleRedirectUri
);
const ANDROID_PACKAGE_NAME =
    embeddedExtra.androidPackage
    || appConfig?.expo?.android?.package
    || 'your Android package';

export const googleClientIds = {
    web: readConfigValue(ENV_GOOGLE_WEB_CLIENT_ID, embeddedGoogleClientIds.web),
    ios: readConfigValue(ENV_GOOGLE_IOS_CLIENT_ID, embeddedGoogleClientIds.ios),
    android: readConfigValue(ENV_GOOGLE_ANDROID_CLIENT_ID, embeddedGoogleClientIds.android),
};

export const isUsableGoogleClientId = (clientId) => {
    if (!clientId) return false;
    const normalized = clientId.trim().toLowerCase();
    return normalized.endsWith('.apps.googleusercontent.com') && !normalized.startsWith('your-');
};

export const getGoogleRedirectUri = () => {
    if (GOOGLE_REDIRECT_URI) {
        return GOOGLE_REDIRECT_URI;
    }

    if (Platform.OS === 'web') {
        return makeRedirectUri({
            useProxy: false,
            path: GOOGLE_REDIRECT_PATH,
        });
    }

    return undefined;
};

export const getGoogleAuthStatus = () => {
    if (Platform.OS === 'web') {
        return {
            isAvailable: isUsableGoogleClientId(googleClientIds.web),
            reason: 'Google Web Client ID is missing or invalid.',
        };
    }

    if (Platform.OS === 'ios') {
        return {
            isAvailable: isUsableGoogleClientId(googleClientIds.ios),
            reason: 'Google iOS Client ID is missing or invalid.',
        };
    }

    if (Platform.OS === 'android') {
        return {
            isAvailable: isUsableGoogleClientId(googleClientIds.android),
            reason: `Google Android Client ID is missing. Create one for package ${ANDROID_PACKAGE_NAME} with the app SHA-1 fingerprint.`,
        };
    }

    return {
        isAvailable: false,
        reason: 'Google login is not available on this platform.',
    };
};

export const getGoogleAuthRequestConfig = () => {
    const redirectUri = getGoogleRedirectUri();
    const config = {
        webClientId: googleClientIds.web,
        iosClientId: googleClientIds.ios,
        androidClientId: googleClientIds.android,
        scopes: ['openid', 'profile', 'email'],
        selectAccount: true,
    };

    if (Platform.OS === 'android' && googleClientIds.android) {
        config.clientId = googleClientIds.android;
    } else if (Platform.OS !== 'ios' && googleClientIds.web) {
        config.clientId = googleClientIds.web;
    }

    if (redirectUri) {
        config.redirectUri = redirectUri;
    }

    return config;
};

const getUrlParam = (url, key) => {
    if (!url) return null;

    try {
        const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.origin
            : 'https://localhost';
        const parsedUrl = new URL(url, baseUrl);
        const queryParams = new URLSearchParams(parsedUrl.search);
        const hashParams = new URLSearchParams(parsedUrl.hash?.replace(/^#/, '') || '');

        return queryParams.get(key) || hashParams.get(key);
    } catch (error) {
        if (__DEV__) console.log('Could not parse Google auth URL', error);
        return null;
    }
};

export const getGoogleIdTokenFromUrl = (url) => getUrlParam(url, 'id_token');

export const getGoogleAuthErrorFromUrl = (url) => {
    const error = getUrlParam(url, 'error');
    const description = getUrlParam(url, 'error_description');

    if (!error && !description) return null;
    return [error, description].filter(Boolean).join(': ');
};

export const getGoogleIdTokenFromResponse = (response) => (
    response?.authentication?.idToken
    || response?.params?.id_token
    || getGoogleIdTokenFromUrl(response?.url)
    || null
);
