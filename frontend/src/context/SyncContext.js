import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import client from '../api/client';

export const SyncContext = createContext({});

export const SyncProvider = ({ children }) => {
    const [isOnline, setIsOnline] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        checkNetworkStatus();
        const interval = setInterval(checkNetworkStatus, 15000); // Check every 15 seconds
        return () => clearInterval(interval);
    }, []);

    const checkNetworkStatus = async () => {
        const networkState = await Network.getNetworkStateAsync();
        const online = networkState.isConnected && networkState.isInternetReachable;
        
        if (online && !isOnline) {
            setIsOnline(true);
            // Regained connection, try to sync
            syncQueuedData();
        } else if (!online && isOnline) {
            setIsOnline(false);
        } else if (online) {
            // Even if we were already online, try to sync just in case there's leftover data
            setIsOnline(true);
            syncQueuedData();
        }
    };

    const queueCheckin = async (event_id, checkinData) => {
        try {
            const currentQueue = JSON.parse(await AsyncStorage.getItem(`sync_queue_${event_id}`) || '{"checkins":[],"observations":[]}');
            currentQueue.checkins.push(checkinData);
            await AsyncStorage.setItem(`sync_queue_${event_id}`, JSON.stringify(currentQueue));
            
            if (isOnline) {
                syncQueuedData();
            }
        } catch (error) {
            console.error("Failed to queue checkin:", error);
        }
    };

    const queueObservation = async (event_id, observationData) => {
        try {
            const currentQueue = JSON.parse(await AsyncStorage.getItem(`sync_queue_${event_id}`) || '{"checkins":[],"observations":[]}');
            observationData.is_offline_sync = true;
            currentQueue.observations.push(observationData);
            await AsyncStorage.setItem(`sync_queue_${event_id}`, JSON.stringify(currentQueue));
            
            if (isOnline) {
                syncQueuedData();
            }
        } catch (error) {
            console.error("Failed to queue observation:", error);
        }
    };

    const syncQueuedData = async () => {
        if (syncing) return;
        setSyncing(true);

        try {
            const keys = await AsyncStorage.getAllKeys();
            const queueKeys = keys.filter(k => k.startsWith('sync_queue_'));

            for (let key of queueKeys) {
                const event_id = key.replace('sync_queue_', '');
                const queueData = JSON.parse(await AsyncStorage.getItem(key));

                if (queueData.checkins.length > 0 || queueData.observations.length > 0) {
                    try {
                        const response = await client.post(`/events/${event_id}/sync`, queueData);
                        if (response.status === 200) {
                            // Successfully synced, clear the queue for this event
                            await AsyncStorage.removeItem(key);
                            if (__DEV__) console.log(`Successfully synced offline data for event ${event_id}`);
                        }
                    } catch (apiError) {
                        console.error(`Failed to sync to API for event ${event_id}:`, apiError);
                        // Stop trying to sync if API fails (maybe auth issue or server down)
                    }
                } else {
                    // Empty queue, clear it up
                    await AsyncStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.error("Error during sync background process:", error);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <SyncContext.Provider value={{
            isOnline,
            queueCheckin,
            queueObservation,
            syncQueuedData,
            syncing
        }}>
            {children}
        </SyncContext.Provider>
    );
};
