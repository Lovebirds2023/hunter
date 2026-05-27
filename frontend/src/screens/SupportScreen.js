import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import client from '../api/client';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../supabase';
import { Image } from 'react-native';

export const SupportScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Form state
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [images, setImages] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const res = await client.get('/support');
            setTickets(res.data);
        } catch (e) {
            console.warn(e);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "We need your permission to access your gallery.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setImages([...images, result.assets[0].uri]);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "We need your permission to access your camera.");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setImages([...images, result.assets[0].uri]);
        }
    };

    const removeImage = (index) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);
    };

    const uploadImages = async () => {
        setUploading(true);
        const uploadedUrls = [];

        try {
            for (const uri of images) {
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
                const filePath = `support/${fileName}`;

                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                const { data, error } = await supabase.storage
                    .from('support_images')
                    .upload(filePath, decode(base64), {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage
                    .from('support_images')
                    .getPublicUrl(filePath);

                uploadedUrls.push(publicUrl);
            }
            return uploadedUrls;
        } catch (error) {
            console.error('Upload error:', error);
            Alert.alert("Upload Failed", "Failed to upload one or more images.");
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!subject.trim() || !message.trim()) {
            Alert.alert("Error", "Please enter a subject and message");
            return;
        }
        setSubmitting(true);
        try {
            let uploadedUrls = [];
            if (images.length > 0) {
                uploadedUrls = await uploadImages();
                if (!uploadedUrls) return; // Error handled in uploadImages
            }

            await client.post('/support', { 
                subject, 
                message,
                images: uploadedUrls
            });

            Alert.alert("Success", "Support ticket submitted. We will get back to you soon!");
            setSubject('');
            setMessage('');
            setImages([]);
            setShowForm(false);
            fetchTickets();
        } catch (e) {
            Alert.alert("Error", "Failed to submit ticket");
        } finally {
            setSubmitting(false);
        }
    };

    const renderTicket = ({ item }) => (
        <View style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
                <Text style={styles.ticketSubject} numberOfLines={1}>{item.subject}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'open' ? '#FFF3CD' : '#D4EDDA' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'open' ? '#856404' : '#155724' }]}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
            </View>
            <Text style={styles.ticketMessage}>{item.message}</Text>
            
            {item.admin_reply && (
                <View style={styles.replyBox}>
                    <Text style={styles.replyLabel}>Admin Reply:</Text>
                    <Text style={styles.replyText}>{item.admin_reply}</Text>
                </View>
            )}
            
            {item.images && item.images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ticketImages}>
                    {item.images.map((img, idx) => (
                        <Image key={idx} source={{ uri: img }} style={styles.ticketImageThumb} />
                    ))}
                </ScrollView>
            )}
            
            <Text style={styles.ticketDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Contact Support</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : null}>
                    <FlatList
                        data={tickets}
                        keyExtractor={item => item.id}
                        renderItem={renderTicket}
                        contentContainerStyle={styles.listContent}
                        ListHeaderComponent={
                            <View style={styles.listHeaderContainer}>
                                <Text style={styles.sectionTitle}>My Tickets</Text>
                                <TouchableOpacity 
                                    style={styles.newTicketBtn} 
                                    onPress={() => setShowForm(!showForm)}
                                >
                                    <Ionicons name={showForm ? "close" : "add"} size={20} color="#fff" />
                                    <Text style={styles.newTicketText}>{showForm ? "Cancel" : "New Ticket"}</Text>
                                </TouchableOpacity>
                            </View>
                        }
                        ListEmptyComponent={
                            !showForm ? <Text style={styles.emptyText}>You don't have any support tickets yet.</Text> : null
                        }
                    />

                    {showForm && (
                        <View style={styles.formContainer}>
                            <Text style={styles.formTitle}>How can we help?</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Subject"
                                value={subject}
                                onChangeText={setSubject}
                                placeholderTextColor="#999"
                            />
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Describe your issue..."
                                value={message}
                                onChangeText={setMessage}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                placeholderTextColor="#999"
                            />

                            {/* Image Picker Section */}
                            <View style={styles.imagePickerContainer}>
                                <TouchableOpacity style={styles.attachmentBtn} onPress={pickImage}>
                                    <Ionicons name="images-outline" size={24} color={COLORS.primary} />
                                    <Text style={styles.attachmentText}>Gallery</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.attachmentBtn} onPress={takePhoto}>
                                    <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                                    <Text style={styles.attachmentText}>Camera</Text>
                                </TouchableOpacity>
                            </View>

                            {images.length > 0 && (
                                <View style={styles.previewsContainer}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {images.map((uri, index) => (
                                            <View key={index} style={styles.previewWrapper}>
                                                <Image source={{ uri }} style={styles.previewImage} />
                                                <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(index)}>
                                                    <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <TouchableOpacity 
                                style={[styles.submitBtn, (submitting || uploading) && { opacity: 0.7 }]} 
                                onPress={handleSubmit} 
                                disabled={submitting || uploading}
                            >
                                {(submitting || uploading) ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Ticket</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: COLORS.white, ...SHADOWS.light },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20, paddingBottom: 100 },
    listHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    newTicketBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, gap: 5 },
    newTicketText: { color: COLORS.white, fontWeight: '600' },
    emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 40 },
    
    ticketCard: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 15, ...SHADOWS.light },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    ticketSubject: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 10, color: COLORS.text },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    ticketMessage: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 10 },
    ticketDate: { fontSize: 12, color: COLORS.gray, textAlign: 'right' },
    replyBox: { backgroundColor: '#F0F4F8', padding: 12, borderRadius: 8, marginTop: 5, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: COLORS.secondary },
    replyLabel: { fontSize: 12, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 4 },
    replyText: { fontSize: 14, color: COLORS.text },

    formContainer: { backgroundColor: COLORS.white, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...SHADOWS.medium },
    formTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: COLORS.text },
    input: { backgroundColor: '#f0f0f0', borderRadius: 10, padding: 15, fontSize: 15, color: COLORS.text, marginBottom: 15 },
    textArea: { height: 100, paddingTop: 15 },
    submitBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
    submitText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
    
    // New styles
    imagePickerContainer: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    attachmentBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4F8', padding: 10, borderRadius: 10, flex: 1, justifyContent: 'center', gap: 8 },
    attachmentText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
    previewsContainer: { marginBottom: 15 },
    previewWrapper: { position: 'relative', marginRight: 10 },
    previewImage: { width: 80, height: 80, borderRadius: 10 },
    removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: COLORS.white, borderRadius: 10 },
    ticketImages: { flexDirection: 'row', marginTop: 10 },
    ticketImageThumb: { width: 60, height: 60, borderRadius: 8, marginRight: 8 }
});
