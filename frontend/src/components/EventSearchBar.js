import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useTranslation } from 'react-i18next';

export const EventSearchBar = ({ value, onChangeText, onClear }) => {
    const { t } = useTranslation();

    return (
        <View style={styles.container}>
            <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" style={styles.icon} />
                <TextInput
                    style={styles.input}
                    placeholder={t('common.search')}
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={value}
                    onChangeText={onChangeText}
                    autoCapitalize="none"
                />
                {value.length > 0 && (
                    <TouchableOpacity onPress={onClear}>
                        <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: SIZES.radius,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: COLORS.white,
        fontSize: 16,
    },
});
