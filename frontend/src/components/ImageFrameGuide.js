import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';

export const IMAGE_FRAME_RATIOS = {
    '16:9': { key: '16:9', label: '16:9', width: 16, height: 9, hint: 'wide banner' },
    '4:3': { key: '4:3', label: '4:3', width: 4, height: 3, hint: 'case photo' },
    '3:2': { key: '3:2', label: '3:2', width: 3, height: 2, hint: 'listing card' },
    '1:1': { key: '1:1', label: '1:1', width: 1, height: 1, hint: 'square' },
    '2:3': { key: '2:3', label: '2:3', width: 2, height: 3, hint: 'portrait' },
};

export const getImageFrameRatio = (ratioKey, fallback = '1:1') => (
    IMAGE_FRAME_RATIOS[ratioKey] || IMAGE_FRAME_RATIOS[fallback] || IMAGE_FRAME_RATIOS['1:1']
);

export const getImagePickerAspect = (ratioKey, fallback = '1:1') => {
    const ratio = getImageFrameRatio(ratioKey, fallback);
    return [ratio.width, ratio.height];
};

export const getImageFrameAspectRatio = (ratioKey, fallback = '1:1') => {
    const ratio = getImageFrameRatio(ratioKey, fallback);
    return ratio.width / ratio.height;
};

export const ImageFrameGuide = ({
    title = 'Image frame',
    guidance = 'Choose the frame before selecting an image. On phones, use the editor to zoom and move the image so it fits.',
    ratios = ['1:1', '16:9', '2:3'],
    selectedRatio = '1:1',
    onSelectRatio,
    dark = false,
}) => {
    const textColor = dark ? 'rgba(255,255,255,0.82)' : COLORS.text;
    const mutedColor = dark ? 'rgba(255,255,255,0.58)' : COLORS.textSecondary;
    const surfaceColor = dark ? 'rgba(255,255,255,0.07)' : '#F7F8FC';
    const borderColor = dark ? 'rgba(255,215,0,0.22)' : '#E2E6F0';

    return (
        <View style={[styles.container, { backgroundColor: surfaceColor, borderColor }]}>
            <View style={styles.headerRow}>
                <View style={styles.headerTitleRow}>
                    <Ionicons name="crop-outline" size={18} color={COLORS.accent} />
                    <Text style={[styles.title, { color: textColor }]}>{title}</Text>
                </View>
                <Text style={[styles.recommendation, { color: mutedColor }]}>
                    Recommended: {ratios.join(' / ')}
                </Text>
            </View>

            <View style={styles.ratioRow}>
                {ratios.map((ratioKey) => {
                    const ratio = getImageFrameRatio(ratioKey);
                    const isActive = selectedRatio === ratio.key;
                    return (
                        <TouchableOpacity
                            key={ratio.key}
                            style={[
                                styles.ratioChip,
                                { borderColor: isActive ? COLORS.accent : borderColor },
                                isActive && styles.ratioChipActive,
                            ]}
                            onPress={() => onSelectRatio?.(ratio.key)}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.ratioLabel, isActive && styles.ratioLabelActive]}>
                                {ratio.label}
                            </Text>
                            <Text style={[styles.ratioHint, { color: isActive ? COLORS.primary : mutedColor }]}>
                                {ratio.hint}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={[styles.guidance, { color: mutedColor }]}>
                {guidance}
                {Platform.OS === 'web'
                    ? ' If your browser does not show a crop editor, prepare the image in this ratio before uploading.'
                    : ''}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: SPACING.md,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 1,
    },
    title: {
        fontSize: 13,
        fontWeight: '800',
    },
    recommendation: {
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'right',
        flexShrink: 1,
    },
    ratioRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    ratioChip: {
        minWidth: 74,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255,255,255,0.65)',
    },
    ratioChipActive: {
        backgroundColor: COLORS.accent,
    },
    ratioLabel: {
        fontSize: 14,
        fontWeight: '900',
        color: COLORS.primary,
        textAlign: 'center',
    },
    ratioLabelActive: {
        color: COLORS.primary,
    },
    ratioHint: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
        textAlign: 'center',
    },
    guidance: {
        fontSize: 11,
        lineHeight: 16,
        marginTop: 10,
    },
});
