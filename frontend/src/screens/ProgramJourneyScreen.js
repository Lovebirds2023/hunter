import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { SyncContext } from '../context/SyncContext';
import client from '../api/client';

const WHO5_QUESTIONS = [
    "I have felt cheerful and in good spirits",
    "I have felt calm and relaxed",
    "I have felt active and vigorous",
    "I woke up feeling fresh and rested",
    "My daily life has been filled with things that interest me"
];

const WHO5_OPTIONS = [
    { label: "All of the time", value: 5 },
    { label: "Most of the time", value: 4 },
    { label: "More than half the time", value: 3 },
    { label: "Less than half the time", value: 2 },
    { label: "Some of the time", value: 1 },
    { label: "At no time", value: 0 }
];

const PSS_QUESTIONS = [
    "In the last month, how often have you been upset because of something that happened unexpectedly?",
    "In the last month, how often have you felt that you were unable to control the important things in your life?",
    "In the last month, how often have you felt confident about your ability to handle your personal problems?",
    "In the last month, how often have you felt that things were going your way?"
];

const PSS_OPTIONS = [
    { label: "Never", value: 0 },
    { label: "Almost Never", value: 1 },
    { label: "Sometimes", value: 2 },
    { label: "Fairly Often", value: 3 },
    { label: "Very Often", value: 4 }
];

const RELATIONSHIP_QUESTIONS = [
    "I feel confident understanding my dog's needs",
    "I feel a strong bond with my dog"
];

const WELFARE_QUESTIONS = [
    "How often does your dog seem relaxed at home?",
    "Does your dog show signs of anxiety around new people?"
];

// Combine all into a sequence
const buildQuestionSequence = () => {
    let seq = [];
    WHO5_QUESTIONS.forEach((q, i) => seq.push({ id: `who5_${i}`, text: q, options: WHO5_OPTIONS, section: "Wellbeing Check-in" }));
    PSS_QUESTIONS.forEach((q, i) => seq.push({ id: `pss_${i}`, text: q, options: PSS_OPTIONS, section: "Stress Check-in" }));
    RELATIONSHIP_QUESTIONS.forEach((q, i) => seq.push({ id: `rel_${i}`, text: q, options: PSS_OPTIONS, section: "Relationship Check-in" }));
    WELFARE_QUESTIONS.forEach((q, i) => seq.push({ id: `wel_${i}`, text: q, options: PSS_OPTIONS, section: "Dog Welfare Snapshot" }));
    return seq;
};

export const ProgramJourneyScreen = ({ route, navigation }) => {
    const { event_id } = route.params;
    const { queueCheckin } = useContext(SyncContext);
    
    const [journey, setJourney] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Check-in state
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [questions] = useState(buildQuestionSequence());
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});

    useEffect(() => {
        loadJourney();
    }, []);

    const loadJourney = async () => {
        try {
            const res = await client.get(`/events/${event_id}/journey`);
            setJourney(res.data);
        } catch (error) {
            console.error("Failed to load journey", error);
            Alert.alert("Error", "Could not load program journey");
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
        
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            finishCheckIn();
        }
    };

    const finishCheckIn = async () => {
        try {
            // Group answers
            const who5 = {}; const pss = {}; const rel = {}; const wel = {};
            Object.keys(answers).forEach(k => {
                if(k.startsWith('who5_')) who5[k] = answers[k];
                if(k.startsWith('pss_')) pss[k] = answers[k];
                if(k.startsWith('rel_')) rel[k] = answers[k];
                if(k.startsWith('wel_')) wel[k] = answers[k];
            });

            const checkinData = {
                event_id: event_id,
                user_id: journey.user_id,
                dog_id: journey.dog_id,
                timepoint: journey.current_timepoint,
                who5_answers: who5,
                pss10_answers: pss,
                relationship_answers: rel,
                welfare_snapshot: wel
            };
            
            // Queue offline-first
            await queueCheckin(event_id, checkinData);
            
            Alert.alert("Awesome!", "You've successfully checked in.");
            setIsCheckingIn(false);
            
            // Optimistically update journey step
            setJourney(prev => ({
                ...prev,
                current_timepoint: getNextTimepoint(prev.current_timepoint),
                progress_percentage: Math.min(prev.progress_percentage + 25, 100)
            }));
            
        } catch (error) {
            Alert.alert("Error", "Failed to save check-in");
        }
    };

    const getNextTimepoint = (current) => {
        if(current === 'T1') return 'T2';
        if(current === 'T2') return 'T3';
        if(current === 'T3') return 'T4';
        return 'T4';
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary}/></View>;
    if (!journey) return <View style={styles.center}><Text>Journey data not found.</Text></View>;

    if (isCheckingIn) {
        const currentQ = questions[currentIndex];
        const progress = ((currentIndex + 1) / questions.length) * 100;
        
        return (
            <View style={styles.checkinContainer}>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>You're {Math.round(progress)}% done</Text>

                <Text style={styles.sectionTitle}>{currentQ.section}</Text>
                <Text style={styles.questionText}>{currentQ.text}</Text>

                <ScrollView style={styles.optionsContainer}>
                    {currentQ.options.map((opt, i) => (
                        <TouchableOpacity 
                            key={i} 
                            style={styles.optionButton}
                            onPress={() => handleAnswer(currentQ.id, opt.value)}
                        >
                            <Text style={styles.optionText}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
            </TouchableOpacity>

            <View style={styles.headerBox}>
                <Text style={styles.headerTitle}>Your Journey</Text>
                <Text style={styles.headerSubtitle}>Lovedogs 360 Training</Text>
            </View>

            <View style={styles.progressCard}>
                <Text style={styles.milestoneTitle}>Overall Progress: {journey.progress_percentage}%</Text>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${journey.progress_percentage}%` }]} />
                </View>
                
                <View style={styles.timeline}>
                    <View style={styles.timePoint}>
                        <Ionicons name={journey.progress_percentage >= 25 ? "checkmark-circle" : "ellipse-outline"} size={24} color={journey.progress_percentage >= 25 ? COLORS.primary : '#ccc'} />
                        <Text style={styles.timePointText}>T1 (Baseline)</Text>
                    </View>
                    <View style={styles.timePoint}>
                        <Ionicons name={journey.progress_percentage >= 50 ? "checkmark-circle" : "ellipse-outline"} size={24} color={journey.progress_percentage >= 50 ? COLORS.primary : '#ccc'} />
                        <Text style={styles.timePointText}>T2 (Live Sessions)</Text>
                    </View>
                    <View style={styles.timePoint}>
                        <Ionicons name={journey.progress_percentage >= 75 ? "checkmark-circle" : "ellipse-outline"} size={24} color={journey.progress_percentage >= 75 ? COLORS.primary : '#ccc'} />
                        <Text style={styles.timePointText}>T3 (8-Week)</Text>
                    </View>
                    <View style={styles.timePoint}>
                        <Ionicons name={journey.progress_percentage >= 100 ? "checkmark-circle" : "ellipse-outline"} size={24} color={journey.progress_percentage >= 100 ? COLORS.primary : '#ccc'} />
                        <Text style={styles.timePointText}>T4 (6-Month)</Text>
                    </View>
                </View>
            </View>

            {journey.progress_percentage < 100 && (
                <View style={styles.actionCard}>
                    <Text style={styles.actionTitle}>Next Step: {journey.current_timepoint} Check-in</Text>
                    <Text style={styles.actionDesc}>Let's personalize your training by completing this quick check-in.</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => setIsCheckingIn(true)}>
                        <Text style={styles.primaryBtnText}>Start {journey.current_timepoint} Check-in</Text>
                    </TouchableOpacity>
                </View>
            )}

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    center: { flex:1, justifyContent:'center', alignItems:'center' },
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    backBtn: { padding: 20 },
    headerBox: { paddingHorizontal: 20, marginBottom: 20 },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: COLORS.primary },
    headerSubtitle: { fontSize: 18, color: '#666' },
    progressCard: { margin: 20, padding: 20, backgroundColor: 'white', borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    milestoneTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
    progressBarBg: { height: 10, backgroundColor: '#eee', borderRadius: 5, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: COLORS.secondary },
    timeline: { marginTop: 20 },
    timePoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    timePointText: { marginLeft: 10, fontSize: 16, color: '#444' },
    actionCard: { margin: 20, padding: 20, backgroundColor: '#E8F4F8', borderRadius: 15 },
    actionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 10 },
    actionDesc: { fontSize: 14, color: '#555', marginBottom: 20 },
    primaryBtn: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
    primaryBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Check-in styles
    checkinContainer: { flex: 1, backgroundColor: 'white', padding: 20, paddingTop: 60 },
    progressText: { textAlign: 'center', marginTop: 10, color: '#888', marginBottom: 40 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.secondary, textTransform: 'uppercase', marginBottom: 10 },
    questionText: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary, marginBottom: 30 },
    optionsContainer: { flex: 1 },
    optionButton: { padding: 20, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 15, backgroundColor: '#FAFAFA' },
    optionText: { fontSize: 16, color: '#333', textAlign: 'center', fontWeight: '500' }
});
