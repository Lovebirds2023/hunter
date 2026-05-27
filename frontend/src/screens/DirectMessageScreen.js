
import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import client from '../api/client';
import { AuthContext } from '../context/AuthContext';

export const DirectMessageScreen = ({ route, navigation }) => {
    const { targetId, targetName } = route.params;
    const { user } = useContext(AuthContext);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 4000); // 4s polling for private chat
        return () => clearInterval(interval);
    }, [targetId]);

    const fetchMessages = async () => {
        try {
            const response = await client.get('/chat/dms');
            // Filter only messages between me and the target
            const filtered = response.data.filter(m => 
                (m.sender_id === user.id && m.receiver_id === targetId) ||
                (m.sender_id === targetId && m.receiver_id === user.id)
            );
            setMessages(filtered);
        } catch (error) {
            console.error("DM fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim()) return;
        setIsSending(true);
        try {
            await client.post('/chat/dm', {
                receiver_id: targetId,
                content: inputText
            });
            setInputText('');
            fetchMessages();
        } catch (error) {
            console.error("DM send error:", error);
        } finally {
            setIsSending(false);
        }
    };

    const renderMessage = ({ item }) => {
        const isMine = item.sender_id === user.id;
        return (
            <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.theirBubble]}>
                <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText]}>{item.content}</Text>
                <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.targetInfo}>
                    <Text style={styles.targetName}>{targetName || "User"}</Text>
                    <Text style={styles.onlineStatus}>Private Message</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    inverted
                />
            )}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
                <View style={styles.inputArea}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
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
    container: { flex: 1, backgroundColor: '#F0F2F5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.white, elevation: 2, ...SHADOWS.small },
    backBtn: { padding: 5 },
    targetInfo: { flex: 1, alignItems: 'center' },
    targetName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    onlineStatus: { fontSize: 10, color: COLORS.textSecondary },
    listContent: { padding: SPACING.md },
    messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 18, marginBottom: 8, ...SHADOWS.small },
    myBubble: { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 2 },
    theirBubble: { alignSelf: 'flex-start', backgroundColor: COLORS.white, borderBottomLeftRadius: 2 },
    messageText: { fontSize: 15 },
    myText: { color: COLORS.white },
    theirText: { color: COLORS.text },
    timestamp: { fontSize: 9, color: 'rgba(0,0,0,0.4)', marginTop: 4, alignSelf: 'flex-end' },
    inputArea: { flexDirection: 'row', padding: 10, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#DDD', alignItems: 'flex-end' },
    input: { flex: 1, backgroundColor: '#F0F2F5', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100, fontSize: 16 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    sendBtnDisabled: { backgroundColor: '#CCC' }
});
