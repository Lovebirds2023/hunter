import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
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
import { setAppLanguage } from '../i18n';
import {
    COUNTRY_CODES,
    CUSTOM_COUNTRY_CODE,
    formatCountryCode,
    getCountryCodeSelection,
    isValidCountryCode,
} from '../constants/countryCodes';
import { PRIVACY_POLICY_URL } from '../constants/legal';

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

const toRatingNumber = (value) => {
    const rating = Number(value);
    return Number.isFinite(rating) ? rating : 0;
};

export const ProfileScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { userInfo, logout, updateUser, deleteAccount } = useContext(AuthContext);
    const initialCountryCode = userInfo?.country || '+254';
    const initialCountryCodeSelection = getCountryCodeSelection(initialCountryCode);
    const [dogs, setDogs] = useState([]);
    const [dashboardStats, setDashboardStats] = useState({ dogs: null, activities: null, deals: null });
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    // Edit State (initialized from userInfo)
    const [editName, setEditName] = useState(userInfo?.full_name || '');
    const [editPhone, setEditPhone] = useState(userInfo?.phone_number || '');
    const [editBio, setEditBio] = useState(userInfo?.bio || '');
    const [editCountryCode, setEditCountryCode] = useState(initialCountryCode);
    const [editCountryCodeSelection, setEditCountryCodeSelection] = useState(initialCountryCodeSelection);
    const [customEditCountryCode, setCustomEditCountryCode] = useState(
        initialCountryCodeSelection === CUSTOM_COUNTRY_CODE ? initialCountryCode : ''
    );
    const [editLanguage, setEditLanguage] = useState(userInfo?.language || 'en');
    const [editAvatar, setEditAvatar] = useState(userInfo?.profile_image || null);

    // Payment States
    const [isPaymentEditing, setIsPaymentEditing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(userInfo?.payment_method || '');
    // Cards are processed via Pesapal's secure hosted checkout — we never store card numbers or CVV.
    const [mpesaPhone, setMpesaPhone] = useState(userInfo?.mpesa_phone_number || '');
    const [walletSummary, setWalletSummary] = useState({ currency: 'KES', available: 0, pending_withdrawal: 0 });
    const averageRating = toRatingNumber(userInfo?.average_rating);

    // Reset local state when userInfo changes (from backend sync)
    useEffect(() => {
        if (!isEditing && !isPaymentEditing) {
            setEditName(userInfo?.full_name || '');
            setEditPhone(userInfo?.phone_number || '');
            setEditBio(userInfo?.bio || '');
            const nextCountryCode = userInfo?.country || '+254';
            const nextCountryCodeSelection = getCountryCodeSelection(nextCountryCode);
            setEditCountryCode(nextCountryCode);
            setEditCountryCodeSelection(nextCountryCodeSelection);
            setCustomEditCountryCode(nextCountryCodeSelection === CUSTOM_COUNTRY_CODE ? nextCountryCode : '');
            setEditLanguage(userInfo?.language || 'en');
            setEditAvatar(userInfo?.profile_image || null);
            setPaymentMethod(userInfo?.payment_method || '');
            setMpesaPhone(userInfo?.mpesa_phone_number || '');
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
            mpesaPhone !== (userInfo.mpesa_phone_number || '')
        );
    }, [editName, editPhone, editBio, editCountryCode, editLanguage, editAvatar, paymentMethod, mpesaPhone, userInfo]);

    const fetchMyDogs = async () => {
        try {
            const res = await client.get('/my-dogs');
            const dogList = Array.isArray(res.data) ? res.data : [];
            setDogs(dogList);
            setDashboardStats(prev => ({ ...prev, dogs: dogList.length }));
        } catch (e) {
            if (__DEV__) console.log('Error fetching dogs', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchDashboardStats = async () => {
        const [registrationsRes, ordersRes, earningsRes] = await Promise.allSettled([
            client.get('/my-registrations'),
            client.get('/my-orders'),
            client.get('/my-earnings'),
        ]);

        const registrations = registrationsRes.status === 'fulfilled' && Array.isArray(registrationsRes.value.data)
            ? registrationsRes.value.data
            : [];
        const orders = ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value.data)
            ? ordersRes.value.data
            : [];
        const earnings = earningsRes.status === 'fulfilled' && Array.isArray(earningsRes.value.data?.earnings)
            ? earningsRes.value.data.earnings
            : [];

        const dealIds = new Set([
            ...orders.map(order => order.id).filter(Boolean),
            ...earnings.map(earning => earning.id).filter(Boolean),
        ]);

        setDashboardStats(prev => ({
            ...prev,
            activities: registrations.length,
            deals: dealIds.size,
        }));
    };

    const fetchWalletSummary = async () => {
        try {
            const res = await client.get('/wallet/summary');
            setWalletSummary(res.data);
        } catch (e) {
            if (__DEV__) console.log('Error fetching wallet summary', e);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchMyDogs();
            fetchWalletSummary();
            fetchDashboardStats();
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

    const handleEditCountryCodeSelection = (itemValue) => {
        setEditCountryCodeSelection(itemValue);
        setEditCountryCode(itemValue === CUSTOM_COUNTRY_CODE ? customEditCountryCode : itemValue);
    };

    const handleCustomEditCountryCodeChange = (value) => {
        const formattedCode = formatCountryCode(value);
        setCustomEditCountryCode(formattedCode);
        setEditCountryCode(formattedCode);
    };

    const handleSaveGlobal = async () => {
        try {
            if (!isValidCountryCode(editCountryCode)) {
                Alert.alert(
                    t('common.error'),
                    t('profile_screen.valid_country_code', { defaultValue: 'Please enter a valid country code, e.g. +254.' })
                );
                return;
            }

            const payload = {
                full_name: editName,
                phone_number: editPhone,
                bio: editBio,
                country: editCountryCode,
                language: editLanguage,
                profile_image: editAvatar,
                payment_method: paymentMethod || null,
                // Only store payout preference and M-Pesa phone (never card numbers/CVV)
                mpesa_phone_number: paymentMethod === 'mpesa' ? mpesaPhone : (userInfo?.mpesa_phone_number || null),
            };
            const saved = await updateUser(payload, { silent: true });
            if (!saved) {
                throw new Error('Profile update failed');
            }
            setIsEditing(false);
            setIsPaymentEditing(false);
            fetchWalletSummary();
            Alert.alert(t('common.success'), t('profile_screen.success_msg'));
        } catch (error) {
            Alert.alert(t('common.error'), t('profile_screen.error_msg'));
        }
    };

    const handleLanguageChange = async (language) => {
        setEditLanguage(language);
        await setAppLanguage(language);
        await updateUser({ language }, { silent: true });
    };

    const openPrivacyPolicy = () => {
        Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
            Alert.alert('Privacy Policy', PRIVACY_POLICY_URL);
        });
    };

    const confirmDeleteAccount = async () => {
        if (isDeletingAccount) return;
        setIsDeletingAccount(true);
        const result = await deleteAccount();

        if (result.success) {
            Alert.alert(t('profile_screen.account_deleted_title'), t('profile_screen.account_deleted_msg'));
            return;
        }

        setIsDeletingAccount(false);
        Alert.alert(t('common.error'), result.message || t('profile_screen.delete_account_error'));
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            t('profile_screen.delete_account_title'),
            t('profile_screen.delete_account_warning'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('profile_screen.delete_account_continue'),
                    style: 'destructive',
                    onPress: () => Alert.alert(
                        t('profile_screen.delete_account_final_title'),
                        t('profile_screen.delete_account_final_warning'),
                        [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                                text: t('profile_screen.delete_account_confirm'),
                                style: 'destructive',
                                onPress: confirmDeleteAccount,
                            },
                        ],
                    ),
                },
            ],
        );
    };

    const renderPetItem = ({ item }) => (
        <TouchableOpacity style={styles.petCard} onPress={() => navigation.navigate('WellnessHub')}>
            <Image source={item.body_image ? { uri: item.body_image } : require('../../assets/dog_placeholder.png')} style={styles.petCardImg} />
            <View style={styles.petCardInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.petCardName}>{item.name}</Text>
                    <View style={[styles.petTypeBadge, { backgroundColor: item.pet_type === 'cat' ? '#F3E5F5' : '#E8F5E9' }]}>
                        <Text style={{ fontSize: 12 }}>{item.pet_type === 'cat' ? '🐱' : '🐕'}</Text>
                        <Text style={[styles.petTypeBadgeText, { color: item.pet_type === 'cat' ? '#7B1FA2' : '#2E7D32' }]}>{item.pet_type === 'cat' ? t('dog_identity.cat') : t('dog_identity.dog')}</Text>
                    </View>
                </View>
                <Text style={styles.petCardBreed}>{item.breed || t('health_passport.unknown_breed')}</Text>
                {item.age ? <Text style={styles.petCardAge}>{t('profile_screen.years_old', { count: item.age })}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
        </TouchableOpacity>
    );

    const statValue = (value) => value === null || value === undefined ? '...' : value;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('profile_screen.account_dashboard')}</Text>
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
                            <Text style={styles.statNumber}>{statValue(dashboardStats.dogs)}</Text>
                            <Text style={styles.statLabel}>{t('profile_screen.dogs_stat')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('Events', { screen: 'MyRegistrations' })}>
                            <Text style={styles.statNumber}>{statValue(dashboardStats.activities)}</Text>
                            <Text style={styles.statLabel}>{t('profile_screen.activities_stat')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('Payouts')}>
                            <Text style={styles.statNumber}>{statValue(dashboardStats.deals)}</Text>
                            <Text style={styles.statLabel}>{t('profile_screen.deals_stat')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.infoGrid}>
                    {/* User Reputation Title Removed */}

                    <View style={styles.ratingCard}>
                        <View style={styles.ratingInfo}>
                            <View style={styles.walletMethodInfo}>
                                <Text style={styles.ratingNumber}>{averageRating.toFixed(1)} / 5.0</Text>
                                <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Ionicons 
                                            key={s} 
                                            name={s <= averageRating ? "star" : "star-outline"}
                                            size={16} 
                                            color={COLORS.accent} 
                                        />
                                    ))}
                                </View>
                            </View>
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
                        <Text style={styles.walletBalance}>
                            {walletSummary?.currency || userInfo?.preferred_currency || 'KES'} {(walletSummary?.available || 0).toLocaleString()}
                        </Text>
                        {(walletSummary?.pending_withdrawal || 0) > 0 && (
                            <Text style={styles.walletPendingText}>
                                {t('payouts.pending_withdrawal', {
                                    defaultValue: 'Payout request pending: KES {{amount}}',
                                    amount: (walletSummary.pending_withdrawal || 0).toLocaleString()
                                })}
                            </Text>
                        )}
                        
                        <View style={styles.walletFooter}>
                            <View>
                                <Text style={styles.payoutMethodLabel}>{t('profile_screen.active_payout')}</Text>
                                <Text style={styles.payoutMethodValue}>
                                    {paymentMethod === 'mpesa' && mpesaPhone
                                        ? `M-PESA • ${mpesaPhone}`
                                        : paymentMethod === 'card'
                                        ? t('profile_screen.card_paid_pesapal')
                                        : t('profile_screen.not_configured')}
                                </Text>
                            </View>
                            <View style={styles.walletActions}>
                                <TouchableOpacity style={styles.withdrawProfileBtn} onPress={() => navigation.navigate('Payouts')}>
                                    <Ionicons name="cash-outline" size={15} color={COLORS.primaryDark} />
                                    <Text style={styles.withdrawProfileBtnText}>
                                        {t('payouts.withdraw', { defaultValue: 'Request payout' })}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.configureBtn} onPress={() => setIsPaymentEditing(true)}>
                                    <Text style={styles.configureBtnText}>{paymentMethod ? t('profile_screen.edit') : t('profile_screen.setup')}</Text>
                                </TouchableOpacity>
                            </View>
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
                        <LanguageSwitcher
                            selectedLanguage={editLanguage}
                            onLanguageChange={handleLanguageChange}
                        />
                    </View>

                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.dashboardSectionTitle}>{t('profile_screen.account_settings')}</Text>
                    </View>
                    <TouchableOpacity style={styles.legalCard} onPress={openPrivacyPolicy}>
                        <View style={styles.legalIconCircle}>
                            <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.primary} />
                        </View>
                        <View style={styles.legalTextGroup}>
                            <Text style={styles.legalTitle}>Privacy Policy</Text>
                            <Text style={styles.legalDescription}>How Lovedogs 360 handles user, pet, location, payment, and device data.</Text>
                        </View>
                        <Ionicons name="open-outline" size={20} color={COLORS.gray} />
                    </TouchableOpacity>
                    <View style={styles.dangerCard}>
                        <View style={styles.dangerIconCircle}>
                            <Ionicons name="warning-outline" size={22} color={COLORS.error} />
                        </View>
                        <View style={styles.dangerTextGroup}>
                            <Text style={styles.dangerTitle}>{t('profile_screen.delete_account')}</Text>
                            <Text style={styles.dangerDescription}>{t('profile_screen.delete_account_desc')}</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.deleteAccountBtn, isDeletingAccount && styles.disabledAction]}
                            onPress={handleDeleteAccount}
                            disabled={isDeletingAccount}
                        >
                            <Text style={styles.deleteAccountText}>
                                {isDeletingAccount ? t('profile_screen.deleting_account') : t('profile_screen.delete_account')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </ScrollView>

            {/* Dirty Save Footer */}
            {isDirty && (
                <View style={styles.dirtyFooter}>
                    <TouchableOpacity style={styles.discardBtn} onPress={() => {
                        const nextCountryCode = userInfo.country || '+254';
                        const nextCountryCodeSelection = getCountryCodeSelection(nextCountryCode);
                        setEditName(userInfo.full_name);
                        setEditPhone(userInfo.phone_number);
                        setEditBio(userInfo.bio);
                        setEditCountryCode(nextCountryCode);
                        setEditCountryCodeSelection(nextCountryCodeSelection);
                        setCustomEditCountryCode(nextCountryCodeSelection === CUSTOM_COUNTRY_CODE ? nextCountryCode : '');
                        setEditLanguage(userInfo.language);
                        setEditAvatar(userInfo.profile_image);
                        setPaymentMethod(userInfo.payment_method || '');
                        setMpesaPhone(userInfo.mpesa_phone_number || '');
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
                                            <Picker selectedValue={editCountryCodeSelection} onValueChange={handleEditCountryCodeSelection} style={styles.picker}>
                                                {COUNTRY_CODES.map(c => <Picker.Item key={c.value} label={c.label} value={c.value} />)}
                                                <Picker.Item label={t('common.other')} value={CUSTOM_COUNTRY_CODE} />
                                            </Picker>
                                        </View>
                                        {editCountryCodeSelection === CUSTOM_COUNTRY_CODE && (
                                            <TextInput
                                                style={[styles.input, styles.customCountryCodeInput]}
                                                value={customEditCountryCode}
                                                onChangeText={handleCustomEditCountryCodeChange}
                                                keyboardType="phone-pad"
                                                placeholder="e.g. +254"
                                            />
                                        )}
                                    </View>
                                    <View style={{ flex: 1.5 }}>
                                        <Text style={styles.label}>{t('profile_screen.whatsapp_phone')}</Text>
                                        <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
                                    </View>
                                </View>

                                <Text style={styles.label}>{t('profile_screen.preferred_language')}</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={editLanguage} onValueChange={handleLanguageChange} style={styles.picker}>
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
                                    <TouchableOpacity onPress={handleSaveGlobal} style={[styles.saveBtn, { flex: 2, backgroundColor: COLORS.accent }]}>
                                        <Text style={[styles.btnText, { color: COLORS.primaryDark }]}>{t('profile_screen.save_updates')}</Text>
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
                                { id: 'card', label: t('profile_screen.card_bank'), icon: 'card-outline' },
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
                                    placeholder="e.g. +254712345678"
                                    keyboardType="phone-pad"
                                    value={mpesaPhone}
                                    onChangeText={setMpesaPhone}
                                />
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                    <Ionicons name="shield-checkmark" size={14} color="#2E7D32" />
                                    <Text style={{ fontSize: 12, color: '#2E7D32', marginLeft: 6, fontWeight: '600' }}>{t('profile_screen.phone_secure')}</Text>
                                </View>
                            </>
                        ) : paymentMethod === 'card' ? (
                            <View style={{ padding: 16, backgroundColor: '#f0f9ff', borderRadius: 14, marginTop: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="lock-closed" size={18} color={COLORS.primary} />
                                    <Text style={{ marginLeft: 8, fontWeight: 'bold', color: COLORS.primaryDark, fontSize: 15 }}>{t('checkout.secure_card')}</Text>
                                </View>
                                <Text style={{ color: COLORS.gray, fontSize: 13, lineHeight: 20 }}>
                                    {t('checkout.secure_text')}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                                    <Ionicons name="checkmark-circle" size={14} color="#2E7D32" />
                                    <Text style={{ fontSize: 12, color: '#2E7D32', marginLeft: 6, fontWeight: '600' }}>{t('checkout.pci_badge')}</Text>
                                </View>
                            </View>
                        ) : null}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setIsPaymentEditing(false)} style={[styles.saveBtn, { flex: 1, backgroundColor: '#f0f0f0', elevation: 0 }]}>
                                <Text style={[styles.btnText, { color: COLORS.gray }]}>{t('profile_screen.back')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveGlobal} style={[styles.saveBtn, { flex: 2, backgroundColor: COLORS.accent }]}>
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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: 20, backgroundColor: COLORS.white, zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    title: { fontSize: 22, fontWeight: 'bold', color: COLORS.primaryDark, letterSpacing: -0.5, flexShrink: 1 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff1f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    logoutText: { marginLeft: 5, color: COLORS.error, fontWeight: 'bold', fontSize: 13 },
    scrollContent: { paddingBottom: 100 },
    brandingBanner: { height: 140, width: '100%', position: 'absolute', top: 0 },
    glowOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,215,0,0.05)' },
    profileCard: { backgroundColor: COLORS.white, marginHorizontal: 15, marginTop: 40, borderRadius: 25, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 15, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
    cardHeader: { padding: 25, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
    avatarContainer: { position: 'relative' },
    avatarImage: { width: 95, height: 95, borderRadius: 47.5, borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)' },
    placeholderAvatar: { width: 95, height: 95, borderRadius: 47.5, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },
    cameraBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: COLORS.accent, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white, elevation: 4 },
    headerInfo: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    userName: { fontSize: 24, fontWeight: 'bold', color: COLORS.white, flexShrink: 1 },
    userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
    statsContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 20, backgroundColor: '#fff', gap: 10 },
    statBox: { flex: 1, minWidth: 86, alignItems: 'center' },
    statNumber: { fontSize: 22, fontWeight: 'bold', color: COLORS.accentDark },
    statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' },
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
    walletPendingText: { color: COLORS.accent, fontSize: 12, fontWeight: '700', marginTop: -8, marginBottom: 10 },
    walletFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
    walletMethodInfo: { flex: 1, minWidth: 120 },
    payoutMethodLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 },
    payoutMethodValue: { color: COLORS.white, fontSize: 14, fontWeight: 'bold' },
    walletActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
    withdrawProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    withdrawProfileBtnText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 13 },
    configureBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    configureBtnText: { color: COLORS.primaryDark, fontWeight: 'bold', fontSize: 13 },
    ratingCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 25, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, borderWidth: 1, borderColor: '#f0f0f0' },
    ratingInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    ratingNumber: { fontSize: 26, fontWeight: 'bold', color: COLORS.primaryDark },
    starsRow: { flexDirection: 'row', marginTop: 4 },
    ratingSubtitle: { fontSize: 12, color: COLORS.gray, marginTop: 12, fontStyle: 'italic' },
    miniDogCard: { width: 120, marginRight: 15, alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, padding: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    miniDogImg: { width: 95, height: 95, borderRadius: 18, backgroundColor: '#eee' },
    miniDogName: { marginTop: 10, fontWeight: 'bold', color: COLORS.primaryDark, fontSize: 14 },
    miniAddBtn: { backgroundColor: COLORS.accent, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 6, position: 'absolute', right: -5, bottom: 20 },
    emptyCard: { width: '100%', backgroundColor: '#f8f9fa', borderRadius: 20, padding: 30, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#ddd' },
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
    customCountryCodeInput: { marginTop: 8 },
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
    legalCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#edf0f2', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 5 },
    legalIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary + '12', justifyContent: 'center', alignItems: 'center' },
    legalTextGroup: { flex: 1, minWidth: 190 },
    legalTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.primaryDark },
    legalDescription: { fontSize: 12, color: COLORS.gray, lineHeight: 18, marginTop: 4 },
    dangerCard: { backgroundColor: '#fff5f5', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#ffd6d6', flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 },
    dangerIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffe8e8', justifyContent: 'center', alignItems: 'center' },
    dangerTextGroup: { flex: 1, minWidth: 190 },
    dangerTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.error },
    dangerDescription: { fontSize: 12, color: COLORS.gray, lineHeight: 18, marginTop: 4 },
    deleteAccountBtn: { backgroundColor: COLORS.error, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
    deleteAccountText: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
    disabledAction: { opacity: 0.55 },
    // Pet card styles
    petCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, borderWidth: 1, borderColor: '#f0f0f0' },
    petCardImg: { width: 65, height: 65, borderRadius: 14, backgroundColor: '#eee' },
    petCardInfo: { flex: 1, minWidth: 0, marginLeft: 14 },
    petCardName: { fontSize: 17, fontWeight: 'bold', color: COLORS.primaryDark, flexShrink: 1 },
    petCardBreed: { fontSize: 13, color: COLORS.gray, marginTop: 3 },
    petCardAge: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
    petTypeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 3 },
    petTypeBadgeText: { fontSize: 11, fontWeight: 'bold' },
    addPetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed', backgroundColor: COLORS.primary + '08', marginTop: 4, marginBottom: 10 },
    addPetBtnText: { fontSize: 15, fontWeight: 'bold', color: COLORS.primary },
});

export default ProfileScreen;
