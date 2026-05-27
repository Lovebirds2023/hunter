import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, SafeAreaView, RefreshControl, ActivityIndicator, Dimensions, Platform, Alert
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Callout, Circle } from '../components/MapComponent';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { ThemeBackground } from '../components/ThemeBackground';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';

const CASE_TYPE_CONFIG = {
    rabies_bite: { label: 'Rabies Bite', icon: 'warning', color: '#FF4444' },
    vehicle_hit: { label: 'Vehicle Hit', icon: 'car', color: '#FF8800' },
    injured_stray: { label: 'Injured Stray', icon: 'medkit', color: '#FF6600' },
    lost_dog: { label: 'I lost a dog', icon: 'search', color: '#4488FF' },
    found_dog: { label: 'I found a dog', icon: 'eye', color: '#00C851' },
    abuse: { label: 'Abuse Report', icon: 'alert-circle', color: '#CC0000' },
    other: { label: 'Other', icon: 'ellipsis-horizontal', color: '#888888' },
};

const CaseFeedScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
    const [userLocation, setUserLocation] = useState(null);
    const { userToken, userInfo, isAdmin } = useContext(AuthContext);

    useEffect(() => {
        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    let location = await Location.getCurrentPositionAsync({});
                    setUserLocation({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    });
                }
            } catch (error) {
                if (__DEV__) console.log('Location error:', error);
            }
        })();
    }, []);

    const fetchReports = useCallback(async () => {
        try {
            const res = await client.get('/cases');
            setReports(res.data);
        } catch (e) {
            if (__DEV__) console.log('Failed to fetch case reports', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const filteredReports = useMemo(() => {
        return reports;
    }, [reports]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchReports();
        });
        return unsubscribe;
    }, [navigation, fetchReports]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchReports();
    };

    const toggleLike = async (reportId, index) => {
        try {
            const res = await client.post(`/cases/${reportId}/like`);
            const updated = [...reports];
            const report = updated[index];
            report.is_liked = res.data.liked;
            report.like_count = res.data.liked ? report.like_count + 1 : report.like_count - 1;
            setReports(updated);
        } catch (e) {
            if (__DEV__) console.log('Like failed', e);
        }
    };

    const handleReport = (reportId) => {
        Alert.alert(
            'Report Post',
            'Why are you reporting this post?',
            [
                { text: 'Spam or misleading', onPress: () => submitReport(reportId, 'spam') },
                { text: 'Harmful or abusive', onPress: () => submitReport(reportId, 'harmful') },
                { text: 'Incorrect information', onPress: () => submitReport(reportId, 'misinformation') },
                { text: 'Cancel', style: 'cancel' },
            ],
            { cancelable: true }
        );
    };

    const submitReport = async (reportId, reason) => {
        try {
            await client.post(`/cases/${reportId}/flag`, { reason });
            Alert.alert('Report Submitted', 'Thank you. Our moderation team will review this post.');
        } catch {
            Alert.alert('Error', 'Could not submit report. Please try again.');
        }
    };

    const handleBlock = (authorId, authorName) => {
        Alert.alert(
            `Block ${authorName || 'User'}?`,
            'Blocked users cannot contact you or see your posts. You can unblock them anytime from your settings.',
            [
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await client.post(`/users/${authorId}/block`);
                            Alert.alert('User Blocked', `${authorName || 'This user'} has been blocked.`);
                        } catch {
                            Alert.alert('Error', 'Could not block user. Please try again.');
                        }
                    },
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const getTimeAgo = (dateStr) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return t('common.just_now', { defaultValue: 'Just now' });
        if (diff < 3600) return `${Math.floor(diff / 60)}m ${t('common.ago', { defaultValue: 'ago' })}`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ${t('common.ago', { defaultValue: 'ago' })}`;
        return `${Math.floor(diff / 86400)}d ${t('common.ago', { defaultValue: 'ago' })}`;
    };

    const renderCard = ({ item, index }) => {
        const config = CASE_TYPE_CONFIG[item.case_type] || CASE_TYPE_CONFIG.other;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('CaseDetail', { reportId: item.id })}
                activeOpacity={0.9}
            >
                {/* Author Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.authorRow}>
                        <View style={styles.avatar}>
                            {item.author?.profile_image ? (
                                <Image source={{ uri: item.author.profile_image }} style={styles.avatarImage} />
                            ) : (
                                <Ionicons name="person" size={20} color={COLORS.white} />
                            )}
                        </View>
                        <View style={styles.authorInfo}>
                            <Text style={styles.authorName}>{item.author?.full_name || t('common.anonymous', { defaultValue: 'Anonymous' })}</Text>
                            <Text style={styles.timeAgo}>{getTimeAgo(item.created_at)}</Text>
                        </View>
                    </View>
                    <View style={[styles.caseTypeBadge, { backgroundColor: config.color }]}>
                        <Ionicons name={config.icon} size={12} color="white" />
                        <Text style={styles.caseTypeText}>{t(`report.types.${item.case_type}`, { defaultValue: config.label })}</Text>
                    </View>
                </View>

                {/* Content */}
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.description ? (
                    <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
                ) : null}

                {/* Metadata Row for Lost/Found */}
                {(item.breed || item.color) && (
                    <View style={styles.metaRow}>
                        {item.breed && (
                            <View style={styles.metaBadge}>
                                <Text style={styles.metaLabel}>Breed:</Text>
                                <Text style={styles.metaValue}>{item.breed}</Text>
                            </View>
                        )}
                        {item.color && (
                            <View style={styles.metaBadge}>
                                <Text style={styles.metaLabel}>Color:</Text>
                                <Text style={styles.metaValue}>{item.color}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Image */}
                {item.image_url ? (
                    <View style={styles.imageOverlayContainer}>
                        <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
                        {item.images && item.images.length > 1 && (
                            <View style={styles.photoCountBadge}>
                                <Ionicons name="images" size={12} color="white" />
                                <Text style={styles.photoCountText}>{item.images.length}</Text>
                            </View>
                        )}
                    </View>
                ) : null}

                {/* Location */}
                {item.location ? (
                    <View style={styles.locationRow}>
                        <Ionicons name="location" size={14} color={COLORS.accent} />
                        <Text style={styles.locationText}>{item.location}</Text>
                    </View>
                ) : null}

                {/* Actions */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item.id, index)}>
                        <Ionicons
                            name={item.is_liked ? 'heart' : 'heart-outline'}
                            size={22}
                            color={item.is_liked ? '#FF4444' : 'rgba(255,255,255,0.6)'}
                        />
                        <Text style={styles.actionCount}>{item.like_count || 0}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate('CaseDetail', { reportId: item.id })}
                    >
                        <Ionicons name="chatbubble-outline" size={20} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.actionCount}>{item.comment_count || 0}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn}>
                        <Ionicons name="share-social-outline" size={20} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>

                    <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: item.status === 'open' ? '#44FF44' : '#FFD700' }]} />
                        <Text style={styles.statusText}>{item.status || 'open'}</Text>
                    </View>

                    {/* Report / Block — store compliance */}
                    <TouchableOpacity
                        style={[styles.actionBtn, { marginLeft: 'auto', marginRight: 0 }]}
                        onPress={() => Alert.alert(
                            'Options',
                            '',
                            [
                                { text: 'Report Post', onPress: () => handleReport(item.id) },
                                { text: 'Block User', onPress: () => handleBlock(item.author?.id, item.author?.full_name) },
                                { text: 'Cancel', style: 'cancel' },
                            ]
                        )}
                    >
                        <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{t('report.title')}</Text>
                    </View>
                    <Text style={styles.headerSubtitle}>{t('report.subtitle')}</Text>

                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleActive]}
                            onPress={() => setViewMode('list')}
                        >
                            <Ionicons name="list" size={18} color={viewMode === 'list' ? COLORS.primary : COLORS.white} />
                            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleActiveText]}>{t('report.toggles.list')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleBtn, viewMode === 'map' && styles.toggleActive]}
                            onPress={() => setViewMode('map')}
                        >
                            <Ionicons name="map" size={18} color={viewMode === 'map' ? COLORS.primary : COLORS.white} />
                            <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleActiveText]}>{t('report.toggles.map')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 60 }} />
                ) : viewMode === 'list' ? (
                    <FlatList
                        data={filteredReports}
                        keyExtractor={(item) => item.id}
                        renderItem={renderCard}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="paw" size={60} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyTitle}>{t('report.empty.title')}</Text>
                                <Text style={styles.emptySubtitle}>{t('report.empty.subtitle')}</Text>
                            </View>
                        }
                    />
                ) : (
                    <View style={styles.mapWrapper}>
                        {Platform.OS === 'web' ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                                <Ionicons name="map-outline" size={60} color={COLORS.accent} style={{ marginBottom: 20 }} />
                                <Text style={{ color: COLORS.white, fontSize: 18, textAlign: 'center', fontWeight: 'bold' }}>Map Unavailable on Web</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginTop: 10 }}>Please switch to 'List' view above or use your mobile device!</Text>
                            </View>
                        ) : (
                            <MapView
                                style={styles.map}
                                showsUserLocation={true}
                                showsMyLocationButton={true}
                                region={userLocation || {
                                    latitude: -1.286389, // Default to Nairobi
                                    longitude: 36.817223,
                                    latitudeDelta: 0.0922,
                                    longitudeDelta: 0.0421,
                                }}
                            >
                                {filteredReports.map((report) => {
                                const config = CASE_TYPE_CONFIG[report.case_type] || CASE_TYPE_CONFIG.other;
                                // Mocking lat/lng based on ID if not present in report
                                const lat = report.latitude || (-1.286389 + (Math.random() - 0.5) * 0.05);
                                const lng = report.longitude || (36.817223 + (Math.random() - 0.5) * 0.05);
                                const isSevere = report.case_type === 'rabies_bite' || report.case_type === 'abuse';

                                return (
                                    <React.Fragment key={report.id}>
                                        <Marker
                                            coordinate={{ latitude: lat, longitude: lng }}
                                            pinColor={config.color}
                                        >
                                            <Callout onPress={() => navigation.navigate('CaseDetail', { reportId: report.id })}>
                                                <View style={styles.callout}>
                                                    <Text style={styles.calloutTitle}>{report.title}</Text>
                                                    <Text style={styles.calloutDesc}>{t(`report.types.${report.case_type}`, { defaultValue: config.label })}</Text>
                                                    <Text style={styles.calloutAction}>{t('report.map.help')}</Text>
                                                </View>
                                            </Callout>
                                        </Marker>
                                        {isSevere && report.is_approved && Circle && (
                                            <Circle
                                                center={{ latitude: lat, longitude: lng }}
                                                radius={500}
                                                fillColor="rgba(255, 68, 68, 0.3)"
                                                strokeColor="rgba(255, 68, 68, 0.6)"
                                                strokeWidth={2}
                                            />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            </MapView>
                        )}
                    </View>
                )}

                {/* Floating Add Button */}
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => navigation.navigate('ReportCase')}
                >
                    <Ionicons name="add" size={32} color="white" />
                </TouchableOpacity>
            </SafeAreaView>
        </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        padding: SPACING.md,
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.white },
    headerSubtitle: { 
        fontSize: 13, 
        color: COLORS.accent, 
        marginTop: 4, 
        letterSpacing: 0.5,
        alignSelf: 'center',
        textAlign: 'center'
    },
    listContent: { padding: SPACING.md, paddingBottom: 100 },
    card: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    authorRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    avatarImage: { width: 40, height: 40, borderRadius: 20 },
    authorInfo: { marginLeft: 10 },
    authorName: { fontSize: 14, fontWeight: 'bold', color: COLORS.white },
    timeAgo: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
    caseTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    caseTypeText: { color: 'white', fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.white, marginBottom: 4 },
    cardDesc: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8, lineHeight: 18 },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: SPACING.sm,
        gap: 8,
    },
    metaBadge: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,215,0,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: 'rgba(255,215,0,0.2)',
    },
    metaLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        marginRight: 4,
    },
    metaValue: {
        fontSize: 10,
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    cardImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: SPACING.sm,
    },
    imageOverlayContainer: {
        position: 'relative',
        marginBottom: SPACING.sm,
    },
    photoCountBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    photoCountText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
    locationText: { fontSize: 12, color: COLORS.accent, marginLeft: 4 },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    actionCount: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginLeft: 5 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 'auto',
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
    statusText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' },
    emptyContainer: { alignItems: 'center', marginTop: 80 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', marginTop: 16 },
    emptySubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 8, textAlign: 'center' },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: 4,
        marginTop: 15,
        width: 160,
        alignSelf: 'center',
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        borderRadius: 18,
        gap: 6,
    },
    toggleActive: {
        backgroundColor: COLORS.accent,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    toggleActiveText: {
        color: COLORS.primary,
    },
    mapWrapper: {
        flex: 1,
        overflow: 'hidden',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    callout: {
        width: 150,
        padding: 5,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    calloutDesc: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    calloutAction: {
        fontSize: 10,
        color: COLORS.accentDark,
        fontWeight: 'bold',
        marginTop: 5,
    }
});

export { CaseFeedScreen };
export default CaseFeedScreen;
