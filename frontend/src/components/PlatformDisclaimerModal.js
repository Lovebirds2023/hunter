import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const DISCLAIMER_KEY = 'ld360_disclaimer_accepted_v1';

/**
 * PlatformDisclaimerModal
 * Shows once on first launch, never again.
 * Positions app as a connection/coordination platform — NOT a medical provider.
 * Required for Google Play and Apple App Store compliance.
 */
export const PlatformDisclaimerModal = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        checkIfAccepted();
    }, []);

    const checkIfAccepted = async () => {
        try {
            const accepted = await AsyncStorage.getItem(DISCLAIMER_KEY);
            if (!accepted) {
                setVisible(true);
            }
        } catch {
            // If AsyncStorage fails, don't show the modal — app must not crash
        }
    };

    const handleAccept = async () => {
        try {
            await AsyncStorage.setItem(DISCLAIMER_KEY, 'true');
        } catch {
            // Silently ignore — user has tapped accept, proceed regardless
        }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => {}} // Prevent hardware back from dismissing
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Logo / Icon */}
                    <View style={styles.iconRow}>
                        <View style={styles.iconBg}>
                            <Ionicons name="paw" size={36} color={COLORS.primary} />
                        </View>
                    </View>

                    <Text style={styles.title}>Welcome to Lovedogs 360</Text>
                    <Text style={styles.subtitle}>Before you start, please read this</Text>

                    <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
                        {/* Main disclaimer */}
                        <View style={styles.disclaimerBox}>
                            <Ionicons name="information-circle" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.disclaimerText}>
                                Lovedogs 360 is a <Text style={styles.bold}>connection and coordination platform</Text> that links dog owners with independently licensed professionals and community members.
                            </Text>
                        </View>

                        <View style={styles.disclaimerBox}>
                            <Ionicons name="medkit-outline" size={20} color="#D32F2F" style={{ marginRight: 8 }} />
                            <Text style={styles.disclaimerText}>
                                <Text style={styles.bold}>This app does not provide veterinary diagnosis, medical advice, prescriptions, or treatment.</Text> It serves as a platform to connect users with independently licensed professionals who operate outside the app.
                            </Text>
                        </View>

                        <View style={styles.disclaimerBox}>
                            <Ionicons name="shield-checkmark-outline" size={20} color="#388E3C" style={{ marginRight: 8 }} />
                            <Text style={styles.disclaimerText}>
                                All veterinary professionals listed on the platform are independently licensed and verified. Always consult a qualified veterinarian directly for any medical concerns about your pet.
                            </Text>
                        </View>

                        <View style={styles.disclaimerBox}>
                            <Ionicons name="people-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.disclaimerText}>
                                Community features are for peer support and sharing. They are not a substitute for professional veterinary care.
                            </Text>
                        </View>
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={handleAccept}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.acceptBtnText}>I Understand — Continue</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxHeight: '88%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 20,
    },
    iconRow: {
        alignItems: 'center',
        marginBottom: 16,
    },
    iconBg: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.primary,
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#888',
        textAlign: 'center',
        marginBottom: 20,
    },
    bodyScroll: {
        maxHeight: 320,
        marginBottom: 20,
    },
    disclaimerBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    disclaimerText: {
        flex: 1,
        fontSize: 13,
        color: '#444',
        lineHeight: 20,
    },
    bold: {
        fontWeight: 'bold',
        color: '#222',
    },
    acceptBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    acceptBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.3,
    },
});
