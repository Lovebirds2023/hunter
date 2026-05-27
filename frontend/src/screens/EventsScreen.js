import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView, Animated } from 'react-native';
import { COLORS, SPACING, SIZES, SHADOWS } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { getEvents } from '../api/events';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeBackground } from '../components/ThemeBackground';
import { EventSearchBar } from '../components/EventSearchBar';
import { EventCategoryFilter } from '../components/EventCategoryFilter';
import { FeaturedEventCard } from '../components/FeaturedEventCard';
import { EventCalendarView } from '../components/EventCalendarView';

export const EventsScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [viewType, setViewType] = useState('list'); // 'list' or 'calendar'

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        try {
            const data = await getEvents();
            setEvents(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const categories = ['All', ...new Set(events.map(e => e.category || 'General'))];

    const filteredEvents = events.filter(event => {
        const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (event.location && event.location.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = selectedCategory === 'All' || (event.category || 'General') === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const featuredEvents = events.filter(e => e.title === "Lovedogs 360 Program" || e.is_featured === true);
    const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const renderEventCard = ({ item }) => {
        const date = new Date(item.start_time);
        const isFull = item.capacity > 0 && item.registrant_count >= item.capacity;

        return (
            <TouchableOpacity
                style={[styles.card, isFull && { opacity: 0.5 }]}
                onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
            >
                <View style={styles.cardDate}>
                    <Text style={styles.dateDay}>{date.getDate()}</Text>
                    <Text style={styles.dateMonth}>{date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</Text>
                </View>
                
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.cardMeta}>
                        <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.cardMetaText} numberOfLines={1}>{item.location}</Text>
                    </View>
                    <View style={styles.cardMeta}>
                        <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.cardMetaText}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                </View>

                <View style={styles.cardAction}>
                    <View style={[styles.slotBadge, isFull && { backgroundColor: 'rgba(211, 47, 47, 0.2)' }]}>
                        <Text style={[styles.slotText, isFull && { color: '#ff4d4d' }]}>
                            {isFull ? t('events.full') || 'FULL' : `${item.capacity - (item.registrant_count || 0)} ${t('events.slots_left') || 'left'}`}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.accent} />
                </View>
            </TouchableOpacity>
        );
    };

    const ListHeader = () => (
        <View>
            {featuredEvents.length > 0 && searchQuery === '' && selectedCategory === 'All' && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('events.featured_programs')}</Text>
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.featuredList}
                    >
                        {featuredEvents.map(event => (
                            <FeaturedEventCard 
                                key={event.id} 
                                item={event} 
                                onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                            />
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        {searchQuery ? t('events.search_results') : t('events.upcoming_events')}
                    </Text>
                    <Text style={styles.countText}>{filteredEvents.length} {t('navigation.events')}</Text>
                </View>
            </View>
        </View>
    );

    if (loading) return (
        <ThemeBackground>
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
        </ThemeBackground>
    );

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                {/* Custom Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                                <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>{t('events.title')}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity 
                                onPress={() => navigation.navigate('SavedEvents')}
                                style={[styles.toggleBtn, { marginRight: 10 }]}
                            >
                                <Ionicons name="heart" size={22} color="#D4AF37" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setViewType(viewType === 'list' ? 'calendar' : 'list')}
                                style={styles.toggleBtn}
                            >
                                <Ionicons 
                                    name={viewType === 'list' ? "calendar" : "list"} 
                                    size={22} 
                                    color={COLORS.accent} 
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <EventSearchBar 
                        value={searchQuery} 
                        onChangeText={setSearchQuery}
                        onClear={() => setSearchQuery('')}
                    />
                </View>

                {viewType === 'list' ? (
                    <FlatList
                        data={sortedEvents}
                        renderItem={renderEventCard}
                        keyExtractor={item => item.id}
                        ListHeaderComponent={
                            <>
                                <EventCategoryFilter 
                                    categories={categories}
                                    selectedCategory={selectedCategory}
                                    onSelect={setSelectedCategory}
                                />
                                <ListHeader />
                            </>
                        }
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="calendar-outline" size={80} color="rgba(255,255,255,0.1)" />
                                <Text style={styles.emptyTitle}>{t('events.no_events_title')}</Text>
                                <Text style={styles.emptySub}>{t('events.no_events_subtitle')}</Text>
                            </View>
                        }
                    />
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <EventCalendarView 
                            events={events}
                            onEventPress={(event) => navigation.navigate('EventDetail', { eventId: event.id })}
                        />
                        <View style={styles.calendarListSection}>
                            <Text style={styles.sectionTitle}>{t('events.events_this_month')}</Text>
                            {filteredEvents.slice(0, 5).map(event => (
                                <View key={event.id} style={{ marginBottom: 10 }}>
                                    {renderEventCard({ item: event })}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                )}

                {/* Floating Action Button for My Registrations */}
                <TouchableOpacity 
                    style={styles.fab}
                    onPress={() => navigation.navigate('MyRegistrations')}
                >
                    <LinearGradient
                        colors={[COLORS.accent, COLORS.accentDark]}
                        style={styles.fabGradient}
                    >
                        <Ionicons name="ticket" size={24} color={COLORS.primaryDark} />
                    </LinearGradient>
                </TouchableOpacity>
            </SafeAreaView>
        </ThemeBackground>
    );
};

// Simple SafeAreaView mock if not imported (to be safe)
const SafeAreaView = ({ children, style }) => <View style={[{ flex: 1, paddingTop: 40 }, style]}>{children}</View>;

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: COLORS.white, fontSize: 16 },
    header: {
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: COLORS.white,
        letterSpacing: -1,
    },
    toggleBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    scrollContent: {
        paddingBottom: 100,
    },
    section: {
        marginTop: SPACING.md,
        paddingHorizontal: SPACING.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.white,
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.md,
    },
    countText: {
        fontSize: 14,
        color: COLORS.accent,
        fontWeight: '600',
    },
    featuredList: {
        paddingLeft: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.md,
        borderRadius: 20,
        padding: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardDate: {
        width: 60,
        height: 60,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    dateDay: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.accent,
    },
    dateMonth: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.white,
        opacity: 0.8,
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.white,
        marginBottom: 6,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    cardMetaText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
    },
    cardAction: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 50,
    },
    slotBadge: {
        backgroundColor: 'rgba(255,215,0,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    slotText: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.accent,
    },
    emptyContainer: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
        marginTop: 20,
    },
    emptySub: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 8,
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        ...SHADOWS.medium,
    },
    fabGradient: {
        flex: 1,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarListSection: {
        marginTop: 20,
        paddingBottom: 40,
    }
});
