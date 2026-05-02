import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, SIZES, SHADOWS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export const FeaturedEventCard = ({ item, onPress }) => {
    const date = new Date(item.start_time);
    const isFull = item.capacity > 0 && item.registrant_count >= item.capacity;
    
    return (
        <TouchableOpacity 
            style={[styles.container, isFull && { opacity: 0.5 }]} 
            onPress={onPress}
        >
            <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.content}>
                    <View style={[styles.badge, isFull && { backgroundColor: '#ff4d4d' }]}>
                        <Text style={[styles.badgeText, isFull && { color: 'white' }]}>{isFull ? 'FULL' : 'FEATURED'}</Text>
                    </View>
                    
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    
                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <Ionicons name="calendar" size={14} color={COLORS.accent} />
                            <Text style={styles.infoText}>
                                {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Ionicons name="location" size={14} color={COLORS.accent} />
                            <Text style={styles.infoText} numberOfLines={1}>{item.location}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.footer}>
                        <Text style={styles.actionText}>Learn More</Text>
                        <Ionicons name="arrow-forward-circle" size={24} color={COLORS.accent} />
                    </View>
                </View>
                
                {/* Decorative element */}
                <Ionicons 
                    name="paw" 
                    size={120} 
                    color="rgba(255,255,255,0.05)" 
                    style={styles.pawIcon}
                />
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 280,
        height: 180,
        marginRight: SPACING.md,
        borderRadius: 24,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
    gradient: {
        flex: 1,
        padding: 20,
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        zIndex: 1,
    },
    badge: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.accent,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: COLORS.primaryDark,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.white,
        lineHeight: 26,
    },
    infoRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    infoText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
    },
    actionText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '700',
    },
    pawIcon: {
        position: 'absolute',
        bottom: -20,
        right: -20,
        zIndex: 0,
    }
});
