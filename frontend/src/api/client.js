import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { runtimeConfig } from '../config/runtimeConfig';

const normalizeUrl = (url) => {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return normalizedUrl.replace(/\/+$/, '');
};

const missingApiMessage = 'API URL is not configured. Set EXPO_PUBLIC_API_URL to the Supabase-backed API endpoint before building the app.';

const getBaseUrl = () => {
    const envUrl = runtimeConfig.apiUrl;

    if (envUrl) {
        return normalizeUrl(envUrl);
    }

    if (!__DEV__) {
        console.error(missingApiMessage);
        return '';
    }

    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:8000';
    }

    return 'http://localhost:8000';
};

export const BASE_URL = getBaseUrl();
export const API_URL = BASE_URL;
export const API_CONFIGURATION_ERROR = BASE_URL ? null : missingApiMessage;
export const AUTH_SESSION_EXPIRED_EVENT = 'lovedogs360:auth-session-expired';
const sessionExpiredListeners = new Set();

const isAuthEndpoint = (url = '') => (
    url.includes('/token') ||
    url.includes('/auth/google') ||
    url.includes('/register') ||
    url.includes('/password/')
);

const notifySessionExpired = () => {
    sessionExpiredListeners.forEach((listener) => {
        try {
            listener();
        } catch (error) {
            if (__DEV__) console.log('Session expiry listener failed', error);
        }
    });

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
    }
};

export const subscribeToSessionExpired = (listener) => {
    sessionExpiredListeners.add(listener);
    return () => sessionExpiredListeners.delete(listener);
};

const client = axios.create({
    baseURL: BASE_URL,
});

client.interceptors.request.use(
    async (config) => {
        if (API_CONFIGURATION_ERROR) {
            return Promise.reject(new Error(API_CONFIGURATION_ERROR));
        }

        let token = null;
        try {
            // On web, Platform.OS may be 'web' or undefined, so check both
            const isWeb = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
            
            if (isWeb) {
                token = localStorage.getItem('userToken');
            } else if (Platform.OS && Platform.OS !== 'web') {
                token = await SecureStore.getItemAsync('userToken');
            }
        } catch (e) {
            console.error('Token retrieval error:', e);
        }
        
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

client.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const requestUrl = error?.config?.url || '';
        if (status === 401 && !isAuthEndpoint(requestUrl)) {
            notifySessionExpired();
        }
        return Promise.reject(error);
    }
);

export { client };
export default client;
