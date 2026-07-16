import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../supabase';
import { runtimeConfig } from '../config/runtimeConfig';

const isRemoteUrl = (uri) => /^https?:\/\//i.test(String(uri || ''));

export const uploadImagesToSupabase = async (images = [], folder = 'uploads', bucket = runtimeConfig.storageBuckets.serviceImages) => {
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

        try {
            if (Platform.OS === 'web') {
                const response = await fetch(uri);
                if (!response.ok) {
                    throw new Error(`Could not read selected image. Status: ${response.status}`);
                }
                body = await response.arrayBuffer();
            } else {
                const base64 = await FileSystem.readAsStringAsync(uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                body = decode(base64);
            }
        } catch (error) {
            throw new Error('Could not read the selected image. Choose the photo again or try a smaller JPG/PNG image.');
        }

        const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, body, {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
};
