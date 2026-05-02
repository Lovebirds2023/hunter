import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';
import { Alert, Platform } from 'react-native';

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

    const login = async (email, password) => {
        setIsLoading(true);
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
            setUserInfo(userRes.data);
            setIsAdmin(userRes.data.role === 'admin');
            await Storage.setItemAsync('userInfo', JSON.stringify(userRes.data));

        } catch (e) {
            if (__DEV__) console.log('Login error', e);
            Alert.alert("Login Failed", "Invalid credentials");
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = async (idToken) => {
        setIsLoading(true);
        try {
            const response = await client.post('/auth/google', { id_token: idToken });
            
            const { access_token, user } = response.data;
            setUserToken(access_token);
            setUserInfo(user);
            setIsAdmin(user.role === 'admin');
            
            await Storage.setItemAsync('userToken', access_token);
            await Storage.setItemAsync('userInfo', JSON.stringify(user));
            
            return true;
        } catch (e) {
            if (__DEV__) console.log('Google Login error', e);
            Alert.alert("Google Login Failed", "Something went wrong during authentication.");
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (fullName, email, password, role, phoneNumber, bio, countryCode, preferredLanguage, latitude, longitude) => {
        setIsLoading(true);
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
                bio
            });
            Alert.alert("Success", "Registration successful. Please login.");
            return true;
        } catch (e) {
            if (__DEV__) console.log('Register error', e?.message, e?.response?.data || e);
            if (e?.message === 'Network Error') {
                Alert.alert(
                    "Connection Failed",
                    "Could not reach the backend. If you are on a physical phone, 'localhost' will not work. Please update EXPO_PUBLIC_API_URL in your .env to your computer's IP address (e.g. http://192.168.x.x:8000)."
                );
                return false;
            }
            const detail = e?.response?.data?.detail || "Something went wrong.";
            Alert.alert("Registration Failed", typeof detail === 'string' ? detail : JSON.stringify(detail));
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateUser = async (data) => {
        try {
            const res = await client.put('/users/me', data);
            setUserInfo(res.data);
            await Storage.setItemAsync('userInfo', JSON.stringify(res.data));
            Alert.alert("Success", "Profile updated!");
            return true;
        } catch (e) {
            if (__DEV__) console.log('Update profile error', e);
            Alert.alert("Error", "Failed to update profile.");
            return false;
        }
    };

    const logout = () => {
        setIsLoading(true);
        setUserToken(null);
        setUserInfo(null);
        setIsAdmin(false);
        Storage.deleteItemAsync('userToken');
        Storage.deleteItemAsync('userInfo');
        setIsLoading(false);
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
                    setUserInfo(parsedInfo);
                    setIsAdmin(parsedInfo.role === 'admin');
                }

                // Refresh user info in background
                client.get('/users/me').then(res => {
                    setUserInfo(res.data);
                    setIsAdmin(res.data.role === 'admin');
                    Storage.setItemAsync('userInfo', JSON.stringify(res.data));
                }).catch(e => { if (__DEV__) console.log("Failed to refresh user info", e); });
            }
            setIsLoading(false);
        } catch (e) {
            if (__DEV__) console.log('isLoggedIn error', e);
        }
    };

    useEffect(() => {
        isLoggedIn();
    }, []);

    return (
        <AuthContext.Provider value={{ login, logout, register, updateUser, googleLogin, isLoading, userToken, userInfo, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
};
