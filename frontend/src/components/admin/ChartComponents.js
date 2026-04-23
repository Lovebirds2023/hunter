import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { ADMIN_COLORS } from './AdminStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ─── Mini Bar Chart (inline in cards) ─── */
export const MiniBarChart = ({ data = [], color = ADMIN_COLORS.chart1, height = 40 }) => {
    if (!data.length) return null;
    const max = Math.max(...data, 1);
    const barWidth = Math.min(6, (SCREEN_WIDTH * 0.25) / data.length);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 2 }}>
            {data.map((val, i) => (
                <View
                    key={i}
                    style={{
                        width: barWidth,
                        height: Math.max(2, (val / max) * height),
                        backgroundColor: i === data.length - 1 ? color : `${color}66`,
                        borderRadius: 2,
                    }}
                />
            ))}
        </View>
    );
};

/* ─── Revenue Bar Chart ─── */
export const RevenueBarChart = ({ data = [] }) => {
    if (!data.length) return null;
    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
    const chartHeight = 140;
    const barWidth = Math.min(32, (SCREEN_WIDTH - 100) / data.length);

    return (
        <View style={{ marginTop: 8 }}>
            {/* Chart */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, paddingHorizontal: 8 }}>
                {data.map((item, i) => {
                    const revHeight = (item.revenue / maxRevenue) * (chartHeight - 20);
                    const commHeight = (item.commission / maxRevenue) * (chartHeight - 20);
                    return (
                        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: 9, color: ADMIN_COLORS.textMuted, marginBottom: 2 }}>
                                {item.revenue > 0 ? `${(item.revenue / 1000).toFixed(0)}k` : ''}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                                <View style={{
                                    width: barWidth * 0.45,
                                    height: Math.max(3, revHeight),
                                    backgroundColor: ADMIN_COLORS.chart2,
                                    borderRadius: 4,
                                    borderBottomLeftRadius: 0,
                                    borderBottomRightRadius: 0,
                                }} />
                                <View style={{
                                    width: barWidth * 0.45,
                                    height: Math.max(3, commHeight),
                                    backgroundColor: ADMIN_COLORS.accent,
                                    borderRadius: 4,
                                    borderBottomLeftRadius: 0,
                                    borderBottomRightRadius: 0,
                                }} />
                            </View>
                        </View>
                    );
                })}
            </View>
            {/* X Axis Labels */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 8, marginTop: 6 }}>
                {data.map((item, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: ADMIN_COLORS.textMuted }}>{item.month}</Text>
                    </View>
                ))}
            </View>
            {/* Legend */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: ADMIN_COLORS.chart2, marginRight: 6 }} />
                    <Text style={{ fontSize: 11, color: ADMIN_COLORS.textSecondary }}>Revenue</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: ADMIN_COLORS.accent, marginRight: 6 }} />
                    <Text style={{ fontSize: 11, color: ADMIN_COLORS.textSecondary }}>Commission</Text>
                </View>
            </View>
        </View>
    );
};

/* ─── Horizontal Distribution Bar ─── */
export const DistributionBar = ({ segments = [], total = 0, height = 8 }) => {
    if (!total) return null;
    return (
        <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: ADMIN_COLORS.surfaceLight }}>
            {segments.map((seg, i) => (
                <View
                    key={i}
                    style={{
                        width: `${Math.max(2, (seg.value / total) * 100)}%`,
                        backgroundColor: seg.color,
                        height,
                    }}
                />
            ))}
        </View>
    );
};

/* ─── Progress Ring (simple) ─── */
export const ProgressRing = ({ percent = 0, size = 56, strokeWidth = 5, color = ADMIN_COLORS.chart2 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const fill = Math.min(100, Math.max(0, percent));

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            {/* Background circle via border */}
            <View style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: ADMIN_COLORS.surfaceBorder,
                position: 'absolute',
            }} />
            {/* Fill arc approximation via border */}
            <View style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: color,
                borderTopColor: fill > 75 ? color : 'transparent',
                borderRightColor: fill > 50 ? color : 'transparent',
                borderBottomColor: fill > 25 ? color : 'transparent',
                borderLeftColor: fill > 0 ? color : 'transparent',
                position: 'absolute',
                transform: [{ rotate: '-90deg' }],
            }} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: ADMIN_COLORS.textPrimary }}>
                {Math.round(fill)}%
            </Text>
        </View>
    );
};

/* ─── Donut Breakdown ─── */
export const DonutBreakdown = ({ items = [], label = '' }) => {
    const total = items.reduce((sum, i) => sum + i.value, 0) || 1;
    return (
        <View>
            <DistributionBar
                segments={items.map(i => ({ value: i.value, color: i.color }))}
                total={total}
                height={10}
            />
            <View style={{ marginTop: 10, gap: 6 }}>
                {items.map((item, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 8 }} />
                            <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary }}>{item.label}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: ADMIN_COLORS.textPrimary }}>{item.value}</Text>
                            <Text style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>
                                {Math.round((item.value / total) * 100)}%
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};
