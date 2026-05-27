
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity, ScrollView, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { Picker } from '@react-native-picker/picker';
// import DateTimePicker from '@react-native-community/datetimepicker'; 
// Note: DateTimePicker requires extra installation. Using text input for date as YYYY-MM-DD for simplicity in this turn,
// or we can use a simple library if available. Or just text for now to avoid breaking build with uninstalled deps.
import * as Notifications from 'expo-notifications';

const RECORD_TYPES = ["vaccination", "deworming", "grooming", "checkup", "diet", "vet_notes", "medication", "surgery"];

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const AddHealthRecordScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
    const { dogId, dogName, defaultRecordType } = route.params;
    const [recordType, setRecordType] = useState(defaultRecordType || RECORD_TYPES[0]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [nextDueDate, setNextDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [remind7Days, setRemind7Days] = useState(true);
    const [remind1Day, setRemind1Day] = useState(true);
    const [customReminderDays, setCustomReminderDays] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const scheduleNotification = async (dueDateStr, type, daysBefore = 0, label = '') => {
        try {
            const dueDate = new Date(dueDateStr);
            dueDate.setHours(9, 0, 0, 0); // Set to 9 AM on the day
            
            const reminderDate = new Date(dueDate);
            reminderDate.setDate(reminderDate.getDate() - daysBefore);
            
            const now = new Date();
            const trigger = reminderDate.getTime() - now.getTime();

            if (trigger > 0) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: t('health.reminder', { name: dogName }),
                        body: label || t('health.reminder_body', { type: t(`health.types.${type}`), date: dueDateStr }),
                        data: { dogId },
                    },
                    trigger: { seconds: trigger / 1000 },
                });
            }
        } catch (e) {
            if (__DEV__) console.log("Notification error", e);
        }
    };

    const submitRecord = async () => {
        if (!date) {
            Alert.alert(t('common.error'), t('health.alerts.date_required'));
            return;
        }

        setIsSubmitting(true);
        try {
            const formattedDate = new Date(date).toISOString();
            const formattedDueDate = nextDueDate ? new Date(nextDueDate).toISOString() : null;

            await client.post(`/dogs/${dogId}/health-records`, {
                record_type: recordType,
                date: formattedDate,
                next_due_date: formattedDueDate,
                notes
            });

            if (nextDueDate) {
                // 1. On the day
                await scheduleNotification(nextDueDate, recordType);
                
                // 2. 7 Days before
                if (remind7Days) {
                    await scheduleNotification(nextDueDate, recordType, 7, `${dogName} is due for ${t(`health.types.${recordType}`)} in 7 days.`);
                }
                
                // 3. 1 Day before
                if (remind1Day) {
                    await scheduleNotification(nextDueDate, recordType, 1, `${dogName}'s ${t(`health.types.${recordType}`)} is tomorrow.`);
                }

                // 4. Custom
                if (customReminderDays) {
                    const days = parseInt(customReminderDays);
                    if (!isNaN(days)) {
                        await scheduleNotification(nextDueDate, recordType, days, `${dogName}'s health milestone is in ${days} days.`);
                    }
                }
            }

            Alert.alert(t('common.success'), t('health.alerts.success'), [
                { text: t('common.ok'), onPress: () => navigation.goBack() }
            ]);
        } catch (e) {
            if (__DEV__) console.log('Error adding record', e);
            Alert.alert(t('common.error'), t('health.alerts.error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('health.title')}</Text>
                <View style={{ width: 32 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.label}>{t('health.labels.type')}</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={recordType} onValueChange={setRecordType}>
                            {RECORD_TYPES.map(t_type => <Picker.Item key={t_type} label={t(`health.types.${t_type}`).toUpperCase()} value={t_type} />)}
                        </Picker>
                    </View>

                    <Text style={styles.label}>{t('health.labels.date')}</Text>
                    <TextInput
                        style={styles.input}
                        value={date}
                        onChangeText={setDate}
                        placeholder="2023-01-01"
                    />

                    <Text style={styles.label}>{t('health.labels.due_date')}</Text>
                    <TextInput
                        style={styles.input}
                        value={nextDueDate}
                        onChangeText={setNextDueDate}
                        placeholder="2024-01-01"
                    />

                    {/* REMINDER OPTIONS */}
                    {nextDueDate !== '' && (
                        <View style={styles.remindersSection}>
                            <Text style={styles.label}>Smart Reminders</Text>
                            <View style={styles.reminderRow}>
                                <TouchableOpacity 
                                    style={[styles.chip, remind7Days && styles.chipActive]} 
                                    onPress={() => setRemind7Days(!remind7Days)}
                                >
                                    <Text style={[styles.chipText, remind7Days && styles.chipTextActive]}>7 Days Before</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.chip, remind1Day && styles.chipActive]} 
                                    onPress={() => setRemind1Day(!remind1Day)}
                                >
                                    <Text style={[styles.chipText, remind1Day && styles.chipTextActive]}>1 Day Before</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.customReminderRow}>
                                <Text style={styles.subLabel}>Custom (days before):</Text>
                                <TextInput
                                    style={styles.smallInput}
                                    value={customReminderDays}
                                    onChangeText={setCustomReminderDays}
                                    keyboardType="numeric"
                                    placeholder="e.g. 14"
                                />
                            </View>
                        </View>
                    )}

                    <Text style={styles.label}>{t('health.labels.notes')}</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={4}
                        placeholder={t('health.labels.placeholder_notes')}
                    />

                    <TouchableOpacity
                        style={[styles.submitBtn, isSubmitting && styles.disabledBtn]}
                        onPress={submitRecord}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.submitText}>{isSubmitting ? t('common.saving') : t('common.save')}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    content: { padding: SPACING.lg },
    label: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 5, marginTop: 10 },
    subLabel: { fontSize: 14, color: COLORS.textSecondary },
    pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fff' },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, backgroundColor: '#fff', fontSize: 16 },
    smallInput: { borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 8, backgroundColor: '#fff', fontSize: 14, width: 60, marginLeft: 10 },
    textArea: { height: 100, textAlignVertical: 'top' },
    remindersSection: { marginTop: 15, padding: 15, backgroundColor: '#F5F5F5', borderRadius: 12 },
    reminderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
    customReminderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#EEE', borderWhidth: 1, borderColor: '#DDD' },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 12, color: COLORS.textSecondary },
    chipTextActive: { color: '#FFF', fontWeight: 'bold' },
    submitBtn: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 30 },
    disabledBtn: { opacity: 0.7 },
    submitText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' }
});
