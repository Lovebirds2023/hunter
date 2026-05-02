import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, SafeAreaView, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import client from '../api/client';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { userInfo, logout } = useContext(AuthContext);
    const [stats, setStats] = useState({ dogsCount: 0, casesCount: 0 });
    const [loading, setLoading] = useState(true);
    const [spotlightItems, setSpotlightItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [healthSummary, setHealthSummary] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch stats for the dashboard
                const [dogsRes, casesRes, spotlightRes, healthRes] = await Promise.all([
                    client.get('/my-dogs'),
                    client.get('/cases'),
                    client.get('/spotlight').catch(() => ({ data: null })), // Handle optional spotlight
                    client.get('/health/summary').catch(() => ({ data: null }))
                ]);
                
                let combined = [];
                if (spotlightRes.data && spotlightRes.data.length > 0) {
                    combined = [...spotlightRes.data];
                }
                
                if (casesRes.data.length > 0) {
                    const approved = casesRes.data.filter(c => c.is_approved).slice(0, 3);
                    approved.forEach(c => {
                        // Avoid duplicates if a case is already in spotlight
                        if (!combined.some(s => s.target_id === c.id.toString() || s.id === c.id)) {
                            combined.push({
                                ...c,
                                is_case: true,
                                target_route: 'CaseDetail',
                                target_id: c.id.toString()
                            });
                        }
                    });
                }
                setSpotlightItems(combined);
                
                setStats({
                    dogsCount: dogsRes.data.length,
                    casesCount: casesRes.data.length
                });
            } catch (e) {
                console.error("Failed to fetch dash stats", e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    // Auto-rotation effect
    useEffect(() => {
        if (spotlightItems.length <= 1) return;
        
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % spotlightItems.length);
        }, 6000); // 6 seconds per slide
        
        return () => clearInterval(interval);
    }, [spotlightItems]);

    const QuickAction = ({ title, icon, color, onPress, subtitle }) => (
        <TouchableOpacity style={styles.actionCard} onPress={onPress}>
            <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={28} color={color} />
            </View>
            <Text style={styles.actionTitle}>{title}</Text>
            {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                {/* Modern Header Section */}
                <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryDark]}
                    style={styles.header}
                >
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.greeting}>{t('home.greeting', { name: userInfo?.full_name?.split(' ')[0] || 'Friend' })}</Text>
                            <Text style={styles.headerSub}>{t('home.sub_greeting')}</Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={() => navigation.navigate('Inbox')} style={styles.headerActionBtn}>
                                <Ionicons name="notifications-outline" size={24} color={COLORS.white} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('Onboarding')} style={styles.headerActionBtn}>
                                <Ionicons name="help-circle-outline" size={24} color={COLORS.white} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={logout} style={styles.headerActionBtn}>
                                <Ionicons name="log-out-outline" size={24} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats Widget Overlay */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.dogsCount}</Text>
                            <Text style={styles.statLabel}>{t('home.my_dogs')}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.casesCount}</Text>
                            <Text style={styles.statLabel}>{t('home.local_alerts')}</Text>
                        </View>
                    </View>
                </LinearGradient>

                <View style={styles.content}>
                    {/* Health & Wellness Smart Alert */}
                    <TouchableOpacity
                        style={[styles.healthCard, { borderColor: healthSummary?.upcoming_alert ? 'rgba(211, 47, 47, 0.3)' : 'rgba(76, 175, 80, 0.3)' }]}
                        onPress={() => navigation.navigate('WellnessHub')} // Link to Hub
                    >
                        <LinearGradient
                            colors={healthSummary?.upcoming_alert ? ['rgba(211, 47, 47, 0.08)', 'rgba(211, 47, 47, 0.02)'] : ['rgba(76, 175, 80, 0.08)', 'rgba(76, 175, 80, 0.02)']}
                            style={styles.healthInner}
                        >
                            <View style={styles.healthHeader}>
                                <Ionicons name="medical" size={20} color={healthSummary?.upcoming_alert ? '#D32F2F' : '#388E3C'} />
                                <Text style={[styles.healthTitle, { color: healthSummary?.upcoming_alert ? '#D32F2F' : '#388E3C'}]}>{t('home.health_wellness')}</Text>
                            </View>
                            
                            {healthSummary?.upcoming_alert ? (
                                <Text style={[styles.healthText, { color: '#D32F2F', fontWeight: 'bold' }]}>
                                    <Ionicons name="alert-circle" size={14} /> {healthSummary.upcoming_alert}
                                </Text>
                            ) : healthSummary?.has_data ? (
                                <Text style={[styles.healthText, { color: '#2E7D32' }]}>
                                    All your dogs are healthy! Overall Wellness: {healthSummary.overall_score}%
                                </Text>
                            ) : (
                                <Text style={styles.healthText}>{t('home.health_status')}</Text>
                            )}
                            
                            <View style={styles.healthFooter}>
                                <Text style={[styles.healthAction, { color: healthSummary?.upcoming_alert ? '#D32F2F' : '#388E3C'}]}>{t('home.view_records')}</Text>
                                <Ionicons name="chevron-forward" size={14} color={healthSummary?.upcoming_alert ? '#D32F2F' : '#388E3C'} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Quick Actions Grid */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('home.quick_actions')}</Text>
                    </View>

                    <View style={styles.grid}>
                        <QuickAction
                            title={t('home.marketplace')}
                            subtitle={t('home.shop_book')}
                            icon="cart"
                            color={COLORS.primary}
                            onPress={() => navigation.navigate('Marketplace')}
                        />
                        <QuickAction
                            title={t('report.types.lost_dog')}
                            subtitle={t('report.subtitle')}
                            icon="search"
                            color="#4488FF"
                            onPress={() => navigation.navigate('Report', { screen: 'ReportCase', params: { preSelectType: 'lost_dog' } })}
                        />
                        <QuickAction
                            title={t('report.types.found_dog')}
                            subtitle={t('report.subtitle')}
                            icon="eye"
                            color="#00C851"
                            onPress={() => navigation.navigate('Report', { screen: 'ReportCase', params: { preSelectType: 'found_dog' } })}
                        />
                        <QuickAction
                            title={t('home.identity')}
                            subtitle={t('home.biometric_scan')}
                            icon="finger-print"
                            color="#4CAF50"
                            onPress={() => navigation.navigate('DogRegistration')}
                        />
                        <QuickAction
                            title={t('home.my_events')}
                            subtitle={t('home.dog_meetups')}
                            icon="calendar"
                            color="#FF9800"
                            onPress={() => navigation.navigate('Events')}
                        />
                    </View>

                    {/* Community Spotlight */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('home.community_spotlight')}</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Report')}>
                            <Text style={styles.seeAll}>{t('home.see_all')}</Text>
                        </TouchableOpacity>
                    </View>

                    {spotlightItems.length > 0 ? (
                        <View>
                            <TouchableOpacity 
                                style={styles.spotlightCard} 
                                activeOpacity={0.9}
                                onPress={() => {
                                    const item = spotlightItems[currentIndex];
                                    if (item.target_route === 'CaseDetail') {
                                        navigation.navigate('Report', { screen: 'CaseDetail', params: { reportId: item.target_id || item.id } });
                                    } else if (item.target_route === 'EventDetail') {
                                        navigation.navigate('Events', { screen: 'EventDetail', params: { eventId: item.target_id } });
                                    } else if (item.target_route === 'Marketplace') {
                                        navigation.navigate('Marketplace');
                                    } else if (item.target_route) {
                                        navigation.navigate(item.target_route, item.target_id ? { id: item.target_id } : {});
                                    } else {
                                        navigation.navigate('Report', { screen: 'CaseDetail', params: { reportId: item.id } });
                                    }
                                }}
                            >
                                {/* Hero Image */}
                                {spotlightItems[currentIndex].image_url ? (
                                    <Image source={{ uri: spotlightItems[currentIndex].image_url }} style={styles.spotlightImage} resizeMode="cover" />
                                ) : (
                                    <LinearGradient
                                        colors={spotlightItems[currentIndex].is_case ? ['#D32F2F', '#B71C1C'] : [COLORS.primary, COLORS.primaryDark]}
                                        style={[styles.spotlightImage, { justifyContent: 'center', alignItems: 'center' }]}
                                    >
                                        <View style={styles.spotlightIconCircle}>
                                            <Ionicons name={spotlightItems[currentIndex].is_case ? "alert-circle" : "megaphone"} size={40} color="#fff" />
                                        </View>
                                    </LinearGradient>
                                )}

                                {/* Gradient Overlay on Image */}
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.75)']}
                                    style={styles.spotlightOverlay}
                                />

                                {/* Smart Badge — top-left */}
                                <View style={styles.spotlightBadgeRow}>
                                    {spotlightItems[currentIndex].is_case ? (
                                        <View style={styles.urgentBadge}>
                                            <Ionicons name="alert-circle" size={12} color="#fff" />
                                            <Text style={styles.urgentBadgeText}>URGENT</Text>
                                        </View>
                                    ) : spotlightItems[currentIndex].target_route === 'EventDetail' ? (
                                        <View style={styles.eventBadge}>
                                            <Ionicons name="calendar" size={12} color="#fff" />
                                            <Text style={styles.eventBadgeText}>EVENT</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.featuredBadge}>
                                            <Ionicons name="star" size={12} color={COLORS.primaryDark} />
                                            <Text style={styles.featuredBadgeText}>FEATURED</Text>
                                        </View>
                                    )}
                                    {/* AD transparency label */}
                                    {!spotlightItems[currentIndex].is_case && (
                                        <View style={styles.adLabel}>
                                            <Text style={styles.adLabelText}>AD</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Content Overlay — sits on top of the image */}
                                <View style={styles.spotlightContentOverlay}>
                                    <Text style={styles.spotlightTitle} numberOfLines={1}>{spotlightItems[currentIndex].title}</Text>
                                    <Text style={styles.spotlightDesc} numberOfLines={2}>
                                        {spotlightItems[currentIndex].description || (spotlightItems[currentIndex].case_type ? t('report.types.' + spotlightItems[currentIndex].case_type) : '')}
                                    </Text>
                                    <View style={styles.spotlightFooterRow}>
                                        <View style={styles.spotlightLocationRow}>
                                            <Ionicons name="location" size={12} color="rgba(255,255,255,0.7)" />
                                            <Text style={styles.spotlightLocationText} numberOfLines={1}>
                                                {spotlightItems[currentIndex].location || (spotlightItems[currentIndex].is_case ? 'Community Report' : 'Marketplace')}
                                            </Text>
                                        </View>
                                        <View style={styles.ctaButton}>
                                            <Text style={styles.ctaText}>
                                                {spotlightItems[currentIndex].is_case ? 'Help Now' : 'View Details'}
                                            </Text>
                                            <Ionicons name="arrow-forward" size={14} color={COLORS.primaryDark} />
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Sponsored Tag + Navigation Dots */}
                            <View style={styles.spotlightMeta}>
                                {!spotlightItems[currentIndex].is_case ? (
                                    <Text style={styles.sponsoredTag}>Sponsored · Lovedogs 360</Text>
                                ) : (
                                    <View />
                                )}
                                {spotlightItems.length > 1 && (
                                    <View style={styles.dotContainer}>
                                        {spotlightItems.map((_, i) => (
                                            <View 
                                                key={i} 
                                                style={[styles.dot, i === currentIndex && styles.activeDot]} 
                                            />
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.spotlightCard} activeOpacity={0.9} onPress={() => navigation.navigate('Report')}>
                            <Image
                                source={require('../../assets/dog_placeholder.png')}
                                style={styles.spotlightImage}
                                resizeMode="cover"
                            />
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.75)']}
                                style={styles.spotlightOverlay}
                            />
                            <View style={styles.spotlightContentOverlay}>
                                <Text style={styles.spotlightTitle}>{t('home.community_walk')}</Text>
                                <Text style={styles.spotlightDesc}>{t('home.community_walk_desc')}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bottom Spacing */}
                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    container: { flex: 1 },
    header: {
        paddingTop: 40,
        paddingBottom: 60,
        paddingHorizontal: SPACING.lg,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        ...SHADOWS.medium,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    greeting: { fontSize: 28, fontWeight: 'bold', color: COLORS.white },
    headerSub: { fontSize: 14, color: COLORS.white, fontWeight: '500' },
    headerActions: { flexDirection: 'row', gap: 10 },
    headerActionBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: SPACING.md,
        marginTop: 10,
        ...SHADOWS.small,
        position: 'absolute',
        bottom: -30,
        left: SPACING.lg,
        right: SPACING.lg,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statItem: { alignItems: 'center', flex: 1 },
    statNumber: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary },
    statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    statDivider: { width: 1, height: 40, backgroundColor: '#eee' },
    content: { marginTop: 50, paddingHorizontal: SPACING.lg },
    healthCard: { marginBottom: SPACING.lg, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)' },
    healthInner: { padding: SPACING.md },
    healthHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    healthTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginLeft: 8 },
    healthText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
    healthFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'flex-start' },
    healthAction: { fontSize: 12, fontWeight: 'bold', color: COLORS.accentDark, marginRight: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md, marginTop: SPACING.sm },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    seeAll: { fontSize: 14, fontWeight: '600', color: COLORS.accentDark },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    actionCard: {
        width: (width - SPACING.lg * 2 - 15) / 2,
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: SPACING.md,
        marginBottom: 15,
        ...SHADOWS.small,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    actionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
    actionSubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
    spotlightCard: {
        borderRadius: 20,
        overflow: 'hidden',
        ...SHADOWS.medium,
        marginBottom: 6,
        height: 200,
        position: 'relative',
    },
    spotlightImage: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
    spotlightOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
    },
    spotlightIconCircle: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    spotlightBadgeRow: {
        position: 'absolute', top: 12, left: 12, right: 12,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    urgentBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#E53935', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    },
    urgentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    eventBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#1976D2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    },
    eventBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    featuredBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: COLORS.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    },
    featuredBadgeText: { color: COLORS.primaryDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    adLabel: {
        backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    adLabelText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
    spotlightContentOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 16, paddingTop: 8,
    },
    spotlightTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 3, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    spotlightDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 17, marginBottom: 8 },
    spotlightFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    spotlightLocationRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    spotlightLocationText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginLeft: 4 },
    ctaButton: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: COLORS.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    },
    ctaText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: '800' },
    spotlightMeta: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 4, marginBottom: 15,
    },
    sponsoredTag: { fontSize: 10, color: COLORS.textSecondary, fontStyle: 'italic' },
    dotContainer: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.12)', marginHorizontal: 3 },
    activeDot: { backgroundColor: COLORS.accent, width: 18, borderRadius: 9 }
});

export default HomeScreen;
