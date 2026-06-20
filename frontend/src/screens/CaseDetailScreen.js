import React, { useState, useEffect, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    View, Text, StyleSheet, TextInput, ScrollView,
    TouchableOpacity, Image, SafeAreaView, KeyboardAvoidingView,
    Platform, FlatList, ActivityIndicator, Dimensions, Linking
} from 'react-native';
import MapView, { Marker } from '../components/MapComponent';
import CasesWebMap from '../components/CasesWebMap';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { ThemeBackground } from '../components/ThemeBackground';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { formatLocationAccuracy, hasValidCoordinatePair } from '../utils/locationAccuracy';

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
    const { t } = useTranslation();
    const { reportId } = route.params;
    const { userInfo } = useContext(AuthContext);

    const [report, setReport] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [tagSuggestions, setTagSuggestions] = useState([]);
    const [matches, setMatches] = useState([]);
    const [matchesLoading, setMatchesLoading] = useState(false);
    const [refreshingMatches, setRefreshingMatches] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        fetchReport();
        fetchComments();
        fetchMatches();
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

    const fetchMatches = async () => {
        setMatchesLoading(true);
        try {
            const res = await client.get(`/cases/${reportId}/matches`);
            setMatches(res.data || []);
        } catch (e) {
            if (__DEV__) console.log('Failed to fetch case matches', e);
        } finally {
            setMatchesLoading(false);
        }
    };

    const refreshMatches = async () => {
        setRefreshingMatches(true);
        try {
            const res = await client.post(`/cases/${reportId}/matches/refresh`);
            const nextMatches = res.data || [];
            setMatches(nextMatches);
            setReport(prev => prev ? ({
                ...prev,
                match_count: nextMatches.length,
                top_match_confidence: nextMatches.length ? Math.max(...nextMatches.map(item => item.confidence || 0)) : null,
            }) : prev);
        } catch (e) {
            if (__DEV__) console.log('Failed to refresh case matches', e);
        } finally {
            setRefreshingMatches(false);
        }
    };

    const updateMatchStatus = async (matchId, status) => {
        try {
            const res = await client.post(`/cases/${reportId}/matches/${matchId}`, { status });
            setMatches(prev => prev.map(item => item.id === matchId ? res.data : item));
        } catch (e) {
            if (__DEV__) console.log('Failed to update match status', e);
        }
    };

    const openExternalMap = () => {
        if (!hasValidCoordinatePair(report)) return;

        const latitude = Number(report.latitude);
        const longitude = Number(report.longitude);
        const label = encodeURIComponent(report.title || 'Case location');
        const url = Platform.OS === 'ios'
            ? `http://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`
            : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

        Linking.openURL(url).catch((error) => {
            if (__DEV__) console.log('Failed to open map link', error);
        });
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
        if (diff < 60) return t('common.just_now');
        if (diff < 3600) return `${Math.floor(diff / 60)}m ${t('common.ago')}`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ${t('common.ago')}`;
        return `${Math.floor(diff / 86400)}d ${t('common.ago')}`;
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

    const openMatchedCase = (matchedCaseId) => {
        if (!matchedCaseId || matchedCaseId === reportId) return;
        if (navigation.push) {
            navigation.push('CaseDetail', { reportId: matchedCaseId });
        } else {
            navigation.navigate('CaseDetail', { reportId: matchedCaseId });
        }
    };

    const renderMatchCard = (match) => {
        const matchedCase = match.matched_case;
        const matchedDog = match.matched_dog;
        const candidate = matchedCase || matchedDog || {};
        const reasons = match.score_breakdown?.reasons || [];
        const imageUrl = candidate.image_url || candidate.body_image || candidate.images?.[0];
        const confidence = Math.round(match.confidence || 0);
        const candidateTitle = matchedCase
            ? candidate.title
            : candidate.name || 'Registered pet profile';
        const candidateMeta = matchedCase
            ? t(`report.types.${candidate.case_type}`, { defaultValue: candidate.case_type || 'Case report' })
            : `${candidate.pet_type || 'pet'} profile`;

        return (
            <View key={match.id} style={styles.matchCard}>
                <View style={styles.matchCardHeader}>
                    <View style={[styles.matchScore, confidence >= 75 && styles.matchScoreStrong]}>
                        <Text style={[styles.matchScoreText, confidence >= 75 && styles.matchScoreTextStrong]}>{confidence}%</Text>
                    </View>
                    <View style={styles.matchTitleCol}>
                        <Text style={styles.matchTitle} numberOfLines={1}>{candidateTitle}</Text>
                        <Text style={styles.matchMeta} numberOfLines={1}>{candidateMeta}</Text>
                    </View>
                    <Text style={[styles.matchStatus, match.status === 'confirmed' && styles.matchStatusConfirmed]}>
                        {match.status}
                    </Text>
                </View>

                <View style={styles.matchBody}>
                    {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.matchImage} />
                    ) : (
                        <View style={styles.matchImagePlaceholder}>
                            <Ionicons name="paw-outline" size={22} color={COLORS.accent} />
                        </View>
                    )}
                    <View style={styles.matchEvidence}>
                        {(candidate.breed || candidate.color || candidate.location) && (
                            <Text style={styles.matchCandidateDetails} numberOfLines={2}>
                                {[candidate.breed, candidate.color, candidate.location].filter(Boolean).join(' | ')}
                            </Text>
                        )}
                        {reasons.length > 0 ? (
                            reasons.slice(0, 3).map(reason => (
                                <View key={reason} style={styles.reasonRow}>
                                    <Ionicons name="checkmark-circle" size={13} color={COLORS.accent} />
                                    <Text style={styles.reasonText}>{reason}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.reasonText}>Matched from available profile, location, and photo evidence.</Text>
                        )}
                    </View>
                </View>

                <View style={styles.matchActions}>
                    {matchedCase?.id && matchedCase.id !== reportId && (
                        <TouchableOpacity style={styles.matchActionBtn} onPress={() => openMatchedCase(matchedCase.id)}>
                            <Ionicons name="open-outline" size={14} color={COLORS.accent} />
                            <Text style={styles.matchActionText}>Open case</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.matchActionBtn} onPress={() => updateMatchStatus(match.id, 'confirmed')}>
                        <Ionicons name="checkmark" size={14} color={COLORS.accent} />
                        <Text style={styles.matchActionText}>Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.matchActionBtn} onPress={() => updateMatchStatus(match.id, 'rejected')}>
                        <Ionicons name="close" size={14} color="#FF8888" />
                        <Text style={[styles.matchActionText, { color: '#FFBBBB' }]}>Not a match</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
                    <Text style={styles.headerTitle}>{t('case_detail.title')}</Text>
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
                                        <Text style={styles.authorName}>{report.author?.full_name || t('common.anonymous')}</Text>
                                        <Text style={styles.timeAgo}>{getTimeAgo(report.created_at)}</Text>
                                    </View>
                                    <View style={[styles.caseTypeBadge, { backgroundColor: config.color }]}>
                                        <Ionicons name={config.icon} size={14} color="white" />
                                        <Text style={styles.caseTypeBadgeText}>{t(`report.types.${report.case_type}`, { defaultValue: config.label })}</Text>
                                    </View>
                                </View>

                                {/* Content */}
                                <Text style={styles.reportTitle}>{report.title}</Text>
                                {report.description ? (
                                    <Text style={styles.reportDesc}>{report.description}</Text>
                                ) : null}

                                {/* Metadata Grid */}
                                {(report.breed || report.color || report.pet_type || report.sex || report.size || report.collar_description || report.unique_markings || report.microchip_id) && (
                                    <View style={styles.detailsGrid}>
                                        {report.pet_type && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="paw" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>Animal</Text>
                                                    <Text style={styles.detailValue}>{report.pet_type}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {report.breed && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="paw-outline" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>{t('report.labels.breed')}</Text>
                                                    <Text style={styles.detailValue}>{report.breed}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {report.color && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="color-palette-outline" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>{t('report.labels.color')}</Text>
                                                    <Text style={styles.detailValue}>{report.color}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {report.size && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="resize-outline" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>Size</Text>
                                                    <Text style={styles.detailValue}>{report.size}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {report.sex && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="male-female-outline" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>Sex</Text>
                                                    <Text style={styles.detailValue}>{report.sex}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {report.microchip_id && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="pricetag-outline" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>ID or tag</Text>
                                                    <Text style={styles.detailValue}>{report.microchip_id}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {report.collar_description && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="ellipse-outline" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>Collar/tag</Text>
                                                    <Text style={styles.detailValue}>{report.collar_description}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {report.unique_markings && (
                                            <View style={styles.detailItem}>
                                                <Ionicons name="finger-print-outline" size={16} color={COLORS.accent} />
                                                <View style={styles.detailTextCol}>
                                                    <Text style={styles.detailLabel}>Unique markings</Text>
                                                    <Text style={styles.detailValue}>{report.unique_markings}</Text>
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
                                {hasValidCoordinatePair(report) && (
                                    <View style={styles.miniMapContainer}>
                                        {Platform.OS === 'web' ? (
                                            <CasesWebMap
                                                reports={[report]}
                                                compact
                                                getReportConfig={() => config}
                                                getReportTypeLabel={() => t(`report.types.${report.case_type}`, { defaultValue: config.label })}
                                                onReportPress={openExternalMap}
                                            />
                                        ) : (
                                            <MapView
                                                style={styles.miniMap}
                                                initialRegion={{
                                                    latitude: Number(report.latitude),
                                                    longitude: Number(report.longitude),
                                                    latitudeDelta: 0.01,
                                                    longitudeDelta: 0.01,
                                                }}
                                                scrollEnabled={false}
                                                zoomEnabled={false}
                                            >
                                                <Marker
                                                    coordinate={{ latitude: Number(report.latitude), longitude: Number(report.longitude) }}
                                                    pinColor={config.color}
                                                />
                                            </MapView>
                                        )}
                                        {report.location_accuracy_meters !== null && report.location_accuracy_meters !== undefined && (
                                            <Text style={styles.mapAccuracyText}>
                                                {formatLocationAccuracy(report.location_accuracy_meters)}
                                            </Text>
                                        )}
                                        <View style={styles.mapOverlay}>
                                            <TouchableOpacity
                                                style={styles.fullMapBtn}
                                                onPress={openExternalMap}
                                            >
                                                <Ionicons name="map-outline" size={16} color="white" />
                                                <Text style={styles.fullMapBtnText}>{t('case_detail.incident_spot')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                <Text style={styles.exactTimeText}>
                                    {t('case_detail.reported_on', { date: formatDateTime(report.created_at) })}
                                </Text>

                                {/* Actions */}
                                <View style={styles.actionsRow}>
                                    <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
                                        <Ionicons
                                            name={report.is_liked ? 'heart' : 'heart-outline'}
                                            size={24}
                                            color={report.is_liked ? '#FF4444' : 'rgba(255,255,255,0.6)'}
                                        />
                                        <Text style={styles.actionCount}>{t('case_detail.likes', { count: report.like_count || 0 })}</Text>
                                    </TouchableOpacity>
                                    <View style={styles.actionBtn}>
                                        <Ionicons name="chatbubble" size={20} color="rgba(255,255,255,0.6)" />
                                        <Text style={styles.actionCount}>{t('case_detail.comments_count', { count: comments.length })}</Text>
                                    </View>
                                </View>

                                {(report.case_type === 'lost_dog' || report.case_type === 'found_dog') && (
                                    <View style={styles.matchesSection}>
                                        <View style={styles.matchesHeader}>
                                            <View>
                                                <Text style={styles.matchesTitle}>Possible Matches</Text>
                                                <Text style={styles.matchesSubtitle}>
                                                    Trait, location, timing, and photo evidence. Please confirm manually.
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.refreshMatchBtn, refreshingMatches && { opacity: 0.6 }]}
                                                onPress={refreshMatches}
                                                disabled={refreshingMatches}
                                            >
                                                {refreshingMatches ? (
                                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                                ) : (
                                                    <Ionicons name="refresh" size={16} color={COLORS.primary} />
                                                )}
                                            </TouchableOpacity>
                                        </View>

                                        {matchesLoading ? (
                                            <ActivityIndicator color={COLORS.accent} style={{ marginVertical: SPACING.md }} />
                                        ) : matches.length > 0 ? (
                                            matches.map(renderMatchCard)
                                        ) : (
                                            <View style={styles.noMatchesBox}>
                                                <Ionicons name="search-outline" size={20} color={COLORS.accent} />
                                                <Text style={styles.noMatchesText}>
                                                    No strong matches yet. Tap refresh after more lost/found reports are added.
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Comments Section */}
                                <View style={styles.commentsSection}>
                                    <Text style={styles.commentsSectionTitle}>{t('case_detail.comments')}</Text>
                                    {comments.length === 0 ? (
                                        <Text style={styles.noComments}>{t('case_detail.no_comments')}</Text>
                                    ) : (
                                        comments.map((c) => (
                                            <View key={c.id} style={styles.commentCard}>
                                                <View style={styles.commentHeader}>
                                                    <View style={styles.commentAvatar}>
                                                        <Ionicons name="person" size={14} color={COLORS.white} />
                                                    </View>
                                                    <Text style={styles.commentAuthor}>{c.author?.full_name || t('case_actions.user')}</Text>
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
                            placeholder={t('case_detail.comment_placeholder')}
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
        flexWrap: 'wrap',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: SPACING.md,
        gap: 16,
    },
    detailItem: {
        minWidth: '44%',
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailTextCol: {
        marginLeft: 8,
        flex: 1,
        minWidth: 0,
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
    matchesSection: {
        backgroundColor: 'rgba(255,215,0,0.06)',
        borderRadius: 16,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.16)',
        marginBottom: SPACING.lg,
    },
    matchesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
        gap: 12,
    },
    matchesTitle: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '900',
    },
    matchesSubtitle: {
        color: 'rgba(255,255,255,0.58)',
        fontSize: 11,
        lineHeight: 16,
        marginTop: 3,
        maxWidth: 260,
    },
    refreshMatchBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    matchCard: {
        backgroundColor: 'rgba(0,0,0,0.24)',
        borderRadius: 14,
        padding: 12,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    matchCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    matchScore: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.25)',
    },
    matchScoreStrong: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    matchScoreText: {
        color: COLORS.white,
        fontWeight: '900',
        fontSize: 13,
    },
    matchScoreTextStrong: {
        color: COLORS.primary,
    },
    matchTitleCol: {
        flex: 1,
        minWidth: 0,
        marginLeft: 10,
    },
    matchTitle: {
        color: COLORS.white,
        fontWeight: '900',
        fontSize: 14,
    },
    matchMeta: {
        color: COLORS.accent,
        fontSize: 11,
        marginTop: 2,
        textTransform: 'capitalize',
    },
    matchStatus: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    matchStatusConfirmed: {
        color: '#8DFF9C',
    },
    matchBody: {
        flexDirection: 'row',
        gap: 10,
    },
    matchImage: {
        width: 74,
        height: 74,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    matchImagePlaceholder: {
        width: 74,
        height: 74,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    matchEvidence: {
        flex: 1,
        minWidth: 0,
    },
    matchCandidateDetails: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 12,
        marginBottom: 6,
        lineHeight: 16,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    reasonText: {
        color: 'rgba(255,255,255,0.68)',
        fontSize: 11,
        lineHeight: 16,
        marginLeft: 5,
        flex: 1,
    },
    matchActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    matchActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    matchActionText: {
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: '800',
        marginLeft: 5,
    },
    noMatchesBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.18)',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
    },
    noMatchesText: {
        flex: 1,
        color: 'rgba(255,255,255,0.64)',
        fontSize: 12,
        lineHeight: 17,
        marginLeft: 8,
    },
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
    mapAccuracyText: {
        position: 'absolute',
        left: 10,
        bottom: 12,
        color: 'white',
        backgroundColor: 'rgba(0,0,0,0.6)',
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
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
