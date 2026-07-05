import { Platform } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import appConfig from '../../app.json';
import { hasSupabaseConfig } from '../config/runtimeConfig';

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
const APP_SCHEME = readConfigValue(
    process.env.EXPO_PUBLIC_APP_SCHEME,
    embeddedExtra.appScheme,
    appConfig?.expo?.scheme || 'lovedogs360'
);

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

export const getGoogleOAuthRedirectTo = () => {
    if (GOOGLE_REDIRECT_URI) {
        return GOOGLE_REDIRECT_URI;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const path = GOOGLE_REDIRECT_PATH.replace(/^\/+/, '');
        return `${window.location.origin}/${path}`;
    }

    const path = GOOGLE_REDIRECT_PATH.replace(/^\/+/, '');
    return makeRedirectUri({
        scheme: APP_SCHEME,
        native: `${APP_SCHEME}://${path}`,
        path,
    });
};

export const getGoogleAuthStatus = () => {
    if (!hasSupabaseConfig) {
        return {
            isAvailable: false,
            reason: 'Supabase Google sign-in is not configured.',
        };
    }

    return { isAvailable: true, reason: '' };
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
export const getGoogleAuthCodeFromUrl = (url) => getUrlParam(url, 'code');
export const getGoogleAccessTokenFromUrl = (url) => getUrlParam(url, 'access_token');
export const getGoogleRefreshTokenFromUrl = (url) => getUrlParam(url, 'refresh_token');

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
