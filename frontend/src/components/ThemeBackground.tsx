import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Emojis for the falling background animation
const EMOJIS = ['🐾', '🦴', '🐶', '🎾', '🐕'];

const FallingItem = () => {
    const translateY = useRef(new Animated.Value(-50)).current;
    const rotate = useRef(new Animated.Value(0)).current;

    // Fixed random seeds mapped for individual items so they don't jump around on re-renders
    const startX = useRef(Math.random() * width).current;
    const duration = useRef(15000 + Math.random() * 20000).current; // very slow, 15-35s
    const delay = useRef(Math.random() * 10000).current;
    const emoji = useRef(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]).current;
    const size = useRef(16 + Math.random() * 16).current;
    const itemOpacity = useRef(0.04 + Math.random() * 0.05).current; // Faint, ~0.04-0.09
    const isClockwise = useRef(Math.random() > 0.5 ? 1 : -1).current;

    useEffect(() => {
        const fallAnimation = Animated.loop(
            Animated.timing(translateY, {
                toValue: height + 100,
                duration: duration,
                delay: delay,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );

        const spinAnimation = Animated.loop(
            Animated.timing(rotate, {
                toValue: 1,
                duration: duration * 0.8,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );

        fallAnimation.start();
        spinAnimation.start();

        return () => {
            fallAnimation.stop();
            spinAnimation.stop();
        };
    }, []);

    const spin = rotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', isClockwise > 0 ? '360deg' : '-360deg']
    });

    return (
        <Animated.Text
            style={{
                position: 'absolute',
                left: startX,
                fontSize: size,
                opacity: itemOpacity,
                transform: [
                    { translateY: translateY },
                    { rotate: spin }
                ],
            }}
        >
            {emoji}
        </Animated.Text>
    );
};

const AnimatedDrops = () => {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Limit to 12 items so it is sparse and not distracting */}
            {Array.from({ length: 12 }).map((_, i) => (
                <FallingItem key={i} />
            ))}
        </View>
    );
};

// Decorative paw prints scattered across the background
const PawOverlay = () => (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {/* Scattered paw prints at various positions and opacities */}
        {[
            { x: 40, y: 80, scale: 0.6, opacity: 0.08 },
            { x: width - 80, y: 150, scale: 0.8, opacity: 0.06 },
            { x: 60, y: 320, scale: 0.5, opacity: 0.07 },
            { x: width - 50, y: 450, scale: 0.7, opacity: 0.05 },
            { x: width / 2 - 20, y: 200, scale: 0.4, opacity: 0.06 },
            { x: 30, y: 550, scale: 0.9, opacity: 0.04 },
            { x: width - 100, y: 650, scale: 0.5, opacity: 0.07 },
            { x: width / 2 + 40, y: 500, scale: 0.6, opacity: 0.05 },
            { x: 100, y: 750, scale: 0.7, opacity: 0.06 },
            { x: width - 60, y: 850, scale: 0.4, opacity: 0.08 },
        ].map((paw, i) => (
            <React.Fragment key={i}>
                {/* Main pad */}
                <Circle cx={paw.x} cy={paw.y + 12 * paw.scale} r={10 * paw.scale} fill="white" opacity={paw.opacity} />
                {/* Toe pads */}
                <Circle cx={paw.x - 8 * paw.scale} cy={paw.y - 4 * paw.scale} r={5 * paw.scale} fill="white" opacity={paw.opacity} />
                <Circle cx={paw.x + 8 * paw.scale} cy={paw.y - 4 * paw.scale} r={5 * paw.scale} fill="white" opacity={paw.opacity} />
                <Circle cx={paw.x - 14 * paw.scale} cy={paw.y + 4 * paw.scale} r={4.5 * paw.scale} fill="white" opacity={paw.opacity} />
                <Circle cx={paw.x + 14 * paw.scale} cy={paw.y + 4 * paw.scale} r={4.5 * paw.scale} fill="white" opacity={paw.opacity} />
            </React.Fragment>
        ))}
        {/* Decorative golden accent circles */}
        <Circle cx={width - 30} cy={100} r={60} fill="#FFD700" opacity={0.04} />
        <Circle cx={40} cy={height - 150} r={80} fill="#FFD700" opacity={0.03} />
        <Circle cx={width / 2} cy={height / 2} r={120} fill="#FFD700" opacity={0.02} />
    </Svg>
);

export const ThemeBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#2D0050', '#4B0082', '#310062', '#1A0033']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
                style={StyleSheet.absoluteFill}
            />
            <PawOverlay />
            <AnimatedDrops />
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

export default ThemeBackground;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
});
