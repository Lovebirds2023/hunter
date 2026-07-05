import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
    getGoogleAccessTokenFromUrl,
    getGoogleAuthCodeFromUrl,
    getGoogleOAuthRedirectTo,
    getGoogleRefreshTokenFromUrl,
} from './googleAuthConfig';
import { isSupabaseConfigured, supabase } from '../../supabase';

const GOOGLE_OAUTH_NOT_CONFIGURED = 'Supabase Google sign-in is not configured.';
const GOOGLE_SESSION_MISSING = 'Google did not return a valid Supabase session.';

export const finishSupabaseOAuthFromUrl = async (url) => {
    if (!isSupabaseConfigured) {
        throw new Error(GOOGLE_OAUTH_NOT_CONFIGURED);
    }

    const authCode = getGoogleAuthCodeFromUrl(url);
    const accessToken = getGoogleAccessTokenFromUrl(url);
    const refreshToken = getGoogleRefreshTokenFromUrl(url);

    const result = authCode
        ? await supabase.auth.exchangeCodeForSession(authCode)
        : accessToken && refreshToken
            ? await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            })
            : null;

    if (!result) {
        throw new Error(GOOGLE_SESSION_MISSING);
    }

    if (result.error) throw result.error;
    if (!result.data?.session) throw new Error(GOOGLE_SESSION_MISSING);

    return result.data.session;
};

export const startSupabaseGoogleOAuth = async () => {
    if (!isSupabaseConfigured) {
        throw new Error(GOOGLE_OAUTH_NOT_CONFIGURED);
    }

    const redirectTo = getGoogleOAuthRedirectTo();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            queryParams: {
                prompt: 'select_account',
            },
            skipBrowserRedirect: Platform.OS !== 'web',
        },
    });

    if (error) throw error;

    if (Platform.OS === 'web') {
        return { type: 'redirect' };
    }

    if (!data?.url) {
        throw new Error('Google sign-in could not be started.');
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
        return {
            type: 'success',
            session: await finishSupabaseOAuthFromUrl(result.url),
        };
    }

    return { type: result.type || 'cancel' };
};
