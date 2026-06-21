import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import client, { subscribeToSessionExpired } from '../api/client';
import { Alert, Platform } from 'react-native';
import { setAppLanguage } from '../i18n';

const Storage = {
    getItemAsync: async (key) => Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key),
    setItemAsync: async (key, value) => Platform.OS === 'web' ? localStorage.setItem(key, value) : await SecureStore.setItemAsync(key, value),
    deleteItemAsync: async (key) => Platform.OS === 'web' ? localStorage.removeItem(key) : await SecureStore.deleteItemAsync(key)
};



export const AuthContext = createContext();

export const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [userToken, setUserToken] = useState(null);
    const [userInfo, setUserInfo] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authNotice, setAuthNotice] = useState(null);

    const clearAuthNotice = () => setAuthNotice(null);

    const isUnauthorizedError = (error) => error?.response?.status === 401;

    const clearStoredSession = async () => {
        setUserToken(null);
        setUserInfo(null);
        setIsAdmin(false);
        await Promise.all([
            Storage.deleteItemAsync('userToken'),
            Storage.deleteItemAsync('userInfo'),
        ]);
    };

    const getFriendlyAuthError = (error, fallback) => {
        if (isUnauthorizedError(error)) {
            return 'Your session has expired. Please sign in again.';
        }
        if (error?.code === 'ECONNABORTED') {
            return 'The login request took too long. Please try again in a moment.';
        }
        if (error?.message === 'Network Error') {
            return 'Could not reach the server. Check your connection and try again.';
        }
        const detail = error?.response?.data?.detail;
        if (typeof detail === 'string') {
            const normalizedDetail = detail.toLowerCase();
            if (detail.toLowerCase().includes('incorrect username or password')) {
                return 'Incorrect email or password. Please check your details and try again.';
            }
            if (normalizedDetail.includes('invalid google token')) {
                return 'Google sign-in could not be verified. Check that Railway has the same Google OAuth client IDs as the frontend, and that the exact site URL is allowed in Google Cloud Console.';
            }
            if (normalizedDetail.includes('google login is temporarily unavailable')) {
                return 'Google verification is temporarily unavailable. Please try again shortly, or use email/password for now.';
            }
            return detail;
        }
        return fallback;
    };

    const login = async (email, password) => {
        setIsLoading(true);
        clearAuthNotice();
        try {
            // Typically URL encoded form data for OAuth2 password flow
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await client.post('/token', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token } = response.data;
            setUserToken(access_token);
            await Storage.setItemAsync('userToken', access_token);

            // Fetch user details
            const userRes = await client.get('/users/me', {
                headers: { Authorization: `Bearer ${access_token}` }
            });
            await setAppLanguage(userRes.data.language || 'en');
            setUserInfo(userRes.data);
            setIsAdmin(userRes.data.role === 'admin' || userRes.data.role === 'super_admin');
            await Storage.setItemAsync('userInfo', JSON.stringify(userRes.data));
            return true;

        } catch (e) {
            if (__DEV__) console.log('Login error', e);
            const message = getFriendlyAuthError(e, 'Login failed. Please try again.');
            setAuthNotice({ type: 'error', message });
            Alert.alert("Login Failed", message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = async (idToken) => {
        setIsLoading(true);
        clearAuthNotice();
        try {
            const response = await client.post('/auth/google', { id_token: idToken }, { timeout: 15000 });
            
            const { access_token, user } = response.data;
            await setAppLanguage(user.language || 'en');
            setUserToken(access_token);
            setUserInfo(user);
            setIsAdmin(user.role === 'admin' || user.role === 'super_admin');
            
            await Storage.setItemAsync('userToken', access_token);
            await Storage.setItemAsync('userInfo', JSON.stringify(user));
            
            return true;
        } catch (e) {
            if (__DEV__) console.log('Google Login error', e);
            const message = getFriendlyAuthError(e, 'Google login failed. Please try email/password or try again.');
            setAuthNotice({ type: 'error', message });
            Alert.alert("Google Login Failed", message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (fullName, email, password, role, phoneNumber, bio, countryCode, preferredLanguage, latitude, longitude, locationAccuracyMeters) => {
        setIsLoading(true);
        clearAuthNotice();
        try {
            await client.post('/register', {
                full_name: fullName,
                email,
                password,
                role,
                phone_number: phoneNumber,
                country: countryCode,
                language: preferredLanguage,
                latitude,
                longitude,
                location_accuracy_meters: locationAccuracyMeters,
                bio
            });
            await setAppLanguage(preferredLanguage || 'en');
            setAuthNotice({ type: 'success', message: 'Registration successful. Please log in.' });
            Alert.alert("Success", "Registration successful. Please login.");
            return true;
        } catch (e) {
            if (__DEV__) console.log('Register error', e?.message, e?.response?.data || e);
            if (e?.message === 'Network Error') {
                const message = "Could not reach the backend. Please check your connection and try again.";
                setAuthNotice({ type: 'error', message });
                Alert.alert("Connection Failed", message);
                return false;
            }
            const message = getFriendlyAuthError(e, 'Registration failed. Please check your details and try again.');
            setAuthNotice({ type: 'error', message });
            Alert.alert("Registration Failed", message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const requestPasswordReset = async (email) => {
        setIsLoading(true);
        clearAuthNotice();
        try {
            const response = await client.post('/password/forgot', { email });
            const message = response.data?.message || 'If this email exists, password reset instructions will be sent shortly.';
            setAuthNotice({ type: 'success', message });
            return { success: true, message };
        } catch (e) {
            if (__DEV__) console.log('Forgot password error', e);
            const message = getFriendlyAuthError(e, 'Could not start password reset. Please try again.');
            setAuthNotice({ type: 'error', message });
            return { success: false, message };
        } finally {
            setIsLoading(false);
        }
    };

    const resetPassword = async (token, newPassword) => {
        setIsLoading(true);
        clearAuthNotice();
        try {
            const response = await client.post('/password/reset', { token, new_password: newPassword });
            const message = response.data?.message || 'Password reset successful. You can now log in.';
            setAuthNotice({ type: 'success', message });
            return { success: true, message };
        } catch (e) {
            if (__DEV__) console.log('Reset password error', e);
            const message = getFriendlyAuthError(e, 'Password reset failed. Check your reset code and try again.');
            setAuthNotice({ type: 'error', message });
            return { success: false, message };
        } finally {
            setIsLoading(false);
        }
    };

    const updateUser = async (data, options = {}) => {
        const { silent = false } = options;
        try {
            const res = await client.put('/users/me', data);
            await setAppLanguage(res.data.language || data.language || 'en');
            setUserInfo(res.data);
            await Storage.setItemAsync('userInfo', JSON.stringify(res.data));
            if (!silent) {
                Alert.alert("Success", "Profile updated!");
            }
            return true;
        } catch (e) {
            if (__DEV__) console.log('Update profile error', e);
            if (!silent) {
                Alert.alert("Error", "Failed to update profile.");
            }
            return false;
        }
    };

    const logout = () => {
        setIsLoading(true);
        clearStoredSession().finally(() => setIsLoading(false));
    };

    const deleteAccount = async () => {
        setIsLoading(true);
        clearAuthNotice();
        try {
            const response = await client.delete('/users/me');
            await clearStoredSession();
            return {
                success: true,
                message: response.data?.message || 'Your account has been deleted.',
            };
        } catch (e) {
            if (__DEV__) console.log('Delete account error', e);
            const message = getFriendlyAuthError(e, 'Could not delete account. Please try again or contact support.');
            setAuthNotice({ type: 'error', message });
            return { success: false, message };
        } finally {
            setIsLoading(false);
        }
    };



    const isLoggedIn = async () => {
        try {
            setIsLoading(true);
            let userToken = await Storage.getItemAsync('userToken');
            let userInfoStr = await Storage.getItemAsync('userInfo');

            if (userToken) {
                setUserToken(userToken);
                if (userInfoStr) {
                    const parsedInfo = JSON.parse(userInfoStr);
                    await setAppLanguage(parsedInfo.language || 'en');
                    setUserInfo(parsedInfo);
                    setIsAdmin(parsedInfo.role === 'admin' || parsedInfo.role === 'super_admin');
                }

                // Refresh user info in background
                client.get('/users/me').then(async res => {
                    await setAppLanguage(res.data.language || 'en');
                    setUserInfo(res.data);
                    setIsAdmin(res.data.role === 'admin' || res.data.role === 'super_admin');
                    Storage.setItemAsync('userInfo', JSON.stringify(res.data));
                }).catch(async e => {
                    if (isUnauthorizedError(e)) {
                        if (__DEV__) console.log("Stored session expired; signing out.");
                        await clearStoredSession();
                        return;
                    }
                    if (__DEV__) console.log("Failed to refresh user info", e);
                });
            }
        } catch (e) {
            if (__DEV__) console.log('isLoggedIn error', e);
            await clearStoredSession();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        isLoggedIn();
    }, []);

    useEffect(() => {
        let isHandlingExpiry = false;
        const handleSessionExpired = async () => {
            if (isHandlingExpiry) return;
            isHandlingExpiry = true;
            try {
                await clearStoredSession();
                setAuthNotice({ type: 'info', message: 'Your session has expired. Please sign in again.' });
            } finally {
                isHandlingExpiry = false;
            }
        };

        return subscribeToSessionExpired(handleSessionExpired);
    }, []);

    return (
        <AuthContext.Provider value={{
            login,
            logout,
            deleteAccount,
            register,
            updateUser,
            googleLogin,
            requestPasswordReset,
            resetPassword,
            clearAuthNotice,
            authNotice,
            isLoading,
            userToken,
            userInfo,
            user: userInfo,
            isAdmin
        }}>
            {children}
        </AuthContext.Provider>
    );
};
