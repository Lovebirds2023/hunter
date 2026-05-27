import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING } from '../constants/theme';

const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'sw', name: 'Kiswahili' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'pt', name: 'Português' },
    { code: 'ar', name: 'العربية' },
    { code: 'zh', name: '中文' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'ja', name: '日本語' }
];

const LanguageSwitcher = () => {
    const { i18n, t } = useTranslation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    const currentLanguage = i18n.language;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{t('common.language') || 'Language'}:</Text>
            <View style={styles.grid}>
                {LANGUAGES.map((lang) => (
                    <TouchableOpacity
                        key={lang.code}
                        style={[
                            styles.langItem,
                            currentLanguage === lang.code && styles.activeItem,
                        ]}
                        onPress={() => changeLanguage(lang.code)}
                    >
                        <Text
                            style={[
                                styles.langText,
                                currentLanguage === lang.code && styles.activeText,
                            ]}
                        >
                            {lang.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: SPACING.md,
        width: '100%',
        paddingHorizontal: 10,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'flex-start',
    },
    langItem: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        minWidth: '22.5%', // 4 items per row approximately
        alignItems: 'center',
    },
    activeItem: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    langText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    activeText: {
        color: COLORS.white,
    },
});

export default LanguageSwitcher;
