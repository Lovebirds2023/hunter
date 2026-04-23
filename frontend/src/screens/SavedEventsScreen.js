import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSavedEvents, toggleSaveEvent } from '../api/events';
import moment from 'moment';

const SavedEventsScreen = ({ navigation }) => {
    const [savedEvents, setSavedEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSavedEvents();
    }, []);

    const fetchSavedEvents = async () => {
        try {
            const data = await getSavedEvents();
            // Assuming the backend returns { id, event_id, created_at, event: { ... } }
            setSavedEvents(data || []);
        } catch (error) {
            console.error('Error fetching saved events:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnsave = async (eventId) => {
        try {
            // Optimistic update
            const updated = savedEvents.filter(se => se.event_id !== eventId);
            setSavedEvents(updated);
            await toggleSaveEvent(eventId);
        } catch (error) {
            console.error('Error unsaving event:', error);
            // Revert on error
            fetchSavedEvents();
        }
    };

    const renderEventCard = ({ item }) => {
        const event = item.event;
        if (!event) return null;

        return (
            <TouchableOpacity 
                style={styles.card}
                onPress={() => navigation.navigate('EventDetail', { event })}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <TouchableOpacity onPress={() => handleUnsave(event.id)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                        <Ionicons name="heart" size={24} color="#D4AF37" />
                    </TouchableOpacity>
                </View>
                
                <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>
                        {moment(event.start_time).format('MMM D, YYYY - h:mm A')}
                    </Text>
                </View>
                
                <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{event.location}</Text>
                </View>

                <View style={styles.footerRow}>
                    <Text style={styles.savedDateText}>Saved {moment(item.created_at).fromNow()}</Text>
                    <View style={styles.chip}>
                        <Text style={styles.chipText}>{event.category || 'Event'}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#D4AF37"/></View>;

    return (
        <View style={styles.container}>
            <FlatList
                data={savedEvents}
                keyExtractor={(item) => item.id}
                renderItem={renderEventCard}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="heart-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No saved events</Text>
                        <Text style={styles.emptySubtext}>Events you save will appear here for easy access.</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 16 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, color: '#333', fontWeight: 'bold', marginTop: 16 },
    emptySubtext: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    eventTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', flex: 1, marginRight: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    infoText: { fontSize: 14, color: '#666', marginLeft: 8 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
    savedDateText: { fontSize: 12, color: '#999', fontStyle: 'italic' },
    chip: { backgroundColor: '#f0f0f0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { fontSize: 12, color: '#666', fontWeight: '500' }
});

export default SavedEventsScreen;
