import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

export const AdminDogsTab = ({ onBack }) => {
    const [dogs, setDogs] = useState([]);
    const [breedDist, setBreedDist] = useState({});
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    const fetchDogs = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/dogs');
            setDogs(res.data.dogs || []);
            setBreedDist(res.data.breed_distribution || {});
        } catch (e) {
            console.error('Dogs fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchDogs(); }, [fetchDogs]);

    useEffect(() => {
        if (search.trim()) {
            const q = search.toLowerCase();
            setFiltered(dogs.filter(d => 
                d.name?.toLowerCase().includes(q) || 
                d.breed?.toLowerCase().includes(q) ||
                d.owner_name?.toLowerCase().includes(q)
            ));
        } else {
            setFiltered(dogs);
        }
    }, [dogs, search]);

    const topBreeds = Object.entries(breedDist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return (
        <View style={s.screen}>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: ADMIN_COLORS.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 14 }}>
                        <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>Dog Registry</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{dogs.length} dogs registered</Text>
                    </View>
                </View>

                {/* Search */}
                <View style={s.searchContainer}>
                    <Ionicons name="search" size={18} color={ADMIN_COLORS.textMuted} />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Search by name, breed or owner..."
                        placeholderTextColor={ADMIN_COLORS.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            {loading ? (
                <View style={s.loadingContainer}><ActivityIndicator size="large" color={ADMIN_COLORS.accent} /></View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDogs(true); }} tintColor={ADMIN_COLORS.accent} />}
                    ListHeaderComponent={
                        <View style={[s.card, { marginBottom: 20 }]}>
                            <Text style={[s.sectionTitle, { fontSize: 15, marginBottom: 12 }]}>Top Breeds</Text>
                            {topBreeds.map(([breed, count], i) => (
                                <View key={breed} style={{ marginBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary }}>{breed || 'Unknown'}</Text>
                                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textPrimary, fontWeight: '700' }}>{count}</Text>
                                    </View>
                                    <View style={{ height: 6, backgroundColor: ADMIN_COLORS.surfaceLight, borderRadius: 3, overflow: 'hidden' }}>
                                        <View style={{ 
                                            height: '100%', 
                                            width: `${(count / dogs.length) * 100}%`, 
                                            backgroundColor: i === 0 ? ADMIN_COLORS.accent : ADMIN_COLORS.chart1,
                                            borderRadius: 3 
                                        }} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={s.emptyContainer}>
                            <Ionicons name="paw-outline" size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>No dogs found</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={s.listCard}>
                            <View style={s.listCardHeader}>
                                <View style={[s.avatar, { backgroundColor: ADMIN_COLORS.surfaceLight }]}>
                                    <Ionicons name="paw" size={20} color={ADMIN_COLORS.accent} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={s.listCardTitle}>{item.name}</Text>
                                        {item.has_nose_print && (
                                            <View style={{ marginLeft: 8, backgroundColor: ADMIN_COLORS.successBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 9, color: ADMIN_COLORS.success, fontWeight: '800' }}>NOSE P-ID</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={s.listCardSub}>{item.breed} • Owner: {item.owner_name}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="document-text-outline" size={13} color={ADMIN_COLORS.textMuted} />
                                    <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary, marginLeft: 4 }}>
                                        {item.health_records} Records
                                    </Text>
                                </View>
                                {item.age && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="calendar-outline" size={13} color={ADMIN_COLORS.textMuted} />
                                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textSecondary, marginLeft: 4 }}>
                                            Age: {item.age}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
};
