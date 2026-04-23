import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView, Image, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import client from '../api/client';
import { Button } from '../components/Button';
import * as Location from 'expo-location';

// Category Definitions
const SERVICE_CATEGORIES = [
    "health",
    "therapy & wellbeing",
    "training",
    "grooming",
    "boarding / care",
    "events & programs",
    "safety & compliance",
    "rehoming"
];

const PRODUCT_CATEGORIES = [
    "food",
    "health products",
    "equipment",
    "toys",
    "travel",
    "therapy gear"
];

const CreateServiceScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const { service } = route.params || {};
    const isEditing = !!service;

    const [title, setTitle] = useState(service?.title || '');
    const [description, setDescription] = useState(service?.description || '');
    const [price, setPrice] = useState(service ? (service.price / 1.235).toFixed(2) : '');
    const [images, setImages] = useState(service?.images || (service?.image_url ? [service.image_url] : []));
    const [currency, setCurrency] = useState(service?.currency || 'KES');
    const [stockCount, setStockCount] = useState(service?.stock_count?.toString() || '0');
    const [slotsAvailable, setSlotsAvailable] = useState(service?.slots_available?.toString() || '0');
    const [isBusy, setIsBusy] = useState(service?.is_busy || false);
    const [locationLandmark, setLocationLandmark] = useState(service?.location_landmark || '');
    const [itemType, setItemType] = useState(service?.item_type || 'services');
    const [category, setCategory] = useState(service?.category || SERVICE_CATEGORIES[0]);
    const [isPublished, setIsPublished] = useState(service?.is_published ?? true);
    const [latitude, setLatitude] = useState(service?.latitude || null);
    const [longitude, setLongitude] = useState(service?.longitude || null);
    const [address, setAddress] = useState(service?.address || '');
    const [loading, setLoading] = useState(false);
    const [fetchingLocation, setFetchingLocation] = useState(false);
    const [formFields, setFormFields] = useState([]);

    const getCurrentLocation = async () => {
        setFetchingLocation(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('common.error'), t('common.location_req'));
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLatitude(location.coords.latitude);
            setLongitude(location.coords.longitude);

            // Reverse geocode to get address string
            let reverse = await Location.reverseGeocodeAsync(location.coords);
            if (reverse && reverse.length > 0) {
                const addr = reverse[0];
                const addrStr = `${addr.street || ''} ${addr.city || ''} ${addr.region || ''}`.trim();
                setAddress(addrStr);
            }
        } catch (error) {
            console.error(error);
            Alert.alert(t('common.error'), t('common.location_fail'));
        } finally {
            setFetchingLocation(false);
        }
    };

    const pickImage = async () => {
        if (images.length >= 5) {
            Alert.alert(t('common.error') || 'Error', 'Maximum 5 images allowed.');
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            allowsMultipleSelection: true,
            selectionLimit: 5 - images.length,
            quality: 0.7,
        });

        if (!result.canceled) {
            const selectedUris = result.assets.map(a => a.uri);
            setImages(prev => [...prev, ...selectedUris].slice(0, 5));
        }
    };

    const removeImage = (indexToRemove) => {
        setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleTypeChange = (type) => {
        setItemType(type);
        setCategory(type === 'services' ? SERVICE_CATEGORIES[0] : PRODUCT_CATEGORIES[0]);
    };

    const handleSubmit = async () => {
        if (!title || !description || !price) {
            Alert.alert(t('common.error'), t('marketplace.create.error_fill'));
            return;
        }

        setLoading(true);
        try {
            const data = {
                title,
                description,
                price: parseFloat(price), // Send base price directly to backend
                item_type: itemType,
                category,
                image_url: images.length > 0 ? images[0] : null,
                images,
                currency,
                stock_count: parseInt(stockCount) || 0,
                slots_available: parseInt(slotsAvailable) || 0,
                is_busy: isBusy,
                latitude,
                longitude,
                address,
                location_landmark: locationLandmark,
                is_published: isPublished,
                form_fields: formFields
            };

            if (isEditing) {
                await client.put(`/services/${service.id}`, data);
                Alert.alert(t('common.success'), t('marketplace.create.success_update'));
            } else {
                await client.post('/services', data);
                Alert.alert(t('common.success'), t('marketplace.create.success_create', { type: itemType === 'services' ? t('marketplace.create.services') : t('marketplace.create.products') }));
            }
            navigation.goBack();
        } catch (error) {
            console.error(error);
            Alert.alert(t('common.error'), isEditing ? t('marketplace.create.error_update') : t('marketplace.create.error_create'));
        } finally {
            setLoading(false);
        }
    };

    const currentCategories = itemType === 'services' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isEditing ? t('marketplace.create.title_edit') : t('marketplace.create.title_new')}</Text>
                <View style={{ width: 32 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

                    {/* Item Type Selection */}
                    <Text style={styles.label}>{t('marketplace.create.question')}</Text>
                    <View style={styles.typeContainer}>
                        <TouchableOpacity
                            style={[styles.typeBtn, itemType === 'services' && styles.activeTypeBtn]}
                            onPress={() => handleTypeChange('services')}
                        >
                            <Ionicons name="hand-left-outline" size={24} color={itemType === 'services' ? 'white' : COLORS.primary} />
                            <Text style={[styles.typeText, itemType === 'services' && styles.activeTypeText]}>{t('marketplace.create.services')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeBtn, itemType === 'products' && styles.activeTypeBtn]}
                            onPress={() => handleTypeChange('products')}
                        >
                            <Ionicons name="cube-outline" size={24} color={itemType === 'products' ? 'white' : COLORS.primary} />
                            <Text style={[styles.typeText, itemType === 'products' && styles.activeTypeText]}>{t('marketplace.create.products')}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Image Upload */}
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Text style={styles.label}>{t('marketplace.create.images', {defaultValue: 'Images'})} ({images.length}/5)</Text>
                        {images.length < 5 && (
                            <TouchableOpacity onPress={pickImage}>
                                <Text style={{color: COLORS.primary, fontWeight: 'bold'}}>+ Add</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
                        {images.map((uri, idx) => (
                            <View key={idx} style={styles.imageWrapper}>
                                <Image source={{ uri }} style={styles.galleryImage} />
                                <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(idx)}>
                                    <Ionicons name="close-circle" size={24} color="white" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {images.length === 0 && (
                            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                                <Ionicons name="images-outline" size={32} color={COLORS.primary} />
                                <Text style={styles.imagePlaceholderText}>Upload up to 5 photos</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {/* Form Fields */}
                    <Text style={styles.label}>{t('report.form.labels.title')}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={itemType === 'services' ? "e.g., Dog Walking, Behavior Training" : "e.g., Organic Dog Food, Chew Toy"}
                        value={title}
                        onChangeText={setTitle}
                    />

                    <Text style={styles.label}>Category</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={category} onValueChange={setCategory}>
                            {currentCategories.map(cat => (
                                <Picker.Item key={cat} label={t(`marketplace.categories.${cat.split(' ')[0]}`, { defaultValue: cat })} value={cat} />
                            ))}
                        </Picker>
                    </View>

                    <View style={{flexDirection: 'row', gap: 10}}>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Currency</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={currency} onValueChange={setCurrency}>
                                    <Picker.Item label="KES" value="KES" />
                                    <Picker.Item label="USD" value="USD" />
                                    <Picker.Item label="EUR" value="EUR" />
                                    <Picker.Item label="GBP" value="GBP" />
                                </Picker>
                            </View>
                        </View>
                        
                        <View style={{flex: 2}}>
                            <Text style={styles.label}>{t('marketplace.create.price_label')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0.00"
                                value={price}
                                onChangeText={setPrice}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    {/* Pricing Helper Text */}
                    {price ? (
                        <View style={styles.feeBreakdown}>
                            <Text style={styles.feeText}>Base Price you receive: <Text style={{fontWeight: 'bold'}}>{currency} {parseFloat(price).toFixed(2)}</Text></Text>
                            <Text style={styles.feeText}>Marketplace mark-up (23.5%): {currency} {(parseFloat(price) * 0.235).toFixed(2)}</Text>
                            <Text style={styles.totalPriceText}>
                                Final listing price: {currency} {(parseFloat(price || 0) * 1.235).toFixed(2)}
                            </Text>
                        </View>
                    ) : null}

                    {/* Inventory / Stock */}
                    {itemType === 'products' ? (
                        <View>
                            <Text style={styles.label}>Stock Available</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Number of items"
                                value={stockCount}
                                onChangeText={setStockCount}
                                keyboardType="numeric"
                            />
                        </View>
                    ) : (
                        <View>
                            <Text style={styles.label}>Available Items/ Slots / Capacity</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., 5 dogs per day"
                                value={slotsAvailable}
                                onChangeText={setSlotsAvailable}
                                keyboardType="numeric"
                            />
                            
                            <View style={styles.publishContainer}>
                                <View>
                                    <Text style={styles.publishLabel}>Mark as Busy</Text>
                                    <Text style={styles.publishSubtitle}>Pause new bookings temporarily</Text>
                                </View>
                                <Switch
                                    value={isBusy}
                                    onValueChange={setIsBusy}
                                    trackColor={{ false: '#767577', true: COLORS.error }}
                                    thumbColor={isBusy ? '#ff4444' : '#f4f3f4'}
                                />
                            </View>
                        </View>
                    )}

                    <Text style={styles.label}>{t('report.form.labels.description')}</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Describe your offering..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                    />

                    <Text style={styles.label}>{t('marketplace.create.location')}</Text>
                    <View style={styles.locationBox}>
                        <TextInput
                            style={[styles.input, { backgroundColor: 'white', marginBottom: 15 }]}
                            placeholder="Landmark (Optional e.g. Near Westgate Mall)"
                            value={locationLandmark}
                            onChangeText={setLocationLandmark}
                        />

                        <TouchableOpacity
                            style={[styles.locationBtn, fetchingLocation && { opacity: 0.6 }]}
                            onPress={getCurrentLocation}
                            disabled={fetchingLocation}
                        >
                            <Ionicons name="location-outline" size={20} color="white" />
                            <Text style={styles.locationBtnText}>
                                {fetchingLocation ? t('marketplace.create.fetching') : (latitude ? t('marketplace.create.update_location') : t('marketplace.create.get_location'))}
                            </Text>
                        </TouchableOpacity>

                        {latitude && (
                            <View style={styles.locationInfo}>
                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                <Text style={styles.locationInfoText} numberOfLines={2}>
                                    {address || `Coords: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.publishContainer}>
                        <View>
                            <Text style={styles.publishLabel}>{t('marketplace.create.publish')}</Text>
                            <Text style={styles.publishSubtitle}>{t('marketplace.create.publish_subtitle')}</Text>
                        </View>
                        <Switch
                            value={isPublished}
                            onValueChange={setIsPublished}
                            trackColor={{ false: '#767577', true: COLORS.primary }}
                            thumbColor={isPublished ? COLORS.accent : '#f4f3f4'}
                        />
                    </View>

                    {/* Registration Form Builder Option - Only for Events */}
                    {category === 'events & programs' && (
                        <View style={styles.registrationBox}>
                            <View style={styles.registrationHeader}>
                                <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
                                <Text style={styles.registrationTitle}>Registration Form (Optional)</Text>
                            </View>
                            <Text style={styles.registrationSubtitle}>Curate custom questions for participants.</Text>
                            
                            {isEditing ? (
                                <TouchableOpacity 
                                    style={styles.registrationBtn}
                                    onPress={() => navigation.navigate('ServiceFormBuilder', { 
                                        serviceId: service.id, 
                                        serviceTitle: title 
                                    })}
                                >
                                    <Text style={styles.registrationBtnText}>Edit Registration Questions</Text>
                                    <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    style={[styles.registrationBtn, formFields.length > 0 && {backgroundColor: '#e6fffa', borderColor: '#38b2ac'}]}
                                    onPress={() => navigation.navigate('ServiceFormBuilder', { 
                                        serviceTitle: title,
                                        initialFields: formFields,
                                        onSaveFields: (fields) => setFormFields(fields)
                                    })}
                                >
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        {formFields.length > 0 && <Ionicons name="checkmark-circle" size={18} color="#38b2ac" style={{marginRight: 8}} />}
                                        <Text style={[styles.registrationBtnText, formFields.length > 0 && {color: '#38b2ac'}]}>
                                            {formFields.length > 0 ? `${formFields.length} Questions Curated` : "Curate Registration Form"}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={formFields.length > 0 ? '#38b2ac' : COLORS.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <Button
                        title={loading ? (isEditing ? t('common.updating') : t('common.creating')) : (isEditing ? t('marketplace.create.title_edit') : t('marketplace.create.title_new'))}
                        onPress={handleSubmit}
                        disabled={loading}
                        style={{ marginTop: 20 }}
                    />

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    container: { padding: SPACING.lg },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: COLORS.text },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        fontSize: 16
    },
    textArea: { height: 100, textAlignVertical: 'top' },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginBottom: 20,
        justifyContent: 'center',
    },
    typeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    typeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderWidth: 1,
        borderColor: COLORS.primary,
        borderRadius: 10,
        marginHorizontal: 5
    },
    activeTypeBtn: { backgroundColor: COLORS.primary },
    typeText: { marginLeft: 8, fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
    activeTypeText: { color: 'white' },
    imagePicker: {
        width: 150,
        height: 150,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center'
    },
    imageWrapper: { width: 150, height: 150, borderRadius: 12, overflow: 'hidden', marginRight: 10, borderWidth: 1, borderColor: '#eee' },
    galleryImage: { width: '100%', height: '100%' },
    removeImageBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 2 },
    imagePlaceholder: { alignItems: 'center' },
    imagePlaceholderText: { marginTop: 8, color: COLORS.primary, fontWeight: '600', fontSize: 12, textAlign: 'center' },
    feeBreakdown: { backgroundColor: '#f0f4ff', padding: 15, borderRadius: 10, marginTop: -15, marginBottom: 20, borderWidth: 1, borderColor: '#dce5ff' },
    feeText: { fontSize: 13, color: '#333', marginBottom: 4 },
    totalPriceText: { fontSize: 15, fontWeight: 'bold', color: COLORS.primary, marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#dce5ff' },
    publishContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 12,
        marginVertical: 20
    },
    publishLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    publishSubtitle: { fontSize: 12, color: COLORS.textSecondary },
    locationBox: {
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        borderColor: '#eee',
        marginBottom: 20
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        padding: 12,
        borderRadius: 8,
    },
    locationBtnText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 8
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    locationInfoText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginLeft: 6,
        flex: 1
    },
    registrationBox: {
        backgroundColor: '#f0f4ff',
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        borderColor: '#dce5ff',
        marginTop: 10,
        marginBottom: 20
    },
    registrationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    registrationTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text,
        marginLeft: 10
    },
    registrationSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginBottom: 15,
        lineHeight: 18
    },
    registrationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.primary
    },
    registrationBtnText: {
        color: COLORS.primary,
        fontWeight: 'bold'
    },
    registrationNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 10,
        borderRadius: 8
    },
    registrationNoteText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginLeft: 8,
        fontStyle: 'italic'
    }
});

export default CreateServiceScreen;
