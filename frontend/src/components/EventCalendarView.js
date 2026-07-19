import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { getUpcomingEventSlots } from '../utils/eventSlots';

export const EventCalendarView = ({ events, onEventPress }) => {
    const { t, i18n } = useTranslation();
    const today = new Date();
    const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

    const locale = i18n.language || 'en';
    const weekDays = Array.from({ length: 7 }, (_, index) =>
        new Date(2024, 0, 7 + index).toLocaleDateString(locale, { weekday: 'short' }).charAt(0)
    );

    const renderDays = () => {
        const days = [];
        // Fill empty spaces for the first week
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`empty-${i}`} style={styles.dayBox} />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dayEvents = events.filter(e => {
                const upcomingSlots = getUpcomingEventSlots(e.available_slots);
                if (upcomingSlots.length > 0) {
                    return upcomingSlots.some(slot => {
                        const slotDate = new Date(slot.start_time);
                        return slotDate.getFullYear() === viewDate.getFullYear() &&
                               slotDate.getMonth() === viewDate.getMonth() &&
                               slotDate.getDate() === d;
                    });
                }

                const eDate = new Date(e.start_time);
                return eDate.getFullYear() === viewDate.getFullYear() &&
                       eDate.getMonth() === viewDate.getMonth() &&
                       eDate.getDate() === d;
            });

            const isToday = d === today.getDate() && 
                          viewDate.getMonth() === today.getMonth() && 
                          viewDate.getFullYear() === today.getFullYear();

            days.push(
                <TouchableOpacity 
                    key={d} 
                    style={[styles.dayBox, isToday && styles.todayBox]}
                    onPress={() => dayEvents.length > 0 && onEventPress(dayEvents[0])}
                >
                    <Text style={[styles.dayText, isToday && styles.todayText]}>{d}</Text>
                    {dayEvents.length > 0 && (
                        <View style={styles.eventDot} />
                    )}
                </TouchableOpacity>
            );
        }
        return days;
    };

    const changeMonth = (offset) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => changeMonth(-1)}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                    {viewDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)}>
                    <Ionicons name="chevron-forward" size={24} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <View style={styles.weekDays}>
                {weekDays.map((day, i) => (
                    <Text key={i} style={styles.weekDayText}>{day}</Text>
                ))}
            </View>

            <View style={styles.grid}>
                {renderDays()}
            </View>
            
            <View style={styles.legend}>
                <View style={styles.eventDot} />
                <Text style={styles.legendText}>{t('events.scheduled_event')}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        padding: 20,
        marginHorizontal: SPACING.md,
        marginTop: SPACING.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    weekDays: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 10,
    },
    weekDayText: {
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '600',
        width: 35,
        textAlign: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    dayBox: {
        width: '14.28%',
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
    },
    todayBox: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
    },
    dayText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '600',
    },
    todayText: {
        color: COLORS.primaryDark,
        fontWeight: 'bold',
    },
    eventDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.accent,
        marginTop: 2,
    },
    legend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 20,
        justifyContent: 'center',
    },
    legendText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    }
});
