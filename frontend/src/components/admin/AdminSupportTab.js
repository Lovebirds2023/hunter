import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, RefreshControl, Alert, ScrollView, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { adminStyles as s, ADMIN_COLORS } from './AdminStyles';

export const AdminSupportTab = ({ onBack }) => {
    const [tickets, setTickets] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('All');
    
    // Reply Modal state
    const [replyModal, setReplyModal] = useState({ visible: false, ticket: null, text: '' });
    const [submitting, setSubmitting] = useState(false);

    const fetchTickets = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await client.get('/admin/support-tickets');
            setTickets(res.data || []);
        } catch (e) {
            console.error('Support tickets fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    useEffect(() => {
        if (statusFilter === 'All') {
            setFiltered(tickets);
        } else {
            setFiltered(tickets.filter(t => t.status?.toLowerCase() === statusFilter.toLowerCase()));
        }
    }, [tickets, statusFilter]);

    const handleReply = async () => {
        if (!replyModal.text.trim()) {
            Alert.alert('Error', 'Please enter a reply message.');
            return;
        }
        setSubmitting(true);
        try {
            await client.post(`/admin/support-tickets/${replyModal.ticket.id}/reply`, {
                message: replyModal.text
            });
            Alert.alert('Success', 'Reply sent and ticket updated.');
            setReplyModal({ visible: false, ticket: null, text: '' });
            fetchTickets(true);
        } catch (e) {
            Alert.alert('Error', 'Failed to send reply.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResolve = async (id) => {
        Alert.alert('Resolve Ticket', 'Mark this ticket as resolved?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Resolve', 
                onPress: async () => {
                    try {
                        await client.post(`/admin/support-tickets/${id}/resolve`);
                        fetchTickets(true);
                    } catch (e) {
                        Alert.alert('Error', 'Failed to resolve ticket');
                    }
                }
            }
        ]);
    };

    return (
        <View style={s.screen}>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, backgroundColor: ADMIN_COLORS.bg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 14 }}>
                        <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>Support Tickets</Text>
                        <Text style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{tickets.length} total tickets</Text>
                    </View>
                </View>

                {/* Status Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={s.filterRow}>
                        {['All', 'Open', 'In-Progress', 'Resolved'].map(st => (
                            <TouchableOpacity
                                key={st}
                                style={[s.filterChip, statusFilter === st && s.filterChipActive]}
                                onPress={() => setStatusFilter(st)}
                            >
                                <Text style={[s.filterChipText, statusFilter === st && s.filterChipTextActive]}>
                                    {st}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {loading ? (
                <View style={s.loadingContainer}><ActivityIndicator size="large" color={ADMIN_COLORS.accent} /></View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTickets(true); }} tintColor={ADMIN_COLORS.accent} />}
                    ListEmptyComponent={
                        <View style={s.emptyContainer}>
                            <Ionicons name="chatbubble-ellipses-outline" size={48} color={ADMIN_COLORS.textMuted} />
                            <Text style={s.emptyText}>No support tickets found</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={s.listCard}>
                            <View style={s.listCardHeader}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={s.listCardTitle}>{item.subject || 'No Subject'}</Text>
                                        <View style={[s.badge, { marginLeft: 8, backgroundColor: item.status === 'Open' ? ADMIN_COLORS.dangerBg : (item.status === 'Resolved' ? ADMIN_COLORS.successBg : ADMIN_COLORS.warningBg) }]}>
                                            <Text style={[s.badgeText, { color: item.status === 'Open' ? ADMIN_COLORS.danger : (item.status === 'Resolved' ? ADMIN_COLORS.success : ADMIN_COLORS.warning) }]}>{item.status}</Text>
                                        </View>
                                    </View>
                                    <Text style={s.listCardSub}>From: {item.user_name} • {new Date(item.created_at).toLocaleString()}</Text>
                                </View>
                            </View>
                            
                            <Text style={{ color: ADMIN_COLORS.textSecondary, marginTop: 10, fontSize: 13, lineHeight: 18 }} numberOfLines={4}>
                                {item.message}
                            </Text>

                            <View style={s.actionRow}>
                                <TouchableOpacity 
                                    style={s.actionBtn}
                                    onPress={() => setReplyModal({ visible: true, ticket: item, text: '' })}
                                >
                                    <Ionicons name="arrow-undo-outline" size={14} color={ADMIN_COLORS.info} />
                                    <Text style={[s.actionBtnText, { color: ADMIN_COLORS.info }]}>Reply</Text>
                                </TouchableOpacity>
                                {item.status !== 'Resolved' && (
                                    <TouchableOpacity 
                                        style={[s.actionBtn, { backgroundColor: ADMIN_COLORS.successBg }]}
                                        onPress={() => handleResolve(item.id)}
                                    >
                                        <Ionicons name="checkmark-done-outline" size={14} color={ADMIN_COLORS.success} />
                                        <Text style={[s.actionBtnText, { color: ADMIN_COLORS.success }]}>Resolve</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                />
            )}

            {/* Reply Modal */}
            <Modal
                visible={replyModal.visible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setReplyModal({ visible: false, ticket: null, text: '' })}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}
                >
                    <View style={{ backgroundColor: ADMIN_COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={s.sectionTitle}>Reply to Ticket</Text>
                            <TouchableOpacity onPress={() => setReplyModal({ visible: false, ticket: null, text: '' })}>
                                <Ionicons name="close" size={24} color={ADMIN_COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {replyModal.ticket && (
                            <View style={[s.card, { padding: 12, marginBottom: 16 }]}>
                                <Text style={{ color: ADMIN_COLORS.textMuted, fontSize: 12 }}>TICKET MESSAGE:</Text>
                                <Text style={{ color: ADMIN_COLORS.textSecondary, fontSize: 13, marginTop: 4 }}>{replyModal.ticket.message}</Text>
                            </View>
                        )}

                        <Text style={s.inputLabel}>Reply Message</Text>
                        <View style={[s.inputContainer, { minHeight: 120, paddingTop: 12 }]}>
                            <TextInput 
                                style={[s.textInput, { height: 100, textAlignVertical: 'top' }]}
                                placeholder="Write your reply here..."
                                placeholderTextColor={ADMIN_COLORS.textMuted}
                                multiline
                                autoFocus
                                value={replyModal.text}
                                onChangeText={t => setReplyModal(m => ({ ...m, text: t }))}
                            />
                        </View>

                        <TouchableOpacity 
                            style={[s.primaryButton, submitting && { opacity: 0.7 }]} 
                            onPress={handleReply}
                            disabled={submitting}
                        >
                            {submitting ? <ActivityIndicator color={ADMIN_COLORS.bg} /> : (
                                <>
                                    <Ionicons name="send" size={18} color={ADMIN_COLORS.bg} />
                                    <Text style={s.primaryButtonText}>Send Reply</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <View style={{ height: 40 }} />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};
