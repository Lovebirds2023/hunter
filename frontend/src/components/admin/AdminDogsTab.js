import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [deleteReasons, setDeleteReasons] = useState({});

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

    const filtered = useMemo(() => {
        if (search.trim()) {
            const q = search.toLowerCase();
            return dogs.filter(d =>
                d.name?.toLowerCase().includes(q) || 
                d.breed?.toLowerCase().includes(q) ||
                d.owner_name?.toLowerCase().includes(q)
            );
        }
        return dogs;
    }, [dogs, search]);

    const updateDeleteReason = (id, reason) => {
        setDeleteReasons(prev => ({ ...prev, [id]: reason }));
    };

    const handleDelete = (item) => {
        const reason = (deleteReasons[item.id] || '').trim();
        if (!reason) {
            Alert.alert('Reason required', 'Add a short reason before deleting this registry entry.');
            return;
        }

        Alert.alert('Delete Registry Entry', `Delete "${item.name}" from the registry?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await client.delete(`/admin/dogs/${item.id}`, { data: { reason } });
                        setDogs(prev => prev.filter(d => d.id !== item.id));
                        Alert.alert('Deleted', 'Registry entry removed and owner notified.');
                    } catch (e) {
                        Alert.alert('Error', e.response?.data?.detail || 'Failed to delete registry entry.');
                    }
                }
            }
        ]);
    };

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
                        <Text style={s.sectionTitle}>Dog/Cat Registry</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{dogs.length} pets registered</Text>
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
                    keyboardShouldPersistTaps="handled"
                    removeClippedSubviews={false}
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
                                            width: `${dogs.length > 0 ? (count / dogs.length) * 100 : 0}%`,
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
                            <Text style={s.emptyText}>No pets found</Text>
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
                            <TextInput
                                style={[s.textInput, {
                                    height: 42,
                                    marginTop: 12,
                                    borderWidth: 1,
                                    borderColor: ADMIN_COLORS.surfaceBorder,
                                    borderRadius: 10,
                                    paddingHorizontal: 12,
                                    backgroundColor: ADMIN_COLORS.surfaceLight,
                                }]}
                                placeholder="Reason if deleting..."
                                placeholderTextColor={ADMIN_COLORS.textMuted}
                                value={deleteReasons[item.id] || ''}
                                onChangeText={(reason) => updateDeleteReason(item.id, reason)}
                            />
                            <View style={s.actionRow}>
                                <TouchableOpacity
                                    style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.dangerBg }]}
                                    onPress={() => handleDelete(item)}
                                >
                                    <Ionicons name="trash-outline" size={14} color={ADMIN_COLORS.danger} />
                                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.danger }]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
};
