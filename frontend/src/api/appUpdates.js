import client from './client';
import { Platform } from 'react-native';

/**
 * Get the latest app version available from the server
 * @param {string} platform - "android", "ios", or "all"
 * @returns {Promise<object>} Latest version info or null
 */
export const getLatestAppVersion = async (platform = null) => {
  try {
    // Detect platform if not provided
    if (!platform) {
      platform = Platform.OS === 'ios' ? 'ios' : 'android';
    }

    const response = await client.get('/app/version/latest', {
      params: { platform }
    });

    return response.data || null;
  } catch (error) {
    console.error('Error fetching app version:', error);
    return null;
  }
};

/**
 * Compare two semantic versions
 * @param {string} current - Current version (e.g., "1.0.1")
 * @param {string} latest - Latest version (e.g., "1.0.2")
 * @returns {number} -1 if current < latest, 0 if equal, 1 if current > latest
 */
export const compareVersions = (current, latest) => {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;

    if (currPart < latestPart) return -1;
    if (currPart > latestPart) return 1;
  }

  return 0;
};

/**
 * Check if an update is available
 * @param {string} currentVersion - Current app version
 * @param {string} platform - "ios" or "android"
 * @returns {Promise<object>} Update info {isAvailable, isRequired, versionInfo} or null
 */
export const checkForUpdates = async (currentVersion, platform = null) => {
  try {
    const latestVersion = await getLatestAppVersion(platform);

    if (!latestVersion) {
      return null;
    }

    const comparison = compareVersions(currentVersion, latestVersion.version);

    if (comparison < 0) {
      // Update is available
      return {
        isAvailable: true,
        isRequired: latestVersion.is_required,
        versionInfo: latestVersion
      };
    }

    return {
      isAvailable: false,
      isRequired: false,
      versionInfo: null
    };
  } catch (error) {
    console.error('Error checking for updates:', error);
    return null;
  }
};
