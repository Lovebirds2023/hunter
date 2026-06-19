import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING, SIZES } from '../constants/theme';

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('App render error:', error, info);
    }

    handleRetry = () => {
        this.setState({ error: null });
    };

    handleReload = () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.reload();
            return;
        }
        this.handleRetry();
    };

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <View style={styles.container}>
                <View style={styles.card}>
                    <Text style={styles.title}>Something needs attention</Text>
                    <Text style={styles.message}>
                        This page hit an unexpected problem instead of loading. Please try again.
                    </Text>
                    {__DEV__ && (
                        <Text style={styles.debugText} numberOfLines={4}>
                            {this.state.error?.message || String(this.state.error)}
                        </Text>
                    )}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.secondaryButton} onPress={this.handleRetry}>
                            <Text style={styles.secondaryButtonText}>Try Again</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryButton} onPress={this.handleReload}>
                            <Text style={styles.primaryButtonText}>Reload App</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
        backgroundColor: COLORS.background || '#F8F8F8',
    },
    card: {
        width: '100%',
        maxWidth: 480,
        borderRadius: SIZES.radius,
        padding: SPACING.xl,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: 'rgba(75,0,130,0.12)',
    },
    title: {
        color: COLORS.primary,
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    message: {
        color: COLORS.textSecondary,
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
    },
    debugText: {
        marginTop: SPACING.md,
        color: COLORS.error,
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: SPACING.lg,
    },
    primaryButton: {
        flex: 1,
        borderRadius: 24,
        backgroundColor: COLORS.primary,
        paddingVertical: 13,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: COLORS.white,
        fontWeight: '900',
    },
    secondaryButton: {
        flex: 1,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingVertical: 13,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: COLORS.primary,
        fontWeight: '900',
    },
});

export default AppErrorBoundary;
