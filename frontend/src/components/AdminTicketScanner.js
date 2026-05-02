import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { COLORS, SHADOWS } from '../constants/theme';

// Only use CameraView on native
let Camera = null;
let CameraView = null;
if (Platform.OS !== 'web') {
    const ExpoCamera = require('expo-camera');
    Camera = ExpoCamera.Camera;
    CameraView = ExpoCamera.CameraView;
}

export const AdminTicketScanner = () => {
    const [hasPermission, setHasPermission] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [ticketData, setTicketData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const getBarCodeScannerPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };

        getBarCodeScannerPermissions();
    }, []);

    const handleBarCodeScanned = async ({ type, data }) => {
        setScanned(true);
        setLoading(true);
        try {
            // data should be the ticket_token
            const res = await client.get(`/admin/verify-ticket?token=${data}`);
            setTicketData({ token: data, ...res.data });
        } catch (e) {
            Alert.alert("Invalid Ticket", "This QR code is not a valid event ticket.");
            setTicketData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        if (!ticketData || !ticketData.token) return;
        setLoading(true);
        try {
            const res = await client.post(`/admin/check-in-ticket?token=${ticketData.token}`);
            Alert.alert("Success", "Attendee has been checked in!");
            setTicketData(prev => ({ ...prev, checked_in: true, check_in_time: res.data.time }));
        } catch (e) {
            Alert.alert("Error", e?.response?.data?.detail || "Failed to check in");
        } finally {
            setLoading(false);
        }
    };

    if (Platform.OS === 'web') {
        // Web: show manual token entry form
        const [manualToken, setManualToken] = useState('');

        const handleManualVerify = async () => {
            if (!manualToken.trim()) {
                Alert.alert('Error', 'Please enter a ticket token.');
                return;
            }
            setLoading(true);
            setScanned(true);
            try {
                const res = await client.get(`/admin/verify-ticket?token=${manualToken.trim()}`);
                setTicketData({ token: manualToken.trim(), ...res.data });
            } catch (e) {
                Alert.alert('Invalid Ticket', 'This token is not a valid event ticket.');
                setTicketData(null);
                setScanned(false);
            } finally {
                setLoading(false);
            }
        };

        return (
            <View style={styles.container}>
                <View style={styles.webScannerContainer}>
                    <Ionicons name="qr-code-outline" size={64} color={COLORS.accent} />
                    <Text style={styles.webScannerTitle}>Ticket Verification</Text>
                    <Text style={styles.webScannerSub}>Camera scanning is available on the mobile app. Enter the ticket token manually below.</Text>
                    <TextInput
                        style={styles.manualInput}
                        placeholder="Paste ticket token here..."
                        placeholderTextColor="#999"
                        value={manualToken}
                        onChangeText={setManualToken}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TouchableOpacity style={styles.verifyBtn} onPress={handleManualVerify}>
                        <Text style={styles.verifyBtnText}>Verify Ticket</Text>
                    </TouchableOpacity>
                    {scanned && (
                        <TouchableOpacity style={[styles.verifyBtn, { backgroundColor: '#555', marginTop: 10 }]} onPress={() => { setScanned(false); setTicketData(null); setManualToken(''); }}>
                            <Text style={styles.verifyBtnText}>Clear / Scan Another</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" color={COLORS.primary} />}

                {ticketData && !loading && (
                    <View style={[styles.resultCard, ticketData.checked_in ? styles.usedCard : styles.validCard]}>
                        <View style={styles.resultHeader}>
                            <Ionicons name={ticketData.checked_in ? 'close-circle' : 'checkmark-circle'} size={32} color={ticketData.checked_in ? '#FF6B6B' : '#00C896'} />
                            <Text style={styles.resultTitle}>{ticketData.checked_in ? 'TICKET USED' : 'VALID TICKET'}</Text>
                        </View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Attendee:</Text><Text style={styles.detailValue}>{ticketData.user_name}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Event:</Text><Text style={styles.detailValue}>{ticketData.event_title}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>Role:</Text><Text style={[styles.detailValue, { textTransform: 'capitalize' }]}>{ticketData.role}</Text></View>
                        {ticketData.checked_in ? (
                            <Text style={styles.usedText}>Checked in at: {new Date(ticketData.check_in_time).toLocaleTimeString()}</Text>
                        ) : (
                            <TouchableOpacity style={styles.checkinBtn} onPress={handleCheckIn}>
                                <Text style={styles.checkinBtnText}>Confirm Check-In</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    }

    if (hasPermission === null) {
        return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }
    if (hasPermission === false) {
        return <View style={styles.center}><Text>No access to camera</Text></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.scannerContainer}>
                <CameraView
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                    }}
                    style={StyleSheet.absoluteFillObject}
                />
                
                {scanned && (
                    <View style={styles.overlay}>
                        <TouchableOpacity style={styles.rescanBtn} onPress={() => { setScanned(false); setTicketData(null); }}>
                            <Ionicons name="scan-outline" size={20} color="#fff" />
                            <Text style={styles.rescanText}>Tap to Scan Again</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" color={COLORS.primary} />}

            {ticketData && !loading && (
                <View style={[styles.resultCard, ticketData.checked_in ? styles.usedCard : styles.validCard]}>
                    <View style={styles.resultHeader}>
                        <Ionicons name={ticketData.checked_in ? "close-circle" : "checkmark-circle"} size={32} color={ticketData.checked_in ? "#FF6B6B" : "#00C896"} />
                        <Text style={styles.resultTitle}>{ticketData.checked_in ? "TICKET USED" : "VALID TICKET"}</Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Attendee:</Text>
                        <Text style={styles.detailValue}>{ticketData.user_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Event:</Text>
                        <Text style={styles.detailValue}>{ticketData.event_title}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Role:</Text>
                        <Text style={[styles.detailValue, { textTransform: 'capitalize' }]}>{ticketData.role}</Text>
                    </View>
                    
                    {ticketData.checked_in ? (
                        <Text style={styles.usedText}>Checked in at: {new Date(ticketData.check_in_time).toLocaleTimeString()}</Text>
                    ) : (
                        <TouchableOpacity style={styles.checkinBtn} onPress={handleCheckIn}>
                            <Text style={styles.checkinBtnText}>Confirm Check-In</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, paddingBottom: 40 },
    scannerContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#000',
        marginBottom: 20,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rescanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 30,
        gap: 8,
    },
    rescanText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    resultCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        ...SHADOWS.medium,
        borderWidth: 2,
    },
    validCard: { borderColor: '#00C896' },
    usedCard: { borderColor: '#FF6B6B' },
    resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
    resultTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 14, color: COLORS.textSecondary },
    detailValue: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
    checkinBtn: {
        backgroundColor: COLORS.primary,
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 15,
    },
    checkinBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    usedText: {
        color: '#FF6B6B',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 15,
    },
    webScannerContainer: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#f8f8f8',
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    webScannerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary, marginTop: 16, marginBottom: 8 },
    webScannerSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
    manualInput: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        backgroundColor: '#fff',
        color: '#333',
        marginBottom: 12,
    },
    verifyBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
    },
    verifyBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
