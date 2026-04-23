import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const COUNTRY_CODES = [
    { label: "Kenya (+254)", value: "+254" },
    { label: "Uganda (+256)", value: "+256" },
    { label: "Tanzania (+255)", value: "+255" },
    { label: "Rwanda (+250)", value: "+250" },
    { label: "USA (+1)", value: "+1" },
    { label: "UK (+44)", value: "+44" },
    { label: "India (+91)", value: "+91" },
    { label: "China (+86)", value: "+86" },
    { label: "Nigeria (+234)", value: "+234" },
    { label: "South Africa (+27)", value: "+27" }
];

const LANGUAGES = [
    { label: "English", value: "en" },
    { label: "Kiswahili", value: "sw" },
    { label: "Español", value: "es" },
    { label: "Français", value: "fr" },
    { label: "Deutsch", value: "de" },
    { label: "Português", value: "pt" },
    { label: "العربية", value: "ar" },
    { label: "中文", value: "zh" },
    { label: "हिन्दी", value: "hi" },
    { label: "日本語", value: "ja" }
];

export const ProfileScreen = ({ navigation }) => {
    const { t, i18n } = useTranslation();
    const { userInfo, logout, updateUser } = useContext(AuthContext);
    const [dogs, setDogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Edit State (initialized from userInfo)
    const [editName, setEditName] = useState(userInfo?.full_name || '');
    const [editPhone, setEditPhone] = useState(userInfo?.phone_number || '');
    const [editBio, setEditBio] = useState(userInfo?.bio || '');
    const [editCountryCode, setEditCountryCode] = useState(userInfo?.country || '+254');
    const [editLanguage, setEditLanguage] = useState(userInfo?.language || 'en');
    const [editAvatar, setEditAvatar] = useState(userInfo?.profile_image || null);

    // Payment States
    const [isPaymentEditing, setIsPaymentEditing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(userInfo?.payment_method || '');
    const [paymentDetails, setPaymentDetails] = useState(userInfo?.payment_details || '');

    // Reset local state when userInfo changes (from backend sync)
    useEffect(() => {
        if (!isEditing && !isPaymentEditing) {
            setEditName(userInfo?.full_name || '');
            setEditPhone(userInfo?.phone_number || '');
            setEditBio(userInfo?.bio || '');
            setEditCountryCode(userInfo?.country || '+254');
            setEditLanguage(userInfo?.language || 'en');
            setEditAvatar(userInfo?.profile_image || null);
            setPaymentMethod(userInfo?.payment_method || '');
            setPaymentDetails(userInfo?.payment_details || '');
        }
    }, [userInfo, isEditing, isPaymentEditing]);

    // Check if any change has been made
    const isDirty = useMemo(() => {
        if (!userInfo) return false;
        return (
            editName !== (userInfo.full_name || '') ||
            editPhone !== (userInfo.phone_number || '') ||
            editBio !== (userInfo.bio || '') ||
            editCountryCode !== (userInfo.country || '+254') ||
            editLanguage !== (userInfo.language || 'en') ||
            editAvatar !== (userInfo.profile_image || null) ||
            paymentMethod !== (userInfo.payment_method || '') ||
            paymentDetails !== (userInfo.payment_details || '')
        );
    }, [editName, editPhone, editBio, editCountryCode, editLanguage, editAvatar, paymentMethod, paymentDetails, userInfo]);

    const fetchMyDogs = async () => {
        try {
            const res = await client.get('/my-dogs');
            setDogs(res.data);
        } catch (e) {
            if (__DEV__) console.log('Error fetching dogs', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchMyDogs();
        }, [])
    );

    const handlePickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setEditAvatar(result.assets[0].uri);
        }
    };

    const handleSaveGlobal = async () => {
        try {
            const payload = {
                full_name: editName,
                phone_number: editPhone,
                bio: editBio,
                country: editCountryCode,
                language: editLanguage,
                profile_image: editAvatar,
                payment_method: paymentMethod,
                payment_details: paymentDetails
            };
            await updateUser(payload);
            Alert.alert(t('common.success'), t('profile_screen.success_msg'));
        } catch (error) {
            Alert.alert(t('common.error'), t('profile_screen.error_msg'));
        }
    };

    const renderPetItem = ({ item }) => (
        <TouchableOpacity style={styles.petCard} onPress={() => navigation.navigate('WellnessHub')}>
            <Image source={item.body_image ? { uri: item.body_image } : require('../../assets/dog_placeholder.png')} style={styles.petCardImg} />
            <View style={styles.petCardInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.petCardName}>{item.name}</Text>
                    <View style={[styles.petTypeBadge, { backgroundColor: item.pet_type === 'cat' ? '#F3E5F5' : '#E8F5E9' }]}>
                        <Text style={{ fontSize: 12 }}>{item.pet_type === 'cat' ? '🐱' : '🐕'}</Text>
                        <Text style={[styles.petTypeBadgeText, { color: item.pet_type === 'cat' ? '#7B1FA2' : '#2E7D32' }]}>{item.pet_type === 'cat' ? 'Cat' : 'Dog'}</Text>
                    </View>
                </View>
                <Text style={styles.petCardBreed}>{item.breed || 'Unknown breed'}</Text>
                {item.age ? <Text style={styles.petCardAge}>{item.age} years old</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Account Dashboard</Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                    <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
                    <Text style={styles.logoutText}>{t('profile_screen.log_out')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Visual Identity Section */}
                <View style={styles.brandingBanner}>
                   <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryDark]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.glowOverlay} />
                </View>

                <View style={styles.profileCard}>
                    <LinearGradient
                        colors={[COLORS.primaryDark, '#1A0033']}
                        style={styles.cardHeader}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAvatar}>
                            {editAvatar ? (
                                <Image source={{ uri: editAvatar }} style={styles.avatarImage} />
                            ) : (
                                <View style={styles.placeholderAvatar}>
                                    <Ionicons name="person" size={40} color={COLORS.gray} />
                                </View>
                            )}
                            <View style={styles.cameraBadge}>
                                <Ionicons name="camera" size={14} color={COLORS.primary} />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.headerInfo}>
                            <View style={styles.nameRow}>
                                <Text style={styles.userName}>{editName || userInfo?.full_name}</Text>
                                <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} style={{ marginLeft: 6 }} />
                            </View>
                            <Text style={styles.userEmail}>{userInfo?.email}</Text>
                        </View>
                    </LinearGradient>

                    <View style={styles.statsContainer}>
                        <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('DogIdentity')}>
                            <Text style={styles.statNumber}>{userInfo?.dogs?.length || 0}</Text>
                            <Text style={styles.statLabel}>{t('profile_screen.dogs_stat')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('Events')}>
                            <Text style={styles.statNumber}>{userInfo?.activities?.length || 0}</Text>
                            <Text style={styles.statLabel}>{t('profile_screen.activities_stat')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('Marketplace')}>
                            <Text style={styles.statNumber}>{userInfo?.transactions?.length || 0}</Text>
                            <Text style={styles.statLabel}>{t('profile_screen.deals_stat')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.infoGrid}>
                    {/* User Reputation Title Removed */}

                    <View style={styles.ratingCard}>
                        <View style={styles.ratingInfo}>
                            <View>
                                <Text style={styles.ratingNumber}>{(userInfo?.average_rating || 0).toFixed(1)} / 5.0</Text>
                                <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Ionicons 
                                            key={s} 
                                            name={s <= (userInfo?.average_rating || 0) ? "star" : "star-outline"} 
                                            size={16} 
                                            color={COLORS.accent} 
                                        />
                                    ))}
                                </View>
                            </View>
                            <TouchableOpacity style={styles.rateAction}>
                                <Text style={styles.rateActionText}>{t('profile_screen.rate_experience')}</Text>
                                <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.ratingSubtitle}>{t('profile_screen.based_on', { count: userInfo?.total_ratings || 0 })}</Text>
                    </View>

                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.dashboardSectionTitle}>{t('profile_screen.my_pets')}</Text>
                    </View>

                    {dogs.length > 0 ? (
                        <View>
                            {dogs.map(pet => (
                                <View key={pet.id}>{renderPetItem({ item: pet })}</View>
                            ))}
                            <TouchableOpacity 
                                style={styles.addPetBtn}
                                onPress={() => navigation.navigate('DogRegistration')}
                            >
                                <Ionicons name="add-circle" size={22} color={COLORS.primary} />
                                <Text style={styles.addPetBtnText}>{t('profile_screen.register_another')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.emptyCard} onPress={() => navigation.navigate('WellnessHub')}>
                            <Ionicons name="add-circle" size={44} color={COLORS.accent} />
                            <Text style={[styles.emptyText, { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 16 }]}>{t('profile_screen.register_pet')}</Text>
                            <Text style={{ color: COLORS.gray, fontSize: 12, textAlign: 'center', marginTop: 6 }}>{t('profile_screen.register_pet_desc')}</Text>
                        </TouchableOpacity>
                    )}

                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.dashboardSectionTitle}>{t('profile_screen.personal_info')}</Text>
                        <TouchableOpacity style={styles.editAction} onPress={() => setIsEditing(true)}>
                            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                            <Text style={styles.editText}>{t('profile_screen.update')}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="call" size={18} color={COLORS.accent} />
                            </View>
                            <View style={styles.infoTextGroup}>
                                <Text style={styles.infoLabel}>{t('profile_screen.whatsapp_phone')}</Text>
                                <Text style={styles.infoValue}>{userInfo?.country} {userInfo?.phone_number}</Text>
                            </View>
                        </View>
                        <View style={styles.infoRow}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="book" size={18} color={COLORS.accent} />
                            </View>
                            <View style={styles.infoTextGroup}>
                                <Text style={styles.infoLabel}>{t('profile_screen.biography')}</Text>
                                <Text style={styles.infoValue} numberOfLines={2}>{userInfo?.bio || t('profile_screen.no_bio')}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.dashboardSectionTitle}>{t('profile_screen.digital_wallet')}</Text>
                    </View>

                    <LinearGradient
                        colors={['#1A0033', COLORS.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.paymentCard}
                    >
                        <View style={styles.walletHeader}>
                            <Text style={styles.walletLabel}>{t('profile_screen.available_balance')}</Text>
                            <Ionicons name="wallet" size={24} color={COLORS.accent} />
                        </View>
                        <Text style={styles.walletBalance}>{userInfo?.currency || 'KES'} 0.00</Text>
                        
                        <View style={styles.walletFooter}>
                            <View>
                                <Text style={styles.payoutMethodLabel}>{t('profile_screen.active_payout')}</Text>
                                <Text style={styles.payoutMethodValue}>
                                    {paymentMethod ? `${paymentMethod.toUpperCase()} • ${paymentDetails ? paymentDetails : t('profile_screen.configured')}` : t('profile_screen.not_configured')}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.configureBtn} onPress={() => setIsPaymentEditing(true)}>
                                <Text style={styles.configureBtnText}>{paymentMethod ? t('profile_screen.edit') : t('profile_screen.setup')}</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.dashboardSectionTitle}>{t('profile_screen.help_support')}</Text>
                    </View>
                    <TouchableOpacity 
                        style={[styles.infoCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                        onPress={() => navigation.navigate('Support')}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.iconCircle, { backgroundColor: '#F0F4F8' }]}>
                                <Ionicons name="help-buoy" size={20} color={COLORS.primary} />
                            </View>
                            <Text style={[styles.infoLabel, { fontSize: 16, color: COLORS.primary, fontWeight: 'bold' }]}>{t('profile_screen.contact_support')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>

                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.dashboardSectionTitle}>{t('profile_screen.language')}</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <LanguageSwitcher />
                    </View>

                </View>
            </ScrollView>

            {/* Dirty Save Footer */}
            {isDirty && (
                <View style={styles.dirtyFooter}>
                    <TouchableOpacity style={styles.discardBtn} onPress={() => {
                        setEditName(userInfo.full_name);
                        setEditPhone(userInfo.phone_number);
                        setEditBio(userInfo.bio);
                        setEditCountryCode(userInfo.country);
                        setEditLanguage(userInfo.language);
                        setEditAvatar(userInfo.profile_image);
                        setPaymentMethod(userInfo.payment_method);
                        setPaymentDetails(userInfo.payment_details);
                    }}>
                        <Text style={styles.discardText}>{t('profile_screen.discard')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.globalSaveBtn} onPress={handleSaveGlobal}>
                        <LinearGradient
                            colors={[COLORS.accent, COLORS.accentDark]}
                            style={styles.gradientBtn}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Ionicons name="save" size={20} color={COLORS.primaryDark} />
                            <Text style={styles.globalSaveText}>{t('profile_screen.save_updates')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {/* Edit Modal */}
            <Modal visible={isEditing} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={[styles.modalHeader, { position: 'relative', justifyContent: 'center' }]}>
                                    <TouchableOpacity 
                                        onPress={() => setIsEditing(false)} 
                                        style={{ position: 'absolute', left: 0, zIndex: 10, padding: 5 }}
                                    >
                                        <Ionicons name="arrow-back" size={24} color={COLORS.primaryDark} />
                                    </TouchableOpacity>
                                    <Text style={[styles.modalTitle, { textAlign: 'center' }]}>{t('profile_screen.update_profile')}</Text>
                                </View>

                                <Text style={styles.label}>{t('profile_screen.full_name')}</Text>
                                <TextInput style={styles.input} value={editName} onChangeText={setEditName} />

                                <View style={styles.row}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.label}>{t('profile_screen.region')}</Text>
                                        <View style={styles.pickerContainer}>
                                            <Picker selectedValue={editCountryCode} onValueChange={setEditCountryCode} style={styles.picker}>
                                                {COUNTRY_CODES.map(c => <Picker.Item key={c.value} label={c.label} value={c.value} />)}
                                            </Picker>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1.5 }}>
                                        <Text style={styles.label}>{t('profile_screen.whatsapp_phone')}</Text>
                                        <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
                                    </View>
                                </View>

                                <Text style={styles.label}>{t('profile_screen.preferred_language')}</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={editLanguage} onValueChange={(val) => { setEditLanguage(val); i18n.changeLanguage(val); }} style={styles.picker}>
                                        {LANGUAGES.map(l => <Picker.Item key={l.value} label={l.label} value={l.value} />)}
                                    </Picker>
                                </View>

                                <Text style={styles.label}>{t('profile_screen.professional_bio')}</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={editBio}
                                    onChangeText={setEditBio}
                                    multiline
                                    numberOfLines={3}
                                    placeholder={t('profile_screen.tell_us')}
                                />

                                <View style={styles.modalButtons}>
                                    <TouchableOpacity onPress={() => setIsEditing(false)} style={[styles.saveBtn, { flex: 1, backgroundColor: '#f0f0f0', elevation: 0 }]}>
                                        <Text style={[styles.btnText, { color: COLORS.gray }]}>{t('profile_screen.back')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setIsEditing(false)} style={[styles.saveBtn, { flex: 2, backgroundColor: COLORS.accent }]}>
                                        <Text style={[styles.btnText, { color: COLORS.primaryDark }]}>Apply Changes</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Payout Modal */}
            <Modal visible={isPaymentEditing} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalHeader, { position: 'relative', justifyContent: 'center' }]}>
                            <TouchableOpacity 
                                onPress={() => setIsPaymentEditing(false)} 
                                style={{ position: 'absolute', left: 0, zIndex: 10, padding: 5 }}
                            >
                                <Ionicons name="arrow-back" size={24} color={COLORS.primaryDark} />
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>{t('profile_screen.payout_config')}</Text>
                        </View>
                        
                        <View style={styles.paymentOptionsGrid}>
                            {[
                                { id: 'mpesa', label: 'M-Pesa', icon: 'phone-portrait-outline' },
                                { id: 'visa', label: 'Visa Card', icon: 'card-outline' },
                                { id: 'mastercard', label: 'Mastercard', icon: 'card-outline' }
                            ].map((opt) => (
                                <TouchableOpacity 
                                    key={opt.id}
                                    style={[styles.payOptItem, paymentMethod === opt.id && styles.payOptActive]}
                                    onPress={() => setPaymentMethod(opt.id)}
                                >
                                    <Ionicons name={opt.icon} size={24} color={paymentMethod === opt.id ? COLORS.white : COLORS.primary} />
                                    <Text style={[styles.payOptLabel, paymentMethod === opt.id && styles.payOptActiveLabel]}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {paymentMethod === 'mpesa' ? (
                            <>
                                <Text style={styles.label}>{t('profile_screen.mpesa_phone')}</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="e.g. +254..."
                                    keyboardType="phone-pad"
                                    value={paymentDetails || ''}
                                    onChangeText={setPaymentDetails}
                                />
                            </>
                        ) : paymentMethod === 'visa' || paymentMethod === 'mastercard' ? (
                            <>
                                <Text style={styles.label}>{t('profile_screen.card_number')}</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="0000 0000 0000 0000"
                                    keyboardType="number-pad"
                                    maxLength={19}
                                    value={(paymentDetails || '').split('|')[0] || ''}
                                    onChangeText={(val) => {
                                        const parts = (paymentDetails || '').split('|');
                                        setPaymentDetails(`${val}|${parts[1] || ''}|${parts[2] || ''}`);
                                    }}
                                />
                                <View style={styles.row}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.label}>{t('profile_screen.expiry')}</Text>
                                        <TextInput style={styles.input} placeholder="MM/YY" maxLength={5} 
                                            value={(paymentDetails || '').split('|')[1] || ''}
                                            onChangeText={(val) => {
                                                const parts = (paymentDetails || '').split('|');
                                                setPaymentDetails(`${parts[0] || ''}|${val}|${parts[2] || ''}`);
                                            }}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>{t('profile_screen.secure_cvv')}</Text>
                                        <TextInput style={styles.input} placeholder="***" maxLength={4} keyboardType="number-pad" secureTextEntry={true} 
                                            value={(paymentDetails || '').split('|')[2] || ''}
                                            onChangeText={(val) => {
                                                const parts = (paymentDetails || '').split('|');
                                                setPaymentDetails(`${parts[0] || ''}|${parts[1] || ''}|${val}`);
                                            }}
                                        />
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                                    <Ionicons name="lock-closed" size={14} color="#2E7D32" />
                                    <Text style={{fontSize: 12, color: '#2E7D32', marginLeft: 4, fontWeight: 'bold'}}>{t('profile_screen.pci_compliant')}</Text>
                                </View>
                            </>
                        ) : null}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setIsPaymentEditing(false)} style={[styles.saveBtn, { flex: 1, backgroundColor: '#f0f0f0', elevation: 0 }]}>
                                <Text style={[styles.btnText, { color: COLORS.gray }]}>{t('profile_screen.back')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsPaymentEditing(false)} style={[styles.saveBtn, { flex: 2, backgroundColor: COLORS.accent }]}>
                                <Text style={[styles.btnText, { color: COLORS.primaryDark }]}>{t('profile_screen.apply_payout')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fcfcfc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: COLORS.white, zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    title: { fontSize: 22, fontWeight: 'bold', color: COLORS.primaryDark, letterSpacing: -0.5 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff1f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    logoutText: { marginLeft: 5, color: COLORS.error, fontWeight: 'bold', fontSize: 13 },
    scrollContent: { paddingBottom: 100 },
    brandingBanner: { height: 140, width: '100%', position: 'absolute', top: 0 },
    glowOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,215,0,0.05)' },
    profileCard: { backgroundColor: COLORS.white, marginHorizontal: 15, marginTop: 40, borderRadius: 25, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 15, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
    cardHeader: { padding: 25, flexDirection: 'row', alignItems: 'center' },
    avatarContainer: { position: 'relative' },
    avatarImage: { width: 95, height: 95, borderRadius: 47.5, borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)' },
    placeholderAvatar: { width: 95, height: 95, borderRadius: 47.5, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },
    cameraBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: COLORS.accent, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white, elevation: 4 },
    headerInfo: { marginLeft: 20, flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    userName: { fontSize: 24, fontWeight: 'bold', color: COLORS.white },
    userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
    statsContainer: { flexDirection: 'row', padding: 20, backgroundColor: '#fff' },
    statBox: { flex: 1, alignItems: 'center' },
    middleStat: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#f0f0f0' },
    statValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.accentDark },
    statLine: { fontSize: 12, color: COLORS.gray, marginTop: 4, fontWeight: '600', textTransform: 'uppercase' },
    infoGrid: { paddingHorizontal: 15, paddingBottom: 30 },
    sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
    dashboardSectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primaryDark },
    titleUnderline: { position: 'absolute', bottom: -4, left: 0, width: 40, height: 3, backgroundColor: COLORS.accent, borderRadius: 2 },
    editAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent + '20', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15 },
    editText: { marginLeft: 6, color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 13 },
    infoCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accent + '15', justifyContent: 'center', alignItems: 'center' },
    infoTextGroup: { marginLeft: 15, flex: 1 },
    infoLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase' },
    infoValue: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginTop: 2 },
    paymentCard: { backgroundColor: COLORS.primaryDark, borderRadius: 20, padding: 25, elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 15, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
    walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    walletLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 'bold' },
    walletBalance: { fontSize: 36, fontWeight: 'bold', color: COLORS.white, marginVertical: 15 },
    walletFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
    payoutMethodLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 },
    payoutMethodValue: { color: COLORS.white, fontSize: 14, fontWeight: 'bold' },
    configureBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    configureBtnText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 13 },
    ratingCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 25, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, borderWidth: 1, borderColor: '#f0f0f0' },
    ratingInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    ratingNumber: { fontSize: 26, fontWeight: 'bold', color: COLORS.primaryDark },
    starsRow: { flexDirection: 'row', marginTop: 4 },
    rateAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, elevation: 4 },
    rateActionText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 14, marginRight: 5 },
    ratingSubtitle: { fontSize: 12, color: COLORS.gray, marginTop: 12, fontStyle: 'italic' },
    miniDogCard: { width: 120, marginRight: 15, alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, padding: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    miniDogImg: { width: 95, height: 95, borderRadius: 18, backgroundColor: '#eee' },
    miniDogName: { marginTop: 10, fontWeight: 'bold', color: COLORS.primaryDark, fontSize: 14 },
    miniAddBtn: { backgroundColor: COLORS.accent, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 6, position: 'absolute', right: -5, bottom: 20 },
    emptyCard: { width: width - 80, backgroundColor: '#f8f9fa', borderRadius: 20, padding: 30, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#ddd' },
    emptyText: { color: COLORS.gray, marginTop: 12, fontSize: 14, fontStyle: 'italic', fontWeight: '500' },
    dogsScrollRow: { position: 'relative', paddingRight: 30 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25, maxHeight: '92%' },
    modalHeader: { alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.primaryDark },
    modalSubtitle: { fontSize: 14, color: COLORS.gray, marginTop: 6, fontWeight: '600' },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.primaryDark, marginBottom: 8, marginTop: 15, textTransform: 'uppercase' },
    input: { backgroundColor: '#f9f9f9', borderRadius: 15, padding: 16, fontSize: 16, borderWidth: 1, borderColor: '#eee', color: COLORS.text },
    row: { flexDirection: 'row' },
    pickerContainer: { backgroundColor: '#f9f9f9', borderRadius: 15, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
    picker: { height: 55, color: COLORS.text },
    textArea: { height: 110, textAlignVertical: 'top' },
    modalButtons: { flexDirection: 'row', marginTop: 35, gap: 15, paddingBottom: 20 },
    saveBtn: { flex: 2, padding: 18, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    btnText: { fontWeight: 'bold', fontSize: 17 },
    dirtyFooter: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: COLORS.primaryDark, borderRadius: 30, padding: 12, flexDirection: 'row', alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
    discardBtn: { paddingHorizontal: 25 },
    discardText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
    globalSaveBtn: { flex: 1, borderRadius: 22, overflow: 'hidden' },
    gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 },
    globalSaveText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 15 },
    paymentOptionsGrid: { flexDirection: 'row', gap: 12, marginBottom: 25 },
    payOptItem: { flex: 1, padding: 18, borderRadius: 20, backgroundColor: '#f8f9fa', alignItems: 'center', borderWidth: 1.5, borderColor: '#eee' },
    payOptActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    payOptLabel: { fontSize: 13, fontWeight: 'bold', color: COLORS.primaryDark, marginTop: 8 },
    payOptActiveLabel: { color: COLORS.primaryDark },
    // Pet card styles
    petCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, borderWidth: 1, borderColor: '#f0f0f0' },
    petCardImg: { width: 65, height: 65, borderRadius: 14, backgroundColor: '#eee' },
    petCardInfo: { flex: 1, marginLeft: 14 },
    petCardName: { fontSize: 17, fontWeight: 'bold', color: COLORS.primaryDark },
    petCardBreed: { fontSize: 13, color: COLORS.gray, marginTop: 3 },
    petCardAge: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
    petTypeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 3 },
    petTypeBadgeText: { fontSize: 11, fontWeight: 'bold' },
    addPetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed', backgroundColor: COLORS.primary + '08', marginTop: 4, marginBottom: 10 },
    addPetBtnText: { fontSize: 15, fontWeight: 'bold', color: COLORS.primary },
});

export default ProfileScreen;
