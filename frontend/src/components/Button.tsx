import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, SPACING, SHADOWS } from '../constants/theme';

interface ButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    variant?: 'primary' | 'outline' | 'gold';
}

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    loading,
    disabled,
    style,
    textStyle,
    variant = 'primary'
}) => {
    const isPrimary = variant === 'primary';
    const isOutline = variant === 'outline';
    const isGold = variant === 'gold';

    const getColors = (): [string, string, ...string[]] => {
        if (isPrimary) return [COLORS.primary, COLORS.primaryDark];
        if (isGold) return [COLORS.accent, COLORS.accentDark];
        return [COLORS.white, COLORS.white]; // Default to white if somehow reached
    };

    const ButtonContent = () => (
        <>
            {loading ? (
                <ActivityIndicator color={isOutline ? COLORS.primary : COLORS.white} />
            ) : (
                <Text style={[
                    styles.text,
                    isOutline ? styles.outlineText : styles.primaryText,
                    isGold && styles.goldText,
                    textStyle
                ]}>
                    {title}
                </Text>
            )}
        </>
    );

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
            style={[
                styles.buttonContainer,
                isOutline && styles.outlineButton,
                !isOutline && SHADOWS.medium,
                disabled && styles.disabled,
                style
            ]}
        >
            {!isOutline ? (
                <LinearGradient
                    colors={getColors()}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradient}
                >
                    <ButtonContent />
                </LinearGradient>
            ) : (
                <ButtonContent />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    buttonContainer: {
        height: SIZES.buttonHeight,
        borderRadius: SIZES.radius,
        marginVertical: SPACING.sm,
        overflow: 'hidden',
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderColor: COLORS.primary,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
        ...Platform.select({
            ios: { fontFamily: 'System' },
            android: { fontFamily: 'sans-serif-medium' },
        }),
    },
    primaryText: {
        color: COLORS.white,
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    outlineText: {
        color: COLORS.primary,
    },
    goldText: {
        color: COLORS.primary, // Contrast on gold
    }
});
