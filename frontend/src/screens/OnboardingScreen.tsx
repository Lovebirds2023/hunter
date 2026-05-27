import React, { useState, useRef, useContext } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Dimensions, ScrollView, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { AuthContext } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const SLIDE_CONFIG = [
    { icon: 'paw', color: COLORS.primary },
    { icon: 'medkit', color: '#4CAF50' },
    { icon: 'cart', color: '#FF9800' },
    { icon: 'map', color: '#E91E63' },
    { icon: 'chatbubbles', color: '#9C27B0' },
    { icon: 'calendar', color: '#F44336' }
];

export const OnboardingScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { userToken } = useContext(AuthContext);
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<ScrollView>(null);

    const handleNext = () => {
        if (currentIndex < SLIDE_CONFIG.length - 1) {
            scrollRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
            setCurrentIndex(currentIndex + 1);
        } else {
            if (userToken) {
                navigation.goBack();
            } else {
                navigation.navigate('Register');
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                    const x = e.nativeEvent.contentOffset.x;
                    setCurrentIndex(Math.round(x / width));
                }}
                scrollEventThrottle={16}
            >
                {SLIDE_CONFIG.map((slide, index) => (
                    <View key={index} style={styles.slide}>
                        <View style={[styles.iconContainer, { backgroundColor: slide.color + '15' }]}>
                            <Ionicons name={slide.icon as any} size={80} color={slide.color} />
                        </View>
                        <Text style={styles.title}>{t(`onboarding.slides.${index}.title`)}</Text>
                        <Text style={styles.description}>{t(`onboarding.slides.${index}.description`)}</Text>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.footer}>
                {/* Pagination Dots */}
                <View style={styles.pagination}>
                    {SLIDE_CONFIG.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === currentIndex ? styles.activeDot : null
                            ]}
                        />
                    ))}
                </View>

                {/* Primary Action Button */}
                <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
                    <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryDark]}
                        style={styles.gradient}
                    >
                        <Text style={styles.btnText}>
                            {currentIndex === SLIDE_CONFIG.length - 1 
                                ? (userToken ? t('common.ok') : t('onboarding.start')) 
                                : t('onboarding.next')}
                        </Text>
                        <Ionicons name={currentIndex === SLIDE_CONFIG.length - 1 && userToken ? "checkmark" : "arrow-forward"} size={20} color="white" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    topActions: {
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        alignItems: 'flex-end',
    },
    skipText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '600' },
    slide: {
        width,
        paddingHorizontal: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 160,
        height: 160,
        borderRadius: 80,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.primary,
        textAlign: 'center',
        marginBottom: 20,
    },
    description: {
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    footer: {
        paddingHorizontal: 40,
        paddingBottom: 50,
        alignItems: 'center',
    },
    pagination: {
        flexDirection: 'row',
        marginBottom: 30,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 5,
    },
    activeDot: {
        width: 30,
        backgroundColor: COLORS.primary,
    },
    nextBtn: {
        width: '100%',
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
    gradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    btnText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});
