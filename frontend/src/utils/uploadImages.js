import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../supabase';

const isRemoteUrl = (uri) => /^https?:\/\//i.test(String(uri || ''));

export const uploadImagesToSupabase = async (images = [], folder = 'uploads') => {
    const uploadedUrls = [];

    for (const uri of images) {
        if (!uri) continue;
        if (isRemoteUrl(uri)) {
            uploadedUrls.push(uri);
            continue;
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const filePath = `${folder}/${fileName}`;
        let body;

        if (Platform.OS === 'web') {
            const response = await fetch(uri);
            body = await response.arrayBuffer();
        } else {
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            body = decode(base64);
        }

        const { error } = await supabase.storage
            .from('support_images')
            .upload(filePath, body, {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('support_images')
            .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
};
