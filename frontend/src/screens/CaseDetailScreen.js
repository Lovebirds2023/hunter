import React, { useState, useEffect, useContext, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, ScrollView,
    TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView,
    Platform, FlatList, ActivityIndicator, Dimensions
} from 'react-native';
import MapView, { Marker } from '../components/MapComponent';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { ThemeBackground } from '../components/ThemeBackground';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';

const CASE_TYPE_CONFIG = {
    rabies_bite: { label: 'Rabies Bite', icon: 'warning', color: '#FF4444' },
    vehicle_hit: { label: 'Vehicle Hit', icon: 'car', color: '#FF8800' },
    injured_stray: { label: 'Injured Stray', icon: 'medkit', color: '#FF6600' },
    lost_dog: { label: 'I lost a dog', icon: 'search', color: '#4488FF' },
    found_dog: { label: 'I found a dog', icon: 'eye', color: '#00C851' },
    abuse: { label: 'Abuse Report', icon: 'alert-circle', color: '#CC0000' },
    other: { label: 'Other', icon: 'ellipsis-horizontal', color: '#888888' },
};

const CaseDetailScreen = ({ route, navigation }) => {
    const { reportId } = route.params;
    const { userInfo } = useContext(AuthContext);

    const [report, setReport] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [tagSuggestions, setTagSuggestions] = useState([]);
    const scrollRef = useRef(null);

    useEffect(() => {
        fetchReport();
        fetchComments();
    }, [reportId]);

    const fetchReport = async () => {
        try {
            const res = await client.get(`/cases/${reportId}`);
            setReport(res.data);
        } catch (e) {
            if (__DEV__) console.log('Failed to fetch report', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchComments = async () => {
        try {
            const res = await client.get(`/cases/${reportId}/comments`);
            setComments(res.data);
        } catch (e) {
            if (__DEV__) console.log('Failed to fetch comments', e);
        }
    };

    const handleSendComment = async () => {
        if (!newComment.trim()) return;
        setSending(true);

        // Extract @mentions from comment text
        const mentionRegex = /@(\w+[\s\w]*)/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(newComment)) !== null) {
            mentions.push(match[1]);
        }

        try {
            const res = await client.post(`/cases/${reportId}/comments`, {
                content: newComment.trim(),
                tagged_users: mentions.length > 0 ? mentions : null,
            });
            setComments(prev => [...prev, res.data]);
            setNewComment('');
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
        } catch (e) {
            if (__DEV__) console.log('Failed to send comment', e);
        } finally {
            setSending(false);
        }
    };

    const toggleLike = async () => {
        if (!report) return;
        try {
            const res = await client.post(`/cases/${reportId}/like`);
            setReport(prev => ({
                ...prev,
                is_liked: res.data.liked,
                like_count: res.data.liked ? prev.like_count + 1 : prev.like_count - 1,
            }));
        } catch (e) {
            if (__DEV__) console.log('Like failed', e);
        }
    };

    const handleCommentChange = async (text) => {
        setNewComment(text);
        // Detect @mention typing
        const lastAt = text.lastIndexOf('@');
        if (lastAt !== -1 && lastAt === text.length - 1 || (lastAt !== -1 && !text.substring(lastAt).includes(' '))) {
            const query = text.substring(lastAt + 1);
            if (query.length >= 1) {
                try {
                    const res = await client.get(`/users/search?q=${query}`);
                    setTagSuggestions(res.data);
                } catch (e) {
                    setTagSuggestions([]);
                }
            }
        } else {
            setTagSuggestions([]);
        }
    };

    const insertTag = (user) => {
        const lastAt = newComment.lastIndexOf('@');
        const before = newComment.substring(0, lastAt);
        setNewComment(`${before}@${user.full_name} `);
        setTagSuggestions([]);
    };

    const getTimeAgo = (dateStr) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    const formatDateTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString();
    };

    // Render @mentions in comment text with gold color
    const renderCommentText = (text) => {
        const parts = text.split(/(@\w[\w\s]*)/g);
        return parts.map((part, i) =>
            part.startsWith('@') ? (
                <Text key={i} style={{ color: COLORS.accent, fontWeight: 'bold' }}>{part}</Text>
            ) : (
                <Text key={i}>{part}</Text>
            )
        );
    };

    if (loading) {
        return (
            <ThemeBackground>
                <SafeAreaView style={styles.container}>
                    <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 100 }} />
                </SafeAreaView>
            </ThemeBackground>
        );
    }

    const config = report ? (CASE_TYPE_CONFIG[report.case_type] || CASE_TYPE_CONFIG.other) : CASE_TYPE_CONFIG.other;

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Case Detail</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={10}
                >
                    <ScrollView
                        ref={scrollRef}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {report && (
                            <>
                                {/* Author */}
                                <View style={styles.authorRow}>
                                    <View style={styles.avatar}>
                                        {report.author?.profile_image ? (
                                            <Image source={{ uri: report.author.profile_image }} style={styles.avatarImage} />
                                        ) : (
                                            <Ionicons name="person" size={20} color={COLORS.white} />
                                        )}
                                    </View>
                                    <View style={styles.authorInfo}>
                                        <Text style={styles.authorName}>{report.author?.full_name || 'Anonymous'}</Text>
                                        <Text style={styles.timeAgo}>{getTimeAgo(report.created_at)}</Text>
                                    </View>
                                    <View style={[styles.caseTypeBadge, { backgroundColor: config.color }]}>
                                        <Ionicons name={config.icon} size={14} color="white" />
                                        <Text style={styles.caseTypeBadgeText}>{config.label}</Text>
                                    </View>
                                </View>

                                {/* Content */}
                                <Text style={styles.reportTitle}>{report.title}</Text>
                                {report.description ? (
                                    <Text style={styles.reportDesc}>{report.description}</Text>
                                ) : null}

                                {/* Metadata Grid */}
                                {(report.breed || report.color) && (
                                    <View style={styles.detailsGrid}>
                                        {report.breed && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="paw-outline" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>Estimated Breed</Text>
                                                    <Text style={styles.detailValue}>{report.breed}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {report.color && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="color-palette-outline" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>Dog Color</Text>
                                                    <Text style={styles.detailValue}>{report.color}</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Images Carousel */}
                                {report.images && report.images.length > 0 ? (
                                    <ScrollView
                                        horizontal
                                        pagingEnabled
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.imageCarousel}
                                    >
                                        {report.images.map((img, idx) => (
                                            <Image
                                                key={idx}
                                                source={{ uri: img }}
                                                style={styles.carouselImage}
                                                resizeMode="cover"
                                            />
                                        ))}
                                    </ScrollView>
                                ) : report.image_url ? (
                                    <Image source={{ uri: report.image_url }} style={styles.reportImage} resizeMode="cover" />
                                ) : null}

                                {/* Location */}
                                {report.location ? (
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location" size={16} color={COLORS.accent} />
                                        <Text style={styles.locationText}>{report.location}</Text>
                                    </View>
                                ) : null}

                                {/* Mini Map */}
                                {report.latitude && (
                                    <View style={styles.miniMapContainer}>
                                        <MapView
                                            style={styles.miniMap}
                                            initialRegion={{
                                                latitude: report.latitude,
                                                longitude: report.longitude,
                                                latitudeDelta: 0.01,
                                                longitudeDelta: 0.01,
                                            }}
                                            scrollEnabled={false}
                                            zoomEnabled={false}
                                        >
                                            <Marker
                                                coordinate={{ latitude: report.latitude, longitude: report.longitude }}
                                                pinColor={config.color}
                                            />
                                        </MapView>
                                        <View style={styles.mapOverlay}>
                                            <TouchableOpacity
                                                style={styles.fullMapBtn}
                                                onPress={() => {
                                                    // Optional: open in external maps
                                                }}
                                            >
                                                <Ionicons name="map-outline" size={16} color="white" />
                                                <Text style={styles.fullMapBtnText}>Incident Spot</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                <Text style={styles.exactTimeText}>
                                    Reported on: {formatDateTime(report.created_at)}
                                </Text>

                                {/* Actions */}
                                <View style={styles.actionsRow}>
                                    <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
                                        <Ionicons
                                            name={report.is_liked ? 'heart' : 'heart-outline'}
                                            size={24}
                                            color={report.is_liked ? '#FF4444' : 'rgba(255,255,255,0.6)'}
                                        />
                                        <Text style={styles.actionCount}>{report.like_count || 0} likes</Text>
                                    </TouchableOpacity>
                                    <View style={styles.actionBtn}>
                                        <Ionicons name="chatbubble" size={20} color="rgba(255,255,255,0.6)" />
                                        <Text style={styles.actionCount}>{comments.length} comments</Text>
                                    </View>
                                </View>

                                {/* Comments Section */}
                                <View style={styles.commentsSection}>
                                    <Text style={styles.commentsSectionTitle}>Comments</Text>
                                    {comments.length === 0 ? (
                                        <Text style={styles.noComments}>No comments yet. Be the first to respond!</Text>
                                    ) : (
                                        comments.map((c) => (
                                            <View key={c.id} style={styles.commentCard}>
                                                <View style={styles.commentHeader}>
                                                    <View style={styles.commentAvatar}>
                                                        <Ionicons name="person" size={14} color={COLORS.white} />
                                                    </View>
                                                    <Text style={styles.commentAuthor}>{c.author?.full_name || 'User'}</Text>
                                                    <Text style={styles.commentTime}>{getTimeAgo(c.created_at)}</Text>
                                                </View>
                                                <Text style={styles.commentText}>{renderCommentText(c.content)}</Text>
                                            </View>
                                        ))
                                    )}
                                </View>
                            </>
                        )}
                    </ScrollView>

                    {/* Tag Suggestions */}
                    {tagSuggestions.length > 0 && (
                        <View style={styles.tagSuggestionContainer}>
                            {tagSuggestions.map((u) => (
                                <TouchableOpacity key={u.id} style={styles.tagSuggestion} onPress={() => insertTag(u)}>
                                    <Ionicons name="person-circle" size={20} color={COLORS.accent} />
                                    <Text style={styles.tagSuggestionText}>{u.full_name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Comment Input */}
                    <View style={styles.commentInputContainer}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Add a comment... use @ to tag"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={newComment}
                            onChangeText={handleCommentChange}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, sending && { opacity: 0.5 }]}
                            onPress={handleSendComment}
                            disabled={sending}
                        >
                            <Ionicons name="send" size={20} color={COLORS.white} />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ThemeBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
    scrollContent: { padding: SPACING.lg, paddingBottom: 20 },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
    authorInfo: { marginLeft: 12, flex: 1 },
    authorName: { fontSize: 15, fontWeight: 'bold', color: COLORS.white },
    timeAgo: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
    caseTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
    },
    caseTypeBadgeText: { color: 'white', fontSize: 11, fontWeight: 'bold', marginLeft: 5 },
    reportTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 8,
    },
    reportDesc: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.75)',
        lineHeight: 22,
        marginBottom: SPACING.md,
    },
    detailsGrid: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: SPACING.md,
        gap: 16,
    },
    detailItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailTextCol: {
        marginLeft: 8,
    },
    detailLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    reportImage: {
        width: '100%',
        height: 250,
        borderRadius: 14,
        marginBottom: SPACING.md,
    },
    imageCarousel: {
        width: '100%',
        height: 250,
        borderRadius: 14,
        marginBottom: SPACING.md,
    },
    carouselImage: {
        width: Dimensions.get('window').width - (SPACING.lg * 2),
        height: 250,
        borderRadius: 14,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    locationText: { fontSize: 13, color: COLORS.accent, marginLeft: 6 },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: SPACING.lg,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 24,
    },
    actionCount: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginLeft: 6 },
    commentsSection: { marginTop: SPACING.xs },
    commentsSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: SPACING.md,
    },
    noComments: {
        color: 'rgba(255,255,255,0.4)',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: SPACING.lg,
    },
    commentCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    commentAvatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    commentAuthor: { fontSize: 13, fontWeight: 'bold', color: COLORS.white, flex: 1 },
    commentTime: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
    commentText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18, paddingLeft: 34 },
    commentInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    commentInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: COLORS.white,
        fontSize: 14,
        maxHeight: 80,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    tagSuggestionContainer: {
        backgroundColor: 'rgba(30,0,60,0.95)',
        borderTopWidth: 1,
        borderTopColor: COLORS.accent,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
    },
    tagSuggestion: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    tagSuggestionText: {
        color: COLORS.white,
        marginLeft: 8,
        fontSize: 14,
    },
    miniMapContainer: {
        height: 150,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    miniMap: {
        width: '100%',
        height: '100%',
    },
    mapOverlay: {
        position: 'absolute',
        bottom: 10,
        right: 10,
    },
    fullMapBtn: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    fullMapBtnText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    exactTimeText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'right',
        marginBottom: SPACING.lg,
    }
});

export { CaseDetailScreen };
export default CaseDetailScreen;
