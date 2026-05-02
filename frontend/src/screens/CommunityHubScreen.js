import React, { useState, useEffect, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export const CommunityHubScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const [messages, setMessages] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [trendingTags, setTrendingTags] = useState([]);
    const [selectedTag, setSelectedTag] = useState(null);
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const [activeTab, setActiveTab] = useState('global'); // 'global' or 'nearby'
    const [isSending, setIsSending] = useState(false);
    
    // Poll state
    const [isPollMode, setIsPollMode] = useState(false);
    const [pollOptions, setPollOptions] = useState([{id: 1, text: ''}, {id: 2, text: ''}]);

    useEffect(() => {
        fetchData();
        fetchTrendingTags();
        const pollInterval = setInterval(() => {
            fetchData();
            fetchTrendingTags();
        }, 8000); // Poll every 8 seconds
        return () => clearInterval(pollInterval);
    }, [activeTab, selectedTag]);

    const fetchTrendingTags = async () => {
        try {
            const res = await client.get('/chat/trending-tags');
            setTrendingTags(res.data);
        } catch(e) {
            console.error("Tags fetch error:", e);
        }
    };

    const fetchData = async () => {
        try {
            let endpoint = activeTab === 'global' ? '/chat/global' : '/chat/nearby';
            if (activeTab === 'global' && selectedTag) {
                endpoint += `?tag=${encodeURIComponent(selectedTag)}`;
            }
            const [msgRes, onlineRes] = await Promise.all([
                client.get(endpoint),
                client.get('/users/online')
            ]);
            setMessages(msgRes.data);
            setOnlineUsers(onlineRes.data);
            
            // Heartbeat
            client.post('/users/status/heartbeat').catch(() => {});
        } catch (error) {
            console.error("Community Hub polling error:", error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim()) return;
        
        let finalOptions = null;
        if (isPollMode) {
            finalOptions = pollOptions.filter(o => o.text.trim().length > 0);
            if (finalOptions.length < 2) {
                Alert.alert(t('community_hub.warning'), t('community_hub.poll_min_options'));
                return;
            }
        }

        setIsSending(true);
        try {
            await client.post('/chat/message', {
                content: inputText,
                is_global: activeTab === 'global',
                is_poll: isPollMode,
                poll_options: finalOptions
            });
            setInputText('');
            setPollOptions([{id: 1, text: ''}, {id: 2, text: ''}]);
            setIsPollMode(false);
            fetchData();
        } catch (error) {
            Alert.alert(t('common.error'), t('community_hub.send_error'));
        } finally {
            setIsSending(false);
        }
    };

    const toggleReaction = async (messageId) => {
        try {
            await client.post(`/chat/messages/${messageId}/react`, { reaction_type: 'heart' });
            fetchData(); // reload reactions
        } catch (error) {
            console.error("Reaction error:", error);
        }
    };

    const flagMessage = async (messageId) => {
        try {
            await client.post(`/chat/messages/${messageId}/flag`);
            Alert.alert(t('community_hub.reported'), t('community_hub.reported_msg'));
            fetchData();
        } catch (error) {
            console.error("Flag error:", error);
        }
    };

    const votePoll = async (messageId, optionId) => {
        try {
            await client.post(`/chat/messages/${messageId}/vote`, { option_id: optionId });
            fetchData();
        } catch (error) {
            console.error("Vote error:", error);
        }
    };

    const totalVotes = (pollResults) => {
        if (!pollResults) return 0;
        return Object.values(pollResults).reduce((a, b) => a + b, 0);
    };

    const renderMessage = ({ item }) => {
        return (
        <View style={styles.messageCard}>
            <View style={styles.messageHeader}>
                <View style={styles.authorInfo}>
                    <TouchableOpacity onPress={() => navigation.navigate('DirectMessage', { targetId: item.author_id, targetName: item.author?.full_name })}>
                        <Image 
                            source={item.author?.profile_image ? { uri: item.author.profile_image } : require('../../assets/default-avatar.png')} 
                            style={styles.avatar} 
                        />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.authorName}>{item.author?.full_name || "Unknown User"}</Text>
                        <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    {item.author?.karma_points > 50 && (
                    <View style={styles.karmaBadge}>
                        <Ionicons name="sparkles" size={10} color="#FFD700" />
                        <Text style={styles.karmaText}>{item.author.karma_points}</Text>
                    </View>
                    )}
                </View>
            </View>
            <Text style={styles.messageContent}>
                {item.content.split(' ').map((word, i) => {
                    if (word.startsWith('@')) return <Text key={i} style={styles.mentionText}>{word} </Text>;
                    if (word.startsWith('#')) return <Text key={i} style={styles.hashtagText}>{word} </Text>;
                    return word + ' ';
                })}
            </Text>

            {/* Poll Rendering */}
            {item.is_poll && item.poll_options && (
                <View style={styles.pollContainer}>
                    {item.poll_options.map(opt => {
                        const votesCount = item.poll_results?.[opt.id] || 0;
                        const total = totalVotes(item.poll_results);
                        const percentage = total === 0 ? 0 : Math.round((votesCount / total) * 100);
                        const isVoted = item.has_voted === opt.id;

                        return (
                            <TouchableOpacity 
                                key={opt.id} 
                                style={[styles.pollOption, isVoted && styles.pollOptionVoted]}
                                onPress={() => votePoll(item.id, opt.id)}
                            >
                                <View style={[styles.pollProgress, { width: `${percentage}%`, backgroundColor: isVoted ? 'rgba(76, 175, 80, 0.2)' : 'rgba(0,0,0,0.05)' }]} />
                                <View style={styles.pollOptionLabel}>
                                    <Text style={[styles.pollOptionText, isVoted && styles.pollOptionTextVoted]}>{opt.text}</Text>
                                    <Text style={styles.pollOptionPercent}>{item.has_voted ? `${percentage}%` : ''}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    <Text style={styles.pollTotalText}>{totalVotes(item.poll_results)} {t('community_hub.votes')}</Text>
                </View>
            )}

            <View style={styles.messageActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleReaction(item.id)}>
                    <Ionicons 
                        name={item.reactions?.some(r => r.user_id === user.id) ? "heart" : "heart-outline"} 
                        size={18} 
                        color={item.reactions?.some(r => r.user_id === user.id) ? '#E91E63' : COLORS.textSecondary} 
                    />
                    {item.reactions?.length > 0 && <Text style={styles.actionCount}>{item.reactions.length}</Text>}
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('DirectMessage', { targetId: item.author_id, targetName: item.author?.full_name })}
                >
                    <Ionicons name="chatbubble-outline" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <View style={{flex: 1}} />
                <TouchableOpacity style={styles.actionBtn} onPress={() => flagMessage(item.id)}>
                    <Ionicons name="flag-outline" size={16} color="#B0BEC5" />
                </TouchableOpacity>
            </View>
        </View>
    )};


    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('community_hub.title')}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Payouts')}>
                    <View style={styles.karmaControl}>
                        <Ionicons name="wallet" size={16} color={COLORS.primary} />
                        <Text style={styles.karmaBalance}>{user?.available_karma || 0} {t('community_hub.pts')}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* TAB SELECTOR */}
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'global' && styles.activeTab]} onPress={() => setActiveTab('global')}>
                    <Text style={[styles.tabText, activeTab === 'global' && styles.activeTabText]}>{t('community_hub.global_chat')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'nearby' && styles.activeTab]} onPress={() => setActiveTab('nearby')}>
                    <Text style={[styles.tabText, activeTab === 'nearby' && styles.activeTabText]}>{t('community_hub.nearby')}</Text>
                </TouchableOpacity>
            </View>

            {/* ACTIVE ONLINE USERS */}
            {onlineUsers?.length > 0 && (
                <View style={styles.onlineSection}>
                    <Text style={styles.onlineTitle}>{t('community_hub.active_now')} ({onlineUsers.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: SPACING.md}}>
                        {onlineUsers.map(u => (
                            <TouchableOpacity 
                                key={u.id} 
                                style={styles.onlineUserContainer}
                                onPress={() => navigation.navigate('DirectMessage', { targetId: u.id, targetName: u.full_name })}
                            >
                                <View style={styles.onlineAvatarWrapper}>
                                    <Image 
                                        source={u.profile_image ? { uri: u.profile_image } : require('../../assets/default-avatar.png')} 
                                        style={styles.onlineAvatar} 
                                    />
                                    <View style={styles.onlineDot} />
                                </View>
                                <Text style={styles.onlineName} numberOfLines={1}>
                                    {(u.full_name || 'User').split(' ')[0]}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* TRENDING TAGS */}
            {activeTab === 'global' && (
                <View style={styles.trendingSection}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: SPACING.md}}>
                        <TouchableOpacity 
                            style={[styles.tagPill, selectedTag === null && styles.tagPillActive]} 
                            onPress={() => setSelectedTag(null)}
                        >
                            <Text style={[styles.tagPillText, selectedTag === null && styles.tagPillTextActive]}>#all</Text>
                        </TouchableOpacity>
                        {trendingTags.map((tagObj, idx) => (
                            <TouchableOpacity 
                                key={idx} 
                                style={[styles.tagPill, selectedTag === tagObj.tag && styles.tagPillActive]} 
                                onPress={() => setSelectedTag(tagObj.tag)}
                            >
                                <Text style={[styles.tagPillText, selectedTag === tagObj.tag && styles.tagPillTextActive]}>#{tagObj.tag}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    inverted
                />
            )}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
                {isPollMode && (
                    <View style={styles.pollComposer}>
                        <Text style={styles.pollComposerTitle}>{t('community_hub.create_poll')}</Text>
                        {pollOptions.map((opt, index) => (
                            <TextInput
                                key={opt.id}
                                style={styles.pollInput}
                                placeholder={`Option ${index + 1}`}
                                value={opt.text}
                                onChangeText={(val) => {
                                    const newOpts = [...pollOptions];
                                    newOpts[index].text = val;
                                    setPollOptions(newOpts);
                                }}
                            />
                        ))}
                        {pollOptions.length < 4 && (
                            <TouchableOpacity style={styles.addOptionBtn} onPress={() => setPollOptions([...pollOptions, {id: Date.now(), text: ''}])}>
                                <Text style={styles.addOptionText}>{t('community_hub.add_option')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                <View style={styles.inputArea}>
                    <TouchableOpacity onPress={() => setIsPollMode(!isPollMode)} style={styles.composerIconBtn}>
                        <Ionicons name={isPollMode ? "close-circle" : "bar-chart"} size={24} color={isPollMode ? COLORS.danger : COLORS.textSecondary} />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.input}
                        placeholder={isPollMode ? t('community_hub.ask_question') : (activeTab === 'global' ? t('community_hub.post_global') : t('community_hub.post_nearby'))}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity 
                        style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
                        onPress={sendMessage}
                        disabled={!inputText.trim() || isSending}
                    >
                        <Ionicons name="send" size={20} color={COLORS.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FA' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.white },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    karmaControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    karmaBalance: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary, marginLeft: 5 },
    tabContainer: { flexDirection: 'row', backgroundColor: COLORS.white, paddingBottom: 5 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: COLORS.primary },
    tabText: { fontSize: 14, color: COLORS.textSecondary },
    activeTabText: { color: COLORS.primary, fontWeight: 'bold' },
    
    trendingSection: { backgroundColor: COLORS.white, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    tagPill: { backgroundColor: '#F0F2F5', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, marginRight: 8 },
    tagPillActive: { backgroundColor: COLORS.primary },
    tagPillText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
    tagPillTextActive: { color: COLORS.white },
    
    onlineSection: { height: 80, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingVertical: 10 },
    onlineUser: { alignItems: 'center', marginRight: 15, width: 50 },
    avatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEE' },
    onlineStatusDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#FFF' },
    onlineName: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4 },
    
    listContent: { padding: SPACING.md },
    messageCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    authorInfo: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEE', marginRight: 10 },
    authorName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    timestamp: { fontSize: 11, color: '#A0AAB5', marginTop: 2 },
    karmaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9C4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    karmaText: { fontSize: 10, fontWeight: 'bold', color: '#FBC02D', marginLeft: 3 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    
    messageContent: { fontSize: 15, color: '#334155', lineHeight: 22 },
    mentionText: { color: COLORS.primary, fontWeight: 'bold' },
    hashtagText: { color: '#009688', fontWeight: 'bold' },

    pollContainer: { marginTop: 15, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    pollOption: { height: 40, justifyContent: 'center', marginBottom: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFF' },
    pollOptionVoted: { borderColor: '#4CAF50' },
    pollProgress: { position: 'absolute', left: 0, top: 0, bottom: 0 },
    pollOptionLabel: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
    pollOptionText: { fontSize: 14, color: '#475569', fontWeight: '500' },
    pollOptionTextVoted: { color: '#2E7D32', fontWeight: '700' },
    pollOptionPercent: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    pollTotalText: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 5 },

    messageActions: { flexDirection: 'row', marginTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, alignItems: 'center' },
    actionBtn: { marginRight: 25, flexDirection: 'row', alignItems: 'center' },
    actionCount: { fontSize: 13, color: COLORS.textSecondary, marginLeft: 6, fontWeight: '500' },
    
    pollComposer: { backgroundColor: '#FFF', padding: 15, borderTopWidth: 1, borderTopColor: '#EEE' },
    pollComposerTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
    pollInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#F8FAFC' },
    addOptionBtn: { alignSelf: 'flex-start', paddingVertical: 5 },
    addOptionText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },

    inputArea: { flexDirection: 'row', padding: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#EEE', alignItems: 'flex-end', paddingBottom: Platform.OS === 'ios' ? 25 : 12 },
    composerIconBtn: { padding: 10, paddingBottom: 8 },
    input: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100, fontSize: 15, color: '#334155' },
    sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 },
    sendBtnDisabled: { backgroundColor: '#CBD5E1' },
    
    onlineSection: { backgroundColor: COLORS.white, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    onlineTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginLeft: SPACING.md, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    onlineUserContainer: { alignItems: 'center', marginRight: 18, width: 55 },
    onlineAvatarWrapper: { position: 'relative' },
    onlineAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#F1F5F9' },
    onlineDot: { position: 'absolute', right: 0, bottom: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: COLORS.white },
    onlineName: { fontSize: 11, color: COLORS.text, marginTop: 4, fontWeight: '500', textAlign: 'center' }
});
