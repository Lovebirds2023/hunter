import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

const EXPORT_TYPES = [
    { id: 'users', label: 'Users', icon: 'people', description: 'All registered users with roles and contact info' },
    { id: 'orders', label: 'Orders', icon: 'cart', description: 'Financial transactions, status, and buyer details' },
    { id: 'registrations', label: 'Registrations', icon: 'document-text', description: 'Complete attendee list and form responses' },
    { id: 'events', label: 'Events', icon: 'calendar', description: 'All services/events with stats and organizer info' },
    { id: 'dogs', label: 'Dog Registry', icon: 'paw', description: 'Dog database with breed, owner, and health stats' },
    { id: 'cases', label: 'Case Reports', icon: 'alert-circle', description: 'Community support and incident reports' },
    { id: 'community', label: 'Community Posts', icon: 'chatbubbles', description: 'All social feed content and engagement metrics' },
    { id: 'support', label: 'Support Tickets', icon: 'headset', description: 'Platform support history and status logs' },
];

export const AdminExportTab = ({ onBack }) => {
    const [exportingId, setExportingId] = useState(null);

    const handleExport = async (type) => {
        setExportingId(type);
        try {
            // Updated backend endpoint supports type query param
            const response = await client.get(`/admin/export?type=${type}`, {
                responseType: 'arraybuffer'
            });

            const fileName = `ld360_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            // Convert arraybuffer to base64 for Expo FileSystem
            const base64 = btoa(
                new Uint8Array(response.data)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
            });

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert('Success', `File saved to ${fileUri}`);
            }
        } catch (e) {
            console.error('Export error:', e);
            Alert.alert('Export Failed', 'There was an error generating the report.');
        } finally {
            setExportingId(null);
        }
    };

    return (
        <View style={s.screen}>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: ADMIN_COLORS.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 14 }}>
                        <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>Reporting Center</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>Export data for offline analysis</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
                <View style={[s.card, { marginTop: 10, padding: 16 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <View style={[s.statIconBg, { backgroundColor: `${ADMIN_COLORS.info}20` }]}>
                            <Ionicons name="download-outline" size={20} color={ADMIN_COLORS.info} />
                        </View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: ADMIN_COLORS.textPrimary }}>Quick Export</Text>
                            <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary }}>Choose a dataset to generate an XLSX report</Text>
                        </View>
                    </View>

                    <View style={{ gap: 12 }}>
                        {EXPORT_TYPES.map(item => (
                            <TouchableOpacity 
                                key={item.id}
                                style={[s.listCard, { backgroundColor: ADMIN_COLORS.surfaceLight, marginBottom: 0 }]}
                                onPress={() => handleExport(item.id)}
                                disabled={exportingId !== null}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[s.avatar, { width: 40, height: 40, backgroundColor: exportingId === item.id ? ADMIN_COLORS.accent : ADMIN_COLORS.surfaceBorder }]}>
                                        {exportingId === item.id ? (
                                            <ActivityIndicator size="small" color={ADMIN_COLORS.bg} />
                                        ) : (
                                            <Ionicons name={item.icon} size={18} color={ADMIN_COLORS.textSecondary} />
                                        )}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: ADMIN_COLORS.textPrimary }}>{item.label}</Text>
                                        <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>{item.description}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={ADMIN_COLORS.textMuted} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Info Card */}
                <View style={[s.card, { marginTop: 20, backgroundColor: `${ADMIN_COLORS.accent}10`, borderColor: `${ADMIN_COLORS.accent}30` }]}>
                    <Text style={{ color: ADMIN_COLORS.accent, fontSize: 13, fontWeight: '800', marginBottom: 6 }}>NOTE:</Text>
                    <Text style={{ color: ADMIN_COLORS.textSecondary, fontSize: 12, lineHeight: 18 }}>
                        All reports are generated in Microsoft Excel (.xlsx) format. Exporting large datasets may take a few moments. Ensure you have a stable network connection.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};
