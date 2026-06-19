import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    StyleSheet, ActivityIndicator, Alert, Switch
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { COLORS, SPACING } from '../constants/theme';

const USER_TYPES = [
    'dog owner',
    'non-dog owner',
    'youth',
    'elder',
    'community leader',
    'veterinarian',
    'trainer',
    'animal welfare advocate',
    'other',
];

const PARTICIPATION_TYPES = [
    'story lab',
    'listening circle',
    'podcast listener',
    'community dialogue',
    'other',
];

const LIKERT_LABELS = {
    1: 'Strongly Disagree',
    2: 'Disagree',
    3: 'Not Sure',
    4: 'Agree',
    5: 'Strongly Agree',
};

const emptyProfile = {
    full_name: '',
    anonymous_code: '',
    phone_number: '',
    county: '',
    community_location: '',
    user_type: 'dog owner',
    participation_type: 'story lab',
    consent: false,
};

export const ScorecardSurveyScreen = ({ route, navigation }) => {
    const { eventId, eventTitle, surveyType = 'baseline' } = route.params || {};
    const normalizedType = surveyType === 'followup' ? 'followup' : 'baseline';
    const [questions, setQuestions] = useState([]);
    const [profile, setProfile] = useState(emptyProfile);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const loadQuestions = async () => {
            try {
                const res = await client.get('/scorecard/questions', { params: { survey_type: normalizedType } });
                setQuestions(res.data || []);
            } catch (error) {
                Alert.alert('Error', 'Could not load Scorecard questions.');
            } finally {
                setLoading(false);
            }
        };
        loadQuestions();
    }, [normalizedType]);

    const setProfileValue = (key, value) => setProfile(prev => ({ ...prev, [key]: value }));
    const setAnswerValue = (questionId, value) => setAnswers(prev => ({ ...prev, [questionId]: value }));

    const validate = () => {
        if (!profile.full_name.trim() && !profile.anonymous_code.trim()) {
            Alert.alert('Required', 'Add a full name or anonymous participant code.');
            return false;
        }
        if (!profile.county.trim() || !profile.community_location.trim()) {
            Alert.alert('Required', 'County and community/location are required.');
            return false;
        }
        if (!profile.consent) {
            Alert.alert('Consent required', 'Please confirm anonymized data consent before submitting.');
            return false;
        }
        for (const question of questions) {
            const value = answers[question.id];
            if (question.question_type === 'likert' && !value) {
                Alert.alert('Required', `Select a score for: ${question.prompt}`);
                return false;
            }
            if (question.question_type === 'open' && !String(value || '').trim()) {
                Alert.alert('Required', `Answer: ${question.prompt}`);
                return false;
            }
        }
        return true;
    };

    const submit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            const responses = questions.map(question => ({
                question_id: question.id,
                answer_numeric: question.question_type === 'likert' ? Number(answers[question.id]) : null,
                answer_text: question.question_type === 'open' ? String(answers[question.id] || '').trim() : null,
            }));

            const res = await client.post(`/events/${eventId}/scorecard/surveys`, {
                survey_type: normalizedType,
                participant: {
                    ...profile,
                    full_name: profile.full_name.trim() || null,
                    anonymous_code: profile.anonymous_code.trim() || null,
                    phone_number: profile.phone_number.trim() || null,
                    county: profile.county.trim(),
                    community_location: profile.community_location.trim(),
                },
                responses,
            });

            const result = res.data;
            Alert.alert(
                'Scorecard submitted',
                `Coexistence Index: ${result.coexistence_index}%${result.percentage_change !== null && result.percentage_change !== undefined ? `\nChange: ${result.percentage_change} pts` : ''}`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            Alert.alert('Error', error.response?.data?.detail || 'Could not submit the Scorecard.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading Scorecard...</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Mbwa Rafiki Coexistence Scorecard</Text>
                    <Text style={styles.headerSub}>{eventTitle || 'Event'} | {normalizedType === 'baseline' ? 'Baseline Survey' : 'Follow-up Survey'}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Participant profile</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Full name"
                        value={profile.full_name}
                        onChangeText={(value) => setProfileValue('full_name', value)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Anonymous code"
                        value={profile.anonymous_code}
                        onChangeText={(value) => setProfileValue('anonymous_code', value)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Phone number (optional)"
                        keyboardType="phone-pad"
                        value={profile.phone_number}
                        onChangeText={(value) => setProfileValue('phone_number', value)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="County"
                        value={profile.county}
                        onChangeText={(value) => setProfileValue('county', value)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Community/location"
                        value={profile.community_location}
                        onChangeText={(value) => setProfileValue('community_location', value)}
                    />

                    <Text style={styles.label}>User type</Text>
                    <View style={styles.pickerBox}>
                        <Picker selectedValue={profile.user_type} onValueChange={(value) => setProfileValue('user_type', value)}>
                            {USER_TYPES.map(type => <Picker.Item key={type} label={type} value={type} />)}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Participation type</Text>
                    <View style={styles.pickerBox}>
                        <Picker selectedValue={profile.participation_type} onValueChange={(value) => setProfileValue('participation_type', value)}>
                            {PARTICIPATION_TYPES.map(type => <Picker.Item key={type} label={type} value={type} />)}
                        </Picker>
                    </View>

                    <View style={styles.consentRow}>
                        <Text style={styles.consentText}>I agree for anonymized data to be used for learning and reporting.</Text>
                        <Switch value={profile.consent} onValueChange={(value) => setProfileValue('consent', value)} />
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>{normalizedType === 'baseline' ? 'Baseline questions' : 'Follow-up questions'}</Text>
                    <Text style={styles.helpText}>
                        1 = Strongly Disagree, 2 = Disagree, 3 = Not Sure, 4 = Agree, 5 = Strongly Agree
                    </Text>
                    {questions.map((question, index) => (
                        <View key={question.id} style={styles.questionBlock}>
                            <Text style={styles.questionText}>{index + 1}. {question.prompt}</Text>
                            {question.category ? <Text style={styles.categoryText}>{question.category}</Text> : null}

                            {question.question_type === 'likert' ? (
                                <View style={styles.scaleRow}>
                                    {[1, 2, 3, 4, 5].map(value => (
                                        <TouchableOpacity
                                            key={value}
                                            style={[styles.scaleBtn, answers[question.id] === value && styles.scaleBtnActive]}
                                            onPress={() => setAnswerValue(question.id, value)}
                                        >
                                            <Text style={[styles.scaleText, answers[question.id] === value && styles.scaleTextActive]}>{value}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    {answers[question.id] ? (
                                        <Text style={styles.scaleLabel}>{LIKERT_LABELS[answers[question.id]]}</Text>
                                    ) : null}
                                </View>
                            ) : (
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    multiline
                                    placeholder="Your answer"
                                    value={answers[question.id] || ''}
                                    onChangeText={(value) => setAnswerValue(question.id, value)}
                                />
                            )}
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={submit} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Scorecard</Text>}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F7F7FA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loadingText: { marginTop: 10, color: COLORS.textSecondary },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 44,
        paddingHorizontal: 18,
        paddingBottom: 14,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backBtn: { marginRight: 12, padding: 4 },
    headerTitle: { fontSize: 18, color: COLORS.primary, fontWeight: '800' },
    headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
    content: { padding: SPACING.md, paddingBottom: 40 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ececec',
    },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.primary, marginBottom: 10 },
    helpText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 12 },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
        backgroundColor: '#FAFAFA',
        color: COLORS.text,
    },
    textArea: { minHeight: 88, textAlignVertical: 'top' },
    label: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 6, marginTop: 4 },
    pickerBox: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginBottom: 10, backgroundColor: '#FAFAFA', overflow: 'hidden' },
    consentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    consentText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, marginRight: 10 },
    questionBlock: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    questionText: { color: COLORS.text, fontWeight: '700', fontSize: 14, lineHeight: 20 },
    categoryText: { color: COLORS.accentDark || COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
    scaleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 },
    scaleBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
    scaleBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    scaleText: { color: COLORS.text, fontWeight: '800' },
    scaleTextActive: { color: '#fff' },
    scaleLabel: { color: COLORS.textSecondary, fontSize: 12, marginLeft: 4 },
    submitBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 30 },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

export default ScorecardSurveyScreen;
