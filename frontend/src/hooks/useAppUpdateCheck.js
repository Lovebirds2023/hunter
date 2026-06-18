import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkForUpdates } from '../api/appUpdates';

const UPDATE_CHECK_KEY = 'last_update_check';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Check once per day

/**
 * Custom hook for checking app updates
 * Automatically checks for updates on app startup and periodically
 * @param {string} currentVersion - Current app version from package.json
 * @param {function} onUpdateAvailable - Callback when update is available
 * @param {function} onUpdateRequired - Callback when critical update is required
 * @returns {object} {checking, updateInfo, manualCheck}
 */
export const useAppUpdateCheck = (currentVersion, onUpdateAvailable, onUpdateRequired) => {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    const checkUpdates = async () => {
      if (checkingRef.current) return;

      try {
        checkingRef.current = true;
        setChecking(true);

        // Check if we should skip checking based on interval
        const lastCheck = await AsyncStorage.getItem(UPDATE_CHECK_KEY);
        if (lastCheck) {
          const lastCheckTime = parseInt(lastCheck, 10);
          const now = Date.now();
          if (now - lastCheckTime < CHECK_INTERVAL) {
            // Not enough time has passed, skip this check
            setChecking(false);
            checkingRef.current = false;
            return;
          }
        }

        // Check for updates
        const result = await checkForUpdates(currentVersion);

        if (result && result.isAvailable) {
          setUpdateInfo(result.versionInfo);

          // Call appropriate callback
          if (result.isRequired) {
            onUpdateRequired?.(result.versionInfo);
          } else {
            onUpdateAvailable?.(result.versionInfo);
          }
        }

        // Update last check time
        await AsyncStorage.setItem(UPDATE_CHECK_KEY, Date.now().toString());
      } catch (error) {
        console.error('Error in useAppUpdateCheck:', error);
      } finally {
        setChecking(false);
        checkingRef.current = false;
      }
    };

    checkUpdates();
  }, [currentVersion, onUpdateAvailable, onUpdateRequired]);

  /**
   * Manually trigger an update check
   */
  const manualCheck = async () => {
    try {
      setChecking(true);
      const result = await checkForUpdates(currentVersion);

      if (result && result.isAvailable) {
        setUpdateInfo(result.versionInfo);

        if (result.isRequired) {
          onUpdateRequired?.(result.versionInfo);
        } else {
          onUpdateAvailable?.(result.versionInfo);
        }
      } else {
        // Notify user that app is up to date
        if (__DEV__) console.log('App is up to date');
      }
    } catch (error) {
      console.error('Error in manual update check:', error);
    } finally {
      setChecking(false);
    }
  };

  return {
    checking,
    updateInfo,
    manualCheck
  };
};
