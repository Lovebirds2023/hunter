import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEventFormFields, saveEventFormFields } from '../api/events';

const FIELD_TYPES = [
    { label: 'Short Answer', value: 'short_answer' },
    { label: 'Long Answer', value: 'long_answer' },
    { label: 'Dropdown', value: 'dropdown' },
    { label: 'Multiple Choice', value: 'multiple_choice' },
    { label: 'Scale 1-10', value: 'scale' },
];

const EventFormBuilderScreen = ({ route, navigation }) => {
    const { eventId, eventTitle } = route.params;
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchFields();
    }, []);

    const fetchFields = async () => {
        try {
            const data = await getEventFormFields(eventId);
            setFields(data || []);
        } catch (error) {
            console.error('Error fetching form fields:', error);
            Alert.alert('Error', 'Failed to load form fields');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validate
        for (let i = 0; i < fields.length; i++) {
            if (!fields[i].label.trim()) {
                Alert.alert('Validation Error', `Question ${i + 1} is missing a label.`);
                return;
            }
        }

        setSaving(true);
        try {
            const fieldsToSave = fields.map((f, index) => ({
                field_type: f.field_type,
                label: f.label,
                options: f.options,
                is_required: f.is_required,
                sort_order: index
            }));
            await saveEventFormFields(eventId, fieldsToSave);
            Alert.alert('Success', 'Form saved safely!');
            navigation.goBack();
        } catch (error) {
            console.error('Error saving form:', error);
            Alert.alert('Error', 'Failed to save form fields');
        } finally {
            setSaving(false);
        }
    };

    const addField = () => {
        setFields([...fields, { 
            field_type: 'short_answer', 
            label: '', 
            options: [], 
            is_required: false 
        }]);
    };

    const updateField = (index, key, value) => {
        const newFields = [...fields];
        newFields[index][key] = value;
        setFields(newFields);
    };

    const deleteField = (index) => {
        const newFields = fields.filter((_, i) => i !== index);
        setFields(newFields);
    };

    const renderOptionsBuilder = (field, index) => {
        if (!['dropdown', 'multiple_choice'].includes(field.field_type)) return null;

        return (
            <View style={styles.optionsContainer}>
                <Text style={styles.optionsLabel}>Options:</Text>
                {field.options && field.options.map((opt, optIndex) => (
                    <View key={optIndex} style={styles.optionRow}>
                        <View style={styles.optionDot} />
                        <TextInput
                            style={styles.optionInput}
                            value={opt.value}
                            onChangeText={(text) => {
                                const newFields = [...fields];
                                newFields[index].options[optIndex].value = text;
                                setFields(newFields);
                            }}
                            placeholder={`Option ${optIndex + 1}`}
                        />
                        <TouchableOpacity onPress={() => {
                            const newFields = [...fields];
                            newFields[index].options.splice(optIndex, 1);
                            setFields(newFields);
                        }}>
                            <Ionicons name="close-circle" size={24} color="#FF3B30" />
                        </TouchableOpacity>
                    </View>
                ))}
                <TouchableOpacity 
                    style={styles.addOptionBtn}
                    onPress={() => {
                        const newFields = [...fields];
                        if (!newFields[index].options) newFields[index].options = [];
                        newFields[index].options.push({ value: '' });
                        setFields(newFields);
                    }}
                >
                    <Ionicons name="add" size={16} color="#D4AF37" />
                    <Text style={styles.addOptionText}>Add Option</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderField = ({ item, index }) => (
        <View style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
                <Text style={styles.fieldNumber}>Question {index + 1}</Text>
                <TouchableOpacity onPress={() => deleteField(index)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
            </View>

            <TextInput
                style={styles.questionInput}
                placeholder="Question Label (e.g. What is your role?)"
                value={item.label}
                onChangeText={(text) => updateField(index, 'label', text)}
            />

            <View style={styles.typeContainer}>
                <Text style={styles.typeLabel}>Type:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeList}>
                    {FIELD_TYPES.map(type => (
                        <TouchableOpacity 
                            key={type.value}
                            style={[
                                styles.typeChip, 
                                item.field_type === type.value && styles.typeChipActive
                            ]}
                            onPress={() => {
                                updateField(index, 'field_type', type.value);
                                if (['dropdown', 'multiple_choice'].includes(type.value) && (!item.options || item.options.length === 0)) {
                                    updateField(index, 'options', [{value: 'Option 1'}]);
                                }
                            }}
                        >
                            <Text style={[
                                styles.typeChipText,
                                item.field_type === type.value && styles.typeChipTextActive
                            ]}>
                                {type.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {renderOptionsBuilder(item, index)}

            <View style={styles.requiredRow}>
                <Text style={styles.requiredLabel}>Required Question</Text>
                <Switch
                    value={item.is_required}
                    onValueChange={(val) => updateField(index, 'is_required', val)}
                    trackColor={{ true: '#D4AF37', false: '#e0e0e0' }}
                />
            </View>
        </View>
    );

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#D4AF37"/></View>;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Form Builder</Text>
                <Text style={styles.headerSubtitle}>{eventTitle}</Text>
            </View>

            <FlatList
                data={fields}
                keyExtractor={(_, index) => `field_${index}`}
                renderItem={renderField}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="document-text-outline" size={48} color="#ccc" />
                        <Text style={styles.emptyText}>No questions added yet.</Text>
                        <Text style={styles.emptySubtext}>Add questions to collect information from attendees during registration.</Text>
                    </View>
                }
                ListFooterComponent={
                    <TouchableOpacity style={styles.addFieldBtn} onPress={addField}>
                        <Ionicons name="add-circle-outline" size={24} color="#fff" />
                        <Text style={styles.addFieldBtnText}>Add Question</Text>
                    </TouchableOpacity>
                }
            />

            <View style={styles.footer}>
                <TouchableOpacity 
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
                    onPress={handleSave} 
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveBtnText}>Save Form</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
    headerSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
    listContent: { padding: 16, paddingBottom: 100 },
    emptyContainer: { alignItems: 'center', padding: 40 },
    emptyText: { fontSize: 18, color: '#333', marginTop: 16, fontWeight: 'bold' },
    emptySubtext: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
    fieldCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    fieldNumber: { fontSize: 14, fontWeight: '600', color: '#D4AF37' },
    questionInput: { fontSize: 16, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, color: '#333', marginBottom: 16 },
    typeContainer: { marginBottom: 16 },
    typeLabel: { fontSize: 12, color: '#666', marginBottom: 8, fontWeight: '500' },
    typeList: { flexDirection: 'row' },
    typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#eee', marginRight: 8 },
    typeChipActive: { backgroundColor: '#D4AF37' },
    typeChipText: { fontSize: 12, color: '#666' },
    typeChipTextActive: { color: '#fff', fontWeight: 'bold' },
    optionsContainer: { backgroundColor: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 16 },
    optionsLabel: { fontSize: 12, color: '#666', marginBottom: 8, fontWeight: '500' },
    optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    optionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ccc', marginRight: 10 },
    optionInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginRight: 10 },
    addOptionBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    addOptionText: { color: '#D4AF37', fontSize: 14, marginLeft: 4, fontWeight: '500' },
    requiredRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
    requiredLabel: { fontSize: 14, color: '#333', fontWeight: '500' },
    addFieldBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A', padding: 16, borderRadius: 12, marginVertical: 10 },
    addFieldBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
    saveBtn: { backgroundColor: '#D4AF37', borderRadius: 12, padding: 16, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default EventFormBuilderScreen;
