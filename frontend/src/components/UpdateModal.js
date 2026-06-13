import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  Linking
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const UpdateModal = ({
  visible,
  versionInfo,
  isRequired = false,
  onClose,
  onUpdate
}) => {
  const { t } = useTranslation();
  const handleOpenStore = async () => {
    if (!versionInfo?.download_url) {
      Alert.alert(t('common.error'), t('app_update.download_url_missing'));
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(versionInfo.download_url);
      if (canOpen) {
        await Linking.openURL(versionInfo.download_url);
        onUpdate?.();
      } else {
        Alert.alert(t('common.error'), t('app_update.open_store_error'));
      }
    } catch (error) {
      console.error('Error opening store:', error);
      Alert.alert(t('common.error'), t('app_update.open_store_failed'));
    }
  };

  if (!versionInfo) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isRequired ? undefined : onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name={isRequired ? 'alert-circle' : 'download'}
                size={48}
                color={isRequired ? '#e74c3c' : '#3498db'}
              />
            </View>
            <Text style={styles.title}>
              {isRequired ? t('app_update.critical_update') : t('app_update.update_available')}
            </Text>
            <Text style={styles.version}>{t('app_update.version', { version: versionInfo.version })}</Text>
          </View>

          {/* Content */}
          <ScrollView style={styles.content}>
            <Text style={styles.subtitle}>
              {isRequired
                ? t('app_update.required_subtitle')
                : t('app_update.available_subtitle')}
            </Text>

            {versionInfo.release_notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesTitle}>{t('app_update.whats_new')}</Text>
                <Text style={styles.releaseNotes}>{versionInfo.release_notes}</Text>
              </View>
            )}

            <View style={styles.infoBox}>
              <MaterialCommunityIcons
                name="shield-check"
                size={20}
                color="#27ae60"
                style={styles.infoIcon}
              />
              <Text style={styles.infoText}>
                {t('app_update.safe_download')}
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            {!isRequired && (
              <TouchableOpacity
                style={[styles.button, styles.laterButton]}
                onPress={onClose}
              >
                <Text style={styles.laterButtonText}>{t('app_update.later')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleOpenStore}
            >
              <MaterialCommunityIcons
                name="download"
                size={20}
                color="white"
                style={styles.buttonIcon}
              />
              <Text style={styles.updateButtonText}>{t('app_update.update_now')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    maxHeight: '80%',
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa'
  },
  iconContainer: {
    marginBottom: 12
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4
  },
  version: {
    fontSize: 14,
    color: '#7f8c8d'
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 300
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16
  },
  notesContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1'
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8
  },
  releaseNotes: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  infoIcon: {
    marginRight: 8
  },
  infoText: {
    fontSize: 12,
    color: '#27ae60',
    flex: 1
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1'
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  laterButton: {
    backgroundColor: '#ecf0f1'
  },
  laterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50'
  },
  updateButton: {
    backgroundColor: '#3498db'
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginLeft: 6
  },
  buttonIcon: {
    marginRight: 4
  }
});

export default UpdateModal;
