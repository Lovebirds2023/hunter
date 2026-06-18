import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import client from '../api/client';

const getStoredToken = async () => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        return localStorage.getItem('userToken');
    }
    return SecureStore.getItemAsync('userToken');
};

const getErrorMessage = async (response: Response) => {
    const fallback = `Receipt download failed (${response.status})`;

    try {
        const body = await response.text();
        if (!body) return fallback;

        try {
            const parsed = JSON.parse(body);
            return parsed?.detail || parsed?.message || body;
        } catch {
            return body;
        }
    } catch {
        return fallback;
    }
};

export const downloadOrderReceipt = async (orderId: string) => {
    const token = await getStoredToken();
    const receiptUrl = `${client.defaults.baseURL}/orders/${orderId}/receipt`;
    const fileName = `receipt_${orderId}.pdf`;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const response = await fetch(receiptUrl, { headers });
        if (!response.ok) {
            throw new Error(await getErrorMessage(response));
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.rel = 'noopener';
        window.document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
        }, 1000);
        return;
    }

    const fileRoot = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!fileRoot) {
        throw new Error('Receipt storage is not available on this device.');
    }

    const fileUri = `${fileRoot}${fileName}`;
    const downloadRes = await FileSystem.downloadAsync(
        receiptUrl,
        fileUri,
        headers ? { headers } : undefined
    );

    if (downloadRes.status !== 200) {
        throw new Error(`Receipt download failed (${downloadRes.status})`);
    }

    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
    }
};
