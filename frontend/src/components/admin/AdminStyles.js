import { StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ─── Admin Color Palette ─── */
export const ADMIN_COLORS = {
    // Core brand
    primary: COLORS.primary,       // #4B0082 Deep Purple
    accent: COLORS.accent,         // #FFD700 Gold
    bg: COLORS.background,         // Light background
    surface: '#F8F9FA',            // Card surface
    surfaceLight: '#FFFFFF',       // Elevated card surface
    surfaceBorder: '#EAEAEA',      // Subtle borders

    // Status colors  
    success: '#00D68F',
    successBg: 'rgba(0,214,143,0.12)',
    warning: '#FFB347',
    warningBg: 'rgba(255,179,71,0.12)',
    danger: '#FF6B6B',
    dangerBg: 'rgba(255,107,107,0.12)',
    info: '#6C63FF',
    infoBg: 'rgba(108,99,255,0.12)',

    // Text
    textPrimary: COLORS.text,
    textSecondary: COLORS.textSecondary,
    textMuted: '#888888',

    // Charts
    chart1: '#6C63FF',  // Purple
    chart2: '#00D68F',  // Green
    chart3: '#FFB347',  // Orange
    chart4: '#FF6B6B',  // Red
    chart5: '#38BDF8',  // Sky blue  
    chart6: '#FFD700',  // Gold
};

/* ─── Shared Styles ─── */
export const adminStyles = StyleSheet.create({
    /* Layout */
    screen: {
        flex: 1,
        backgroundColor: ADMIN_COLORS.bg,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 30,
    },

    /* Header */
    header: {
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: ADMIN_COLORS.bg,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerGreeting: {
        fontSize: 14,
        color: ADMIN_COLORS.textSecondary,
        marginBottom: 2,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: ADMIN_COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    headerBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: ADMIN_COLORS.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: ADMIN_COLORS.danger,
        borderWidth: 2,
        borderColor: ADMIN_COLORS.bg,
    },

    /* Section Headers */
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 28,
        marginBottom: 14,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: ADMIN_COLORS.textPrimary,
        letterSpacing: -0.3,
    },
    sectionAction: {
        fontSize: 13,
        color: ADMIN_COLORS.accent,
        fontWeight: '600',
    },

    /* Cards */
    card: {
        backgroundColor: ADMIN_COLORS.surface,
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: ADMIN_COLORS.surfaceBorder,
    },
    cardElevated: {
        backgroundColor: ADMIN_COLORS.surfaceLight,
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: ADMIN_COLORS.surfaceBorder,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },

    /* Stat Cards (KPI) */
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    statCard: {
        width: (SCREEN_WIDTH - 48) / 2,
        backgroundColor: ADMIN_COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: ADMIN_COLORS.surfaceBorder,
    },
    statIconRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statTrend: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    statTrendText: {
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 2,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: ADMIN_COLORS.textPrimary,
        letterSpacing: -1,
    },
    statLabel: {
        fontSize: 12,
        color: ADMIN_COLORS.textSecondary,
        marginTop: 4,
    },

    /* List Cards */
    listCard: {
        backgroundColor: ADMIN_COLORS.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: ADMIN_COLORS.surfaceBorder,
    },
    listCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    listCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: ADMIN_COLORS.textPrimary,
    },
    listCardSub: {
        fontSize: 12,
        color: ADMIN_COLORS.textSecondary,
        marginTop: 2,
    },

    /* Avatar */
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 17,
    },

    /* Badges */
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },

    /* Buttons */
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ADMIN_COLORS.accent,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 12,
    },
    primaryButtonText: {
        color: ADMIN_COLORS.bg,
        fontWeight: '700',
        fontSize: 15,
        marginLeft: 8,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ADMIN_COLORS.dangerBg,
        paddingVertical: 12,
        borderRadius: 10,
    },
    dangerButtonText: {
        color: ADMIN_COLORS.danger,
        fontWeight: '700',
        fontSize: 14,
        marginLeft: 6,
    },
    actionRow: {
        flexDirection: 'row',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: ADMIN_COLORS.surfaceBorder,
        gap: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: ADMIN_COLORS.surfaceLight,
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
    },

    /* Search Bar */
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ADMIN_COLORS.surface,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 46,
        borderWidth: 1,
        borderColor: ADMIN_COLORS.surfaceBorder,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: ADMIN_COLORS.textPrimary,
        marginLeft: 10,
    },

    /* Filter Chips */
    filterRow: {
        flexDirection: 'row',
        marginBottom: 14,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: ADMIN_COLORS.surface,
        borderWidth: 1,
        borderColor: ADMIN_COLORS.surfaceBorder,
    },
    filterChipActive: {
        backgroundColor: ADMIN_COLORS.accent,
        borderColor: ADMIN_COLORS.accent,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: ADMIN_COLORS.textSecondary,
    },
    filterChipTextActive: {
        color: ADMIN_COLORS.bg,
    },

    /* Form Elements */
    inputLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: ADMIN_COLORS.textSecondary,
        marginTop: 14,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputContainer: {
        backgroundColor: ADMIN_COLORS.surfaceLight,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: ADMIN_COLORS.surfaceBorder,
        paddingHorizontal: 14,
    },
    textInput: {
        height: 48,
        fontSize: 14,
        color: ADMIN_COLORS.textPrimary,
    },

    /* Empty State */
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        fontSize: 15,
        color: ADMIN_COLORS.textMuted,
        marginTop: 12,
        textAlign: 'center',
    },

    /* Loading */
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },

    /* Financials row */
    financialRow: {
        flexDirection: 'row',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: ADMIN_COLORS.surfaceBorder,
    },
    financialItem: {
        flex: 1,
        alignItems: 'center',
    },
    financialLabel: {
        fontSize: 11,
        color: ADMIN_COLORS.textMuted,
    },
    financialValue: {
        fontSize: 15,
        fontWeight: '700',
        color: ADMIN_COLORS.textPrimary,
        marginTop: 2,
    },
});

/* ─── Grid Home Styles ─── */
export const gridStyles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    gridCard: {
        width: (SCREEN_WIDTH - 48) / 2,
        backgroundColor: ADMIN_COLORS.surface,
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: ADMIN_COLORS.surfaceBorder,
        alignItems: 'center',
    },
    gridIconBg: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    gridLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: ADMIN_COLORS.textPrimary,
        textAlign: 'center',
    },
    gridSub: {
        fontSize: 12,
        color: ADMIN_COLORS.textSecondary,
        marginTop: 3,
        textAlign: 'center',
    },
    gridBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: ADMIN_COLORS.danger,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    gridBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
    },
});
