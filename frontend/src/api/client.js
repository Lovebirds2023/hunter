import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://hunter-production-0341.up.railway.app';

const normalizeUrl = (url) => {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return normalizedUrl.replace(/\/+$/, '');
};

// EXPO_PUBLIC_API_URL wins when set; production falls back to the live API.
const getBaseUrl = () => {
    const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

    if (envUrl) {
        return normalizeUrl(envUrl);
    }

    if (!__DEV__) {
        return PRODUCTION_API_URL;
    }

    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:8000';
    }

    return 'http://localhost:8000';
};

export const BASE_URL = getBaseUrl();
export const API_URL = BASE_URL;

const client = axios.create({
    baseURL: BASE_URL,
});

client.interceptors.request.use(
    async (config) => {
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

export { client };
export default client;
