import { makeRedirectUri } from 'expo-auth-session';

export const GOOGLE_REDIRECT_PATH = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_PATH || 'auth/google';

export const getGoogleRedirectUri = () => makeRedirectUri({
    useProxy: false,
    path: GOOGLE_REDIRECT_PATH,
});
