import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEventFormFields, saveEventFormFields } from '../api/events';

const FIELD_TYPES = [
    { labelKey: 'form_builder.types.short_answer', value: 'short_answer' },
    { labelKey: 'form_builder.types.long_answer', value: 'long_answer' },
    { labelKey: 'form_builder.types.dropdown', value: 'dropdown' },
    { labelKey: 'form_builder.types.multiple_choice', value: 'multiple_choice' },
    { labelKey: 'form_builder.types.scale', value: 'scale' },
];

const EventFormBuilderScreen = ({ route, navigation }) => {
    const { t } = useTranslation();
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
            Alert.alert(t('common.error'), t('form_builder.load_error'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validate
        for (let i = 0; i < fields.length; i++) {
            if (!fields[i].label.trim()) {
                Alert.alert(t('form_builder.validation_error'), t('form_builder.missing_label', { number: i + 1 }));
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
            Alert.alert(t('common.success'), t('form_builder.saved'));
            navigation.goBack();
        } catch (error) {
            console.error('Error saving form:', error);
            Alert.alert(t('common.error'), t('form_builder.save_error'));
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
                <Text style={styles.optionsLabel}>{t('form_builder.options')}</Text>
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
                            placeholder={t('form_builder.option_placeholder', { number: optIndex + 1 })}
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
                    <Text style={styles.addOptionText}>{t('form_builder.add_option')}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderField = ({ item, index }) => (
        <View style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
                <Text style={styles.fieldNumber}>{t('form_builder.question_number', { number: index + 1 })}</Text>
                <TouchableOpacity onPress={() => deleteField(index)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
            </View>

            <TextInput
                style={styles.questionInput}
                placeholder={t('form_builder.question_placeholder')}
                value={item.label}
                onChangeText={(text) => updateField(index, 'label', text)}
            />

            <View style={styles.typeContainer}>
                <Text style={styles.typeLabel}>{t('form_builder.type')}</Text>
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
                                {t(type.labelKey)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {renderOptionsBuilder(item, index)}

            <View style={styles.requiredRow}>
                <Text style={styles.requiredLabel}>{t('form_builder.required_question')}</Text>
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
                <Text style={styles.headerTitle}>{t('form_builder.title')}</Text>
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
                        <Text style={styles.emptyText}>{t('form_builder.no_questions')}</Text>
                        <Text style={styles.emptySubtext}>{t('form_builder.no_questions_subtitle')}</Text>
                    </View>
                }
                ListFooterComponent={
                    <TouchableOpacity style={styles.addFieldBtn} onPress={addField}>
                        <Ionicons name="add-circle-outline" size={24} color="#fff" />
                        <Text style={styles.addFieldBtnText}>{t('form_builder.add_question')}</Text>
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
                        <Text style={styles.saveBtnText}>{t('form_builder.save_form')}</Text>
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
