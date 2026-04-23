import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

export const EventCategoryFilter = ({ categories, selectedCategory, onSelect }) => {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {categories.map((category) => (
                <TouchableOpacity
                    key={category}
                    style={[
                        styles.chip,
                        selectedCategory === category && styles.selectedChip
                    ]}
                    onPress={() => onSelect(category)}
                >
                    <Text
                        style={[
                            styles.chipText,
                            selectedCategory === category && styles.selectedChipText
                        ]}
                    >
                        {category}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        gap: 10,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    selectedChip: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    chipText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '600',
    },
    selectedChipText: {
        color: COLORS.primaryDark,
        fontWeight: '700',
    },
});
