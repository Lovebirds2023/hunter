import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Production API URL — must be set via EXPO_PUBLIC_API_URL in .env
const getBaseUrl = () => {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!envUrl) {
        // In production builds, EXPO_PUBLIC_API_URL must always be set
        if (!__DEV__) {
            console.error('FATAL: EXPO_PUBLIC_API_URL is not set in production.');
        }
        // Fallbacks only for local development
        if (Platform.OS === 'android') {
            return 'http://10.0.2.2:8000';
        }
        return 'http://localhost:8000';
    }

    return envUrl;
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
            if (Platform.OS === 'web') {
                token = localStorage.getItem('userToken');
            } else {
                token = await SecureStore.getItemAsync('userToken');
            }
        } catch (e) {
            // Silently handle storage errors
        }
        
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default client;
