import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export const EventCalendarView = ({ events, onEventPress }) => {
    const today = new Date();
    const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

    const renderDays = () => {
        const days = [];
        // Fill empty spaces for the first week
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`empty-${i}`} style={styles.dayBox} />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayEvents = events.filter(e => {
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
                    {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)}>
                    <Ionicons name="chevron-forward" size={24} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            <View style={styles.weekDays}>
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                    <Text key={i} style={styles.weekDayText}>{day}</Text>
                ))}
            </View>

            <View style={styles.grid}>
                {renderDays()}
            </View>
            
            <View style={styles.legend}>
                <View style={styles.eventDot} />
                <Text style={styles.legendText}>Scheduled Event</Text>
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
