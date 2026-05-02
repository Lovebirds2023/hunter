import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, TextInput, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeBackground } from '../components/ThemeBackground';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import client from '../api/client';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import MapView, { Marker, Callout } from '../components/MapComponent';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';

// Platform-aware storage helper
const Storage = {
    getItemAsync: async (key: string): Promise<string | null> => {
        if (Platform.OS === 'web') return localStorage.getItem(key);
        return SecureStore.getItemAsync(key);
    }
};

const { width, height } = Dimensions.get('window');

const SERVICE_CATEGORIES = [
    { title: 'All', value: 'all', icon: 'apps' },
    { title: 'Health', value: 'health', icon: 'medical' },
    { title: 'Therapy', value: 'therapy & wellbeing', icon: 'heart' },
    { title: 'Training', value: 'training', icon: 'fitness' },
    { title: 'Grooming', value: 'grooming', icon: 'cut' },
    { title: 'Boarding', value: 'boarding / care', icon: 'home' },
    { title: 'Events', value: 'events & programs', icon: 'calendar' },
    { title: 'Safety', value: 'safety & compliance', icon: 'shield-checkmark' },
    { title: 'Rehoming', value: 'rehoming', icon: 'paw' },
];

const PRODUCT_CATEGORIES = [
    { title: 'All', value: 'all', icon: 'apps' },
    { title: 'Food', value: 'food', icon: 'fast-food' },
    { title: 'Health', value: 'health products', icon: 'medkit' },
    { title: 'Equipment', value: 'equipment', icon: 'construct' },
    { title: 'Toys', value: 'toys', icon: 'football' },
    { title: 'Travel', value: 'travel', icon: 'airplane' },
    { title: 'Gear', value: 'therapy gear', icon: 'bandage' },
];

export const MarketplaceScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { userInfo } = useAuth();
    const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [orderLoading, setOrderLoading] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
    const [showMap, setShowMap] = useState(false);
    const [preferredCurrency, setPreferredCurrency] = useState('KES');
    const { convertPrice, formatCurrency } = useCurrency();

    useEffect(() => {
        getUserId();
        setupLocation();
    }, []);

    useEffect(() => {
        fetchServices();
    }, [userLocation]);

    const setupLocation = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('Permission to access location was denied');
                fetchServices(); // Fetch anyway without location
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setUserLocation(location);
        } catch (error) {
            console.error('Error setting up location:', error);
            fetchServices();
        }
    };

    const getUserId = async () => {
        try {
            // Use userInfo from AuthContext if available (avoids SecureStore on web)
            if (userInfo) {
                setUserId(userInfo.id);
                setPreferredCurrency(userInfo.preferred_currency || 'KES');
                return;
            }
            // Fallback: read from platform-aware storage
            const userStr = await Storage.getItemAsync('userInfo');
            if (userStr) {
                const user = JSON.parse(userStr);
                setUserId(user.id);
                setPreferredCurrency(user.preferred_currency || 'KES');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchServices = async () => {
        setLoading(true);
        try {
            let url = '/services';
            const params: any = {};
            if (activeTab) params.item_type = activeTab;
            if (userLocation) {
                params.lat = userLocation.coords.latitude;
                params.lon = userLocation.coords.longitude;
            }

            const response = await client.get(url, { params });
            setServices(response.data);
        } catch (error) {
            console.error(error);
            Alert.alert(t('common.error'), t('marketplace.empty.title', { type: activeTab }));
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = useMemo(() => {
        return services.filter(item => {
            const matchesTab = item.item_type === activeTab;
            const matchesCategory = selectedCategory === 'all' || item.category?.toLowerCase() === selectedCategory.toLowerCase();
            const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesTab && matchesCategory && matchesSearch;
        });
    }, [services, activeTab, selectedCategory, searchQuery]);

    const renderCard = ({ item, index }: any) => {
        const isOwner = item.provider_id === userId;
        const isClosest = index === 0 && userLocation && item.distance !== undefined;
        
        const isUnavailable = (item.item_type === 'products' && (item.stock_count === 0 || item.stock_count === null)) ||
                              (item.item_type === 'services' && (item.is_busy || item.slots_available === 0 || item.slots_available === null));

        const remainingText = item.item_type === 'products' 
            ? `${item.stock_count || 0} left` 
            : `${item.slots_available || 0} slots left`;

        const handleBookPress = async () => {
            if (isUnavailable) {
                Alert.alert('Unavailable', 'This item is currently out of stock or the provider is busy.');
                return;
            }
            setOrderLoading(item.id);
            try {
                const orderRes = await client.post('/orders', { service_id: item.id, share_phone: false });
                navigation.navigate('OrderReceipt', { orderId: orderRes.data.id, service: item });
            } catch (e: any) {
                const detail = e?.response?.data?.detail || 'Failed to create order. Please try again.';
                Alert.alert('Error', typeof detail === 'string' ? detail : JSON.stringify(detail));
            } finally {
                setOrderLoading(null);
            }
        };

        return (
            <TouchableOpacity
                style={[styles.card, isClosest && styles.closestCard, isUnavailable && { opacity: 0.5 }]}
                onPress={handleBookPress}
                disabled={orderLoading === item.id}
            >
                {orderLoading === item.id && (
                    <View style={styles.cardLoadingOverlay}>
                        <ActivityIndicator color={COLORS.primary} />
                    </View>
                )}
                <View style={styles.cardTop}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                    ) : (
                        <LinearGradient
                            colors={[COLORS.primary, COLORS.primaryDark]}
                            style={[styles.cardImage, styles.placeholderImage]}
                        >
                            <Ionicons name={item.item_type === 'products' ? 'cube' : 'hand-left'} size={48} color={COLORS.accent} />
                        </LinearGradient>
                    )}

                    <View style={styles.cardBadges}>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{item.category || 'General'}</Text>
                        </View>
                        {isClosest && (
                            <View style={styles.recommendedBadge}>
                                <Ionicons name="flash" size={10} color="white" />
                                <Text style={styles.recommendedBadgeText}>{t('common.recommended')}</Text>
                            </View>
                        )}
                        <View style={[styles.availabilityBadge, isUnavailable && { backgroundColor: 'rgba(211, 47, 47, 0.8)' }]}>
                            <Text style={styles.availabilityText}>{isUnavailable ? 'Sold Out' : remainingText}</Text>
                        </View>
                        {isOwner && (
                            <View style={styles.ownerActions}>
                                <TouchableOpacity
                                    style={[styles.editBadge, { marginBottom: 5 }]}
                                    onPress={() => navigation.navigate('CreateService', { service: item })}
                                >
                                    <Ionicons name="pencil" size={14} color="white" />
                                </TouchableOpacity>
                                {item.category === 'events & programs' && (
                                    <TouchableOpacity
                                        style={styles.responsesBadge}
                                        onPress={() => navigation.navigate('ServiceResponses', { 
                                            serviceId: item.id, 
                                            serviceTitle: item.title 
                                        })}
                                    >
                                        <Ionicons name="people" size={14} color="white" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>

                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.priceOverlay}
                    >
                        <Text style={styles.priceText}>
                            {formatCurrency(convertPrice(item.price, item.currency || 'KES', preferredCurrency), preferredCurrency)}
                        </Text>
                    </LinearGradient>
                </View>

                <View style={styles.cardBottom}>
                    <Text style={styles.serviceTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.ratingRow}>
                        <Ionicons name="person-circle-outline" size={16} color={COLORS.textSecondary} />
                        <Text style={styles.providerName} numberOfLines={1}> {item.provider?.full_name || 'Verified Provider'}</Text>
                    </View>

                    {item.distance !== undefined && (
                        <View style={styles.distanceRow}>
                            <Ionicons name="location-sharp" size={12} color={COLORS.primary} />
                            <Text style={styles.distanceText}>{item.distance} {t('marketplace.distance_away', { defaultValue: 'km away' })}</Text>
                        </View>
                    )}

                    <View style={styles.cardFooter}>
                        <View style={styles.statsRow}>
                            <Ionicons name="star" size={14} color={COLORS.accent} />
                            <Text style={styles.ratingText}>{(item.provider?.average_rating || 0).toFixed(1)}</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.actionBtn, isUnavailable && { backgroundColor: '#ddd' }]}
                            onPress={handleBookPress}
                            disabled={orderLoading === item.id}
                        >
                            <Text style={[styles.actionBtnText, isUnavailable && { color: '#888' }]}>
                                {isUnavailable ? 'Unavailable' : (item.item_type === 'products' ? t('marketplace.actions.buy_now') : t('marketplace.actions.book_now'))}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity >
        );
    };

    const renderCategoryPill = (cat: any) => {
        const isSelected = selectedCategory === cat.value;
        return (
            <TouchableOpacity
                key={cat.value}
                onPress={() => setSelectedCategory(cat.value)}
                style={[
                    styles.pill,
                    isSelected && styles.pillSelected
                ]}
            >
                <Ionicons
                    name={cat.icon as any}
                    size={16}
                    color={isSelected ? COLORS.white : COLORS.white}
                />
                <Text style={[
                    styles.pillText,
                    isSelected && styles.pillTextSelected
                ]}>
                    {cat.value === 'rehoming' ? 'Rehoming' : t(`marketplace.categories.${cat.value.split(' ')[0].split('/')[0].trim()}`)}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                {/* Modern Header */}
                <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryDark]}
                    style={styles.header}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{t('marketplace.title')}</Text>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity style={styles.notifBtn} onPress={() => setShowMap(!showMap)}>
                            <Ionicons name={showMap ? "list" : "map-outline"} size={24} color={COLORS.white} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={t('marketplace.search_placeholder', { type: t(`marketplace.tabs.${activeTab}`) })}
                                placeholderTextColor="#999"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </LinearGradient>

                {/* Tab Switcher */}
                <View style={styles.tabWrapper}>
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'services' && styles.activeTab]}
                            onPress={() => {
                                setActiveTab('services');
                                setSelectedCategory('all');
                            }}
                        >
                            <Text style={[styles.tabText, activeTab === 'services' && styles.activeTabText]}>
                                {t('marketplace.tabs.services')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'products' && styles.activeTab]}
                            onPress={() => {
                                setActiveTab('products');
                                setSelectedCategory('all');
                            }}
                        >
                            <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
                                {t('marketplace.tabs.products')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Horizontal Categories */}
                <View style={styles.categoriesWrapper}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryScroll}
                    >
                        {(activeTab === 'services' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES).map(renderCategoryPill)}
                    </ScrollView>
                </View>

                {showMap ? (
                    <View style={styles.mapContainer}>
                        <MapView
                            style={styles.map}
                            initialRegion={{
                                latitude: userLocation?.coords.latitude || -1.286389,
                                longitude: userLocation?.coords.longitude || 36.817223,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            }}
                            showsUserLocation={true}
                        >
                            {filteredItems.map((item) => (
                                item.latitude && item.longitude && (
                                    <Marker
                                        key={item.id}
                                        coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                                        title={item.title}
                                        description={`$${item.price} - ${item.distance || ''} km away`}
                                    >
                                        <Callout onPress={() => navigation.navigate('OrderReceipt', { orderId: 'MOCK-' + item.id, service: item })}>
                                            <View style={styles.callout}>
                                                <Text style={styles.calloutTitle}>{item.title}</Text>
                                                <Text style={styles.calloutPrice}>${item.price}</Text>
                                                <Text style={styles.calloutAction}>{t('common.view_details')}</Text>
                                            </View>
                                        </Callout>
                                    </Marker>
                                )
                            ))}
                        </MapView>
                    </View>
                ) : (
                    <FlatList
                        data={filteredItems}
                        renderItem={renderCard}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        numColumns={2}
                        columnWrapperStyle={styles.columnWrapper}
                        ListEmptyComponent={
                            !loading ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="search-outline" size={64} color="#ccc" />
                                    <Text style={styles.emptyText}>
                                        {t('marketplace.empty.title', { type: t(`marketplace.tabs.${activeTab}`) })}
                                    </Text>
                                    <Text style={styles.emptySubtext}>{t('marketplace.empty.subtitle')}</Text>
                                </View>
                            ) : null
                        }
                        ListHeaderComponent={
                            <View style={styles.featuredHeader}>
                                <Text style={styles.featuredTitle}>
                                    {selectedCategory === 'all'
                                        ? t('marketplace.featured', { type: t(`marketplace.tabs.${activeTab}`) })
                                        : t('marketplace.featured_cat', {
                                            category: selectedCategory === 'rehoming' ? 'Rehoming' : t(`marketplace.categories.${selectedCategory.split(' ')[0].split('/')[0].trim()}`),
                                            type: t(`marketplace.tabs.${activeTab}`)
                                        })}
                                </Text>
                                <Text style={styles.resultsCount}>{t('marketplace.results', { count: filteredItems.length })}</Text>
                            </View>
                        }
                        ListFooterComponent={<View style={{ height: 100 }} />}
                        refreshing={loading}
                        onRefresh={fetchServices}
                    />
                )}

                {/* Floating Action Button */}
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => navigation.navigate('CreateService')}
                >
                    <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryDark]}
                        style={styles.fabGradient}
                    >
                        <Ionicons name="add" size={32} color="white" />
                    </LinearGradient>
                </TouchableOpacity>
            </SafeAreaView>
        </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 10,
        paddingBottom: 20,
        paddingHorizontal: SPACING.md,
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
        ...SHADOWS.medium,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    notifBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        width: '100%',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 46,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: COLORS.text,
    },
    tabWrapper: {
        marginTop: -15, // Overlap effect
        alignItems: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        borderRadius: 25,
        width: '85%',
        padding: 5,
        ...SHADOWS.small,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 20,
    },
    activeTab: {
        backgroundColor: COLORS.primary,
    },
    tabText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: COLORS.textSecondary,
    },
    activeTabText: {
        color: COLORS.white,
    },
    categoriesWrapper: {
        marginTop: 15,
        marginBottom: 5,
    },
    categoryScroll: {
        paddingHorizontal: SPACING.md,
        paddingBottom: 10,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    pillSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.white,
        marginLeft: 6,
    },
    pillTextSelected: {
        color: COLORS.white,
    },
    listContainer: {
        paddingHorizontal: SPACING.sm,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    featuredHeader: {
        paddingHorizontal: SPACING.sm,
        marginVertical: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    featuredTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.white,
        textTransform: 'capitalize',
    },
    resultsCount: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
    },
    card: {
        width: (width - SPACING.sm * 3) / 2,
        backgroundColor: COLORS.white,
        borderRadius: 16,
        marginBottom: 15,
        ...SHADOWS.small,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    cardTop: {
        height: 120,
        width: '100%',
        position: 'relative',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardBadges: {
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryBadge: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    categoryBadgeText: {
        color: COLORS.white,
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    availabilityBadge: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    availabilityText: {
        color: COLORS.white,
        fontSize: 9,
        fontWeight: 'bold',
    },
    editBadge: {
        backgroundColor: COLORS.accent,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.small,
    },
    responsesBadge: {
        backgroundColor: COLORS.primary,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.small,
    },
    ownerActions: {
        flexDirection: 'column',
        alignItems: 'center',
    },
    priceOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 5,
        paddingHorizontal: 8,
        alignItems: 'flex-start',
    },
    priceText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    cardBottom: {
        padding: 10,
    },
    serviceTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    providerName: {
        fontSize: 11,
        color: COLORS.textSecondary,
        flex: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f9f9f9',
        paddingTop: 8,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 11,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    actionBtn: {
        backgroundColor: 'rgba(75, 0, 130, 0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    actionBtnText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 25,
        elevation: 8,
    },
    fabGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    cardLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderRadius: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textSecondary,
        marginTop: 15,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        paddingHorizontal: 40,
        marginTop: 5,
    },
    closestCard: {
        borderColor: COLORS.primary,
        borderWidth: 2,
    },
    recommendedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 5,
    },
    recommendedBadgeText: {
        color: COLORS.white,
        fontSize: 8,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    distanceText: {
        fontSize: 10,
        color: COLORS.primary,
        fontWeight: '600',
        marginLeft: 4,
    },
    mapContainer: {
        flex: 1,
        margin: SPACING.md,
        borderRadius: 20,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    callout: {
        padding: 10,
        minWidth: 120,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    calloutPrice: {
        fontSize: 12,
        color: COLORS.primary,
        marginVertical: 4,
    },
    calloutAction: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
    }
});
