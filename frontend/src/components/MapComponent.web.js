import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ style }) => (
    <View style={[style, styles.placeholder]}>
        <Text style={styles.text}>Map View is not available on Web</Text>
        <Text style={styles.subtext}>Native maps use features not supported in the browser.</Text>
    </View>
);

export const Marker = () => null;
export const Callout = () => null;
export const Circle = () => null;

const styles = StyleSheet.create({
    placeholder: {
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    text: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtext: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    }
});

export default MapView;
