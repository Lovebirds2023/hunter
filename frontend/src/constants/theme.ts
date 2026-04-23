export const COLORS = {
    primary: '#4B0082', // Deep Purple
    primaryDark: '#310062',
    accent: '#FFD700',  // Gold
    accentDark: '#DAA520', // Goldenrod
    background: '#FFFFFF', // White
    text: '#1A1A1A',
    textSecondary: '#444444', // Darker gray for better contrast
    white: '#FFFFFF',
    gold: '#FFD700',
    error: '#FF0000',
    secondary: '#1A73E8', // Complementary blue for accents
    shadow: 'rgba(75, 0, 130, 0.2)',
    gray: '#CCCCCC',
};

export const SHADOWS = {
    small: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 2,
    },
    medium: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};

export const SIZES = {
    radius: 12,
    buttonHeight: 56,
    inputHeight: 56,
};
