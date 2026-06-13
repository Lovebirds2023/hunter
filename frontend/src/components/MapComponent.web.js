import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ style }) => {
    const { t } = useTranslation();
    return (
        <View style={[style, styles.placeholder]}>
            <Text style={styles.text}>{t('map.web_unavailable')}</Text>
            <Text style={styles.subtext}>{t('map.web_subtitle')}</Text>
        </View>
    );
};

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
