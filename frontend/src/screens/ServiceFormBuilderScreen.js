import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getServiceFormFields, saveServiceFormFields } from '../api/marketplace';
import { COLORS, SPACING } from '../constants/theme';

const FIELD_TYPES = [
    { label: 'Short Answer', value: 'short_answer' },
    { label: 'Long Answer', value: 'long_answer' },
    { label: 'Dropdown', value: 'dropdown' },
    { label: 'Multiple Choice', value: 'multiple_choice' },
    { label: 'Scale 1-10', value: 'scale' },
];

const ServiceFormBuilderScreen = ({ route, navigation }) => {
    const { serviceId, serviceTitle, initialFields, onSaveFields } = route.params;
    const [fields, setFields] = useState(initialFields || []);
    const [loading, setLoading] = useState(false); // No need to load if we have initialFields
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (serviceId && !initialFields) {
            setLoading(true);
            fetchFields();
        }
    }, [serviceId]);

    const fetchFields = async () => {
        try {
            const data = await getServiceFormFields(serviceId);
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

        const fieldsToSave = fields.map((f, index) => ({
            field_type: f.field_type,
            label: f.label,
            options: f.options,
            is_required: f.is_required,
            sort_order: index
        }));

        if (!serviceId) {
            // Creation mode: Pass back to parent
            if (onSaveFields) {
                onSaveFields(fieldsToSave);
                Alert.alert('Success', 'Registration form draft curated!');
                navigation.goBack();
            }
            return;
        }

        // Edit mode: Save to API
        setSaving(true);
        try {
            await saveServiceFormFields(serviceId, fieldsToSave);
            Alert.alert('Success', 'Registration form curated successfully!');
            navigation.goBack();
        } catch (error) {
            console.error('Error saving form:', error);
            Alert.alert('Error', 'Failed to save form fields');
        } finally {
            setSaving(false);
        }
    };

    const addField = () => {
        setFields([
            ...fields,
            {
                field_type: 'short_answer',
                label: '',
                options: [],
                is_required: false,
                sort_order: fields.length
            }
        ]);
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
                            <Ionicons name="close-circle" size={24} color={COLORS.error} />
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
                    <Ionicons name="add" size={16} color={COLORS.primary} />
                    <Text style={styles.addOptionText}>Add Option</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderField = ({ item, index }) => (
        <View style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
                <Text style={styles.fieldNumber}>Question {index + 1}</Text>
                <TouchableOpacity onPress={() => deleteField(index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.error} />
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
                                    updateField(index, 'options', [{ value: 'Option 1' }]);
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
                    trackColor={{ true: COLORS.primary, false: '#e0e0e0' }}
                />
            </View>
        </View>
    );

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ marginTop: 10, color: COLORS.textSecondary }}>Loading form curated questions...</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Registration Form Builder</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>{serviceTitle}</Text>
                    </View>
                </View>

                <FlatList
                    data={fields}
                    keyExtractor={(_, index) => `field_${index}`}
                    renderItem={renderField}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyText}>No questions added yet.</Text>
                            <Text style={styles.emptySubtext}>Curate custom questions for participants.</Text>
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
                            <Text style={styles.saveBtnText}>Save Form Structure</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: SPACING.md, 
        backgroundColor: '#fff', 
        borderBottomWidth: 1, 
        borderBottomColor: '#eee' 
    },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    headerSubtitle: { fontSize: 13, color: COLORS.textSecondary },
    listContent: { padding: SPACING.lg, paddingBottom: 100 },
    emptyContainer: { alignItems: 'center', padding: 40, marginTop: 40 },
    emptyText: { fontSize: 18, color: '#333', marginTop: 16, fontWeight: 'bold' },
    emptySubtext: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
    fieldCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: COLORS.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    fieldNumber: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
    questionInput: { fontSize: 16, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, color: '#333', marginBottom: 16 },
    typeContainer: { marginBottom: 16 },
    typeLabel: { fontSize: 12, color: '#666', marginBottom: 8, fontWeight: '500' },
    typeList: { flexDirection: 'row' },
    typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#eee', marginRight: 8 },
    typeChipActive: { backgroundColor: COLORS.primary },
    typeChipText: { fontSize: 12, color: '#666' },
    typeChipTextActive: { color: '#fff', fontWeight: 'bold' },
    optionsContainer: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc' },
    optionsLabel: { fontSize: 12, color: '#666', marginBottom: 8, fontWeight: '500' },
    optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    optionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ccc', marginRight: 10 },
    optionInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginRight: 10 },
    addOptionBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    addOptionText: { color: COLORS.primary, fontSize: 14, marginLeft: 4, fontWeight: '500' },
    requiredRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
    requiredLabel: { fontSize: 14, color: '#333', fontWeight: '500' },
    addFieldBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.text, padding: 16, borderRadius: 12, marginVertical: 10 },
    addFieldBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
    saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default ServiceFormBuilderScreen;
