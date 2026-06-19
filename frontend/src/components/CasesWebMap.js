import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { toCoordinateNumber } from '../utils/locationAccuracy';

const TILE_SIZE = 256;
const MIN_ZOOM = 4;
const MAX_ZOOM = 17;
const MAX_MERCATOR_LATITUDE = 85.05112878;
const NAIROBI_CENTER = { latitude: -1.286389, longitude: 36.817223 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toLatitude = (value) => {
    const latitude = toCoordinateNumber(value);
    return latitude === null ? null : clamp(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
};

const toLongitude = (value) => {
    const longitude = toCoordinateNumber(value);
    return longitude === null ? null : clamp(longitude, -180, 180);
};

const longitudeToTileX = (longitude, zoom) => ((longitude + 180) / 360) * (2 ** zoom);

const latitudeToTileY = (latitude, zoom) => {
    const latitudeRad = (latitude * Math.PI) / 180;
    const mercator = Math.log(Math.tan(latitudeRad) + (1 / Math.cos(latitudeRad)));
    return ((1 - (mercator / Math.PI)) / 2) * (2 ** zoom);
};

const tileXToLongitude = (tileX, zoom) => ((tileX / (2 ** zoom)) * 360) - 180;

const tileYToLatitude = (tileY, zoom) => {
    const mercator = Math.PI - ((2 * Math.PI * tileY) / (2 ** zoom));
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(mercator) - Math.exp(-mercator)));
};

const pixelsToCoordinates = (pixelX, pixelY, zoom) => {
    const tileCount = 2 ** zoom;
    const worldWidth = tileCount * TILE_SIZE;
    const wrappedPixelX = ((pixelX % worldWidth) + worldWidth) % worldWidth;
    const tileX = wrappedPixelX / TILE_SIZE;
    const tileY = clamp(pixelY / TILE_SIZE, 0, tileCount);

    return {
        latitude: tileYToLatitude(tileY, zoom),
        longitude: tileXToLongitude(tileX, zoom),
    };
};

const getReportCoordinates = (report) => {
    const latitude = toLatitude(report?.latitude);
    const longitude = toLongitude(report?.longitude);
    if (latitude === null || longitude === null) return null;
    return { latitude, longitude };
};

const getCenter = (reports, userLocation) => {
    const coordinates = reports.map(getReportCoordinates).filter(Boolean);

    if (coordinates.length > 0) {
        const totals = coordinates.reduce((acc, coord) => ({
            latitude: acc.latitude + coord.latitude,
            longitude: acc.longitude + coord.longitude,
        }), { latitude: 0, longitude: 0 });

        return {
            latitude: totals.latitude / coordinates.length,
            longitude: totals.longitude / coordinates.length,
        };
    }

    const userLatitude = toLatitude(userLocation?.latitude);
    const userLongitude = toLongitude(userLocation?.longitude);
    if (userLatitude !== null && userLongitude !== null) {
        return { latitude: userLatitude, longitude: userLongitude };
    }

    return NAIROBI_CENTER;
};

const getInitialZoom = (reports, compact) => {
    if (compact) return 15;

    const coordinates = reports.map(getReportCoordinates).filter(Boolean);
    if (coordinates.length < 2) return 12;

    const latitudes = coordinates.map((coord) => coord.latitude);
    const longitudes = coordinates.map((coord) => coord.longitude);
    const spread = Math.max(
        Math.max(...latitudes) - Math.min(...latitudes),
        Math.max(...longitudes) - Math.min(...longitudes)
    );

    if (spread > 8) return 6;
    if (spread > 3) return 7;
    if (spread > 1) return 8;
    if (spread > 0.35) return 10;
    if (spread > 0.08) return 12;
    return 14;
};

const CasesWebMap = ({
    reports = [],
    userLocation,
    onReportPress,
    getReportConfig = () => ({ label: 'Case report', icon: 'location', color: COLORS.accent }),
    getReportTypeLabel = (report) => report?.case_type || 'Case report',
    compact = false,
}) => {
    const mappedReports = useMemo(() => (
        reports
            .map((report) => ({ report, coords: getReportCoordinates(report) }))
            .filter((item) => item.coords)
    ), [reports]);
    const calculatedCenter = useMemo(() => getCenter(reports, userLocation), [reports, userLocation]);
    const calculatedZoom = useMemo(() => getInitialZoom(reports, compact), [reports, compact]);
    const [layout, setLayout] = useState({ width: 0, height: 0 });
    const [mapCenter, setMapCenter] = useState(calculatedCenter);
    const [zoom, setZoom] = useState(calculatedZoom);
    const [selectedReportId, setSelectedReportId] = useState(mappedReports[0]?.report?.id || null);
    const panStartRef = useRef(null);

    useEffect(() => {
        setMapCenter(calculatedCenter);
    }, [calculatedCenter]);

    useEffect(() => {
        setZoom(calculatedZoom);
    }, [calculatedZoom]);

    useEffect(() => {
        setSelectedReportId((currentId) => (
            mappedReports.some(({ report }) => report.id === currentId)
                ? currentId
                : mappedReports[0]?.report?.id || null
        ));
    }, [mappedReports]);

    const centerPixelX = longitudeToTileX(mapCenter.longitude, zoom) * TILE_SIZE;
    const centerPixelY = latitudeToTileY(mapCenter.latitude, zoom) * TILE_SIZE;
    const worldWidth = (2 ** zoom) * TILE_SIZE;
    const selectedItem = mappedReports.find(({ report }) => report.id === selectedReportId);

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => (
            !compact && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5)
        ),
        onPanResponderGrant: () => {
            panStartRef.current = { x: centerPixelX, y: centerPixelY, zoom };
        },
        onPanResponderMove: (_, gestureState) => {
            const start = panStartRef.current || { x: centerPixelX, y: centerPixelY, zoom };
            setMapCenter(pixelsToCoordinates(
                start.x - gestureState.dx,
                start.y - gestureState.dy,
                start.zoom
            ));
        },
        onPanResponderRelease: () => {
            panStartRef.current = null;
        },
        onPanResponderTerminate: () => {
            panStartRef.current = null;
        },
    }), [centerPixelX, centerPixelY, compact, zoom]);

    const tiles = useMemo(() => {
        if (!layout.width || !layout.height) return [];

        const tileCount = 2 ** zoom;
        const centerTileX = Math.floor(centerPixelX / TILE_SIZE);
        const centerTileY = Math.floor(centerPixelY / TILE_SIZE);
        const horizontalRange = Math.ceil(layout.width / TILE_SIZE / 2) + 1;
        const verticalRange = Math.ceil(layout.height / TILE_SIZE / 2) + 1;
        const nextTiles = [];

        for (let x = centerTileX - horizontalRange; x <= centerTileX + horizontalRange; x += 1) {
            for (let y = centerTileY - verticalRange; y <= centerTileY + verticalRange; y += 1) {
                if (y < 0 || y >= tileCount) continue;

                const wrappedX = ((x % tileCount) + tileCount) % tileCount;
                nextTiles.push({
                    key: `${zoom}-${x}-${y}`,
                    uri: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
                    left: (x * TILE_SIZE) - centerPixelX + (layout.width / 2),
                    top: (y * TILE_SIZE) - centerPixelY + (layout.height / 2),
                });
            }
        }

        return nextTiles;
    }, [centerPixelX, centerPixelY, layout.height, layout.width, zoom]);

    const getPointStyle = (coords) => {
        const pointX = longitudeToTileX(coords.longitude, zoom) * TILE_SIZE;
        const pointY = latitudeToTileY(coords.latitude, zoom) * TILE_SIZE;
        let xOffset = pointX - centerPixelX;

        if (Math.abs(xOffset) > worldWidth / 2) {
            xOffset += xOffset > 0 ? -worldWidth : worldWidth;
        }

        return {
            left: xOffset + (layout.width / 2) - 18,
            top: (pointY - centerPixelY) + (layout.height / 2) - 36,
        };
    };

    const changeZoom = (direction) => {
        setZoom((currentZoom) => clamp(currentZoom + direction, MIN_ZOOM, MAX_ZOOM));
    };

    return (
        <View
            style={[styles.container, compact && styles.compactContainer]}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setLayout({ width, height });
            }}
        >
            <View style={styles.mapCanvas} {...(!compact ? panResponder.panHandlers : {})}>
                {tiles.map((tile) => (
                    <Image
                        key={tile.key}
                        source={{ uri: tile.uri }}
                        resizeMode="stretch"
                        style={[styles.tile, { left: tile.left, top: tile.top }]}
                    />
                ))}

                {mappedReports.map(({ report, coords }) => {
                    const config = getReportConfig(report);
                    const isSelected = report.id === selectedReportId;
                    const pointStyle = getPointStyle(coords);

                    return (
                        <TouchableOpacity
                            key={report.id}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${report.title || 'case report'}`}
                            style={[
                                styles.pinButton,
                                pointStyle,
                                isSelected && styles.pinButtonSelected,
                            ]}
                            onPress={() => {
                                setSelectedReportId(report.id);
                                if (compact && onReportPress) onReportPress(report);
                            }}
                        >
                            <View style={[styles.pin, { backgroundColor: config.color || COLORS.accent }]}>
                                <Ionicons name={config.icon || 'location'} size={compact ? 14 : 16} color="white" />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {!compact && (
                <View style={styles.headerPill}>
                    <Ionicons name="map" size={16} color={COLORS.accent} />
                    <Text style={styles.headerText}>
                        {mappedReports.length === 1 ? '1 mapped case' : `${mappedReports.length} mapped cases`}
                    </Text>
                </View>
            )}

            {!compact && (
                <View style={styles.zoomControls}>
                    <TouchableOpacity
                        style={[styles.zoomButton, zoom >= MAX_ZOOM && styles.zoomButtonDisabled]}
                        onPress={() => changeZoom(1)}
                        disabled={zoom >= MAX_ZOOM}
                    >
                        <Ionicons name="add" size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.zoomButton, zoom <= MIN_ZOOM && styles.zoomButtonDisabled]}
                        onPress={() => changeZoom(-1)}
                        disabled={zoom <= MIN_ZOOM}
                    >
                        <Ionicons name="remove" size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.zoomButton}
                        onPress={() => setMapCenter(calculatedCenter)}
                    >
                        <Ionicons name="locate-outline" size={18} color="white" />
                    </TouchableOpacity>
                </View>
            )}

            {mappedReports.length === 0 && (
                <View style={styles.notice}>
                    <Ionicons name="location-outline" size={22} color={COLORS.accent} />
                    <Text style={styles.noticeText}>Only reports with confirmed GPS coordinates appear on the map.</Text>
                </View>
            )}

            {!compact && selectedItem && (
                <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.selectedCard}
                    onPress={() => onReportPress && onReportPress(selectedItem.report)}
                >
                    <View style={[
                        styles.selectedIcon,
                        { backgroundColor: getReportConfig(selectedItem.report).color || COLORS.accent },
                    ]}>
                        <Ionicons
                            name={getReportConfig(selectedItem.report).icon || 'location'}
                            size={18}
                            color="white"
                        />
                    </View>
                    <View style={styles.selectedContent}>
                        <Text style={styles.selectedTitle} numberOfLines={1}>
                            {selectedItem.report.title || 'Case report'}
                        </Text>
                        <Text style={styles.selectedMeta} numberOfLines={1}>
                            {getReportTypeLabel(selectedItem.report)}
                        </Text>
                        {!!selectedItem.report.location && (
                            <Text style={styles.selectedLocation} numberOfLines={1}>
                                {selectedItem.report.location}
                            </Text>
                        )}
                    </View>
                    <Ionicons name="chevron-forward" size={22} color={COLORS.accent} />
                </TouchableOpacity>
            )}

            <Text style={[styles.attribution, compact && styles.compactAttribution]}>
                Map data: OpenStreetMap contributors
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0E1726',
        overflow: 'hidden',
    },
    compactContainer: {
        borderRadius: 14,
    },
    mapCanvas: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#101C2C',
    },
    tile: {
        position: 'absolute',
        width: TILE_SIZE,
        height: TILE_SIZE,
    },
    pinButton: {
        position: 'absolute',
        width: 36,
        height: 42,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    pinButtonSelected: {
        transform: [{ scale: 1.08 }],
    },
    pin: {
        width: 32,
        height: 32,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 3 },
    },
    headerPill: {
        position: 'absolute',
        top: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 17, 28, 0.88)',
        borderRadius: 22,
        paddingHorizontal: SPACING.md,
        paddingVertical: 9,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    headerText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 8,
    },
    zoomControls: {
        position: 'absolute',
        top: 16,
        right: 16,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    zoomButton: {
        width: 40,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(10, 17, 28, 0.9)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    zoomButtonDisabled: {
        opacity: 0.45,
    },
    notice: {
        position: 'absolute',
        left: 20,
        right: 20,
        top: 24,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 17, 28, 0.9)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    noticeText: {
        flex: 1,
        color: COLORS.white,
        fontSize: 13,
        marginLeft: 8,
        lineHeight: 18,
    },
    selectedCard: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 18,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 17, 28, 0.94)',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
    },
    selectedIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    selectedContent: {
        flex: 1,
        minWidth: 0,
    },
    selectedTitle: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '800',
    },
    selectedMeta: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    selectedLocation: {
        color: 'rgba(255,255,255,0.68)',
        fontSize: 12,
        marginTop: 2,
    },
    attribution: {
        position: 'absolute',
        right: 10,
        bottom: 4,
        color: 'rgba(255,255,255,0.62)',
        fontSize: 10,
        backgroundColor: 'rgba(10,17,28,0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    compactAttribution: {
        fontSize: 8,
        right: 6,
        bottom: 4,
    },
});

export default CasesWebMap;
