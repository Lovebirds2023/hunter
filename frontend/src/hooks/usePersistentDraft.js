import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_VERSION = 1;

const safeParseDraft = (rawValue) => {
    if (!rawValue) return null;
    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed.data && typeof parsed.data === 'object' ? parsed.data : null;
    } catch {
        return null;
    }
};

export const usePersistentDraft = ({
    key,
    data,
    restore,
    enabled = true,
    debounceMs = 500,
}) => {
    const [isDraftReady, setIsDraftReady] = useState(false);
    const restoreRef = useRef(restore);

    useEffect(() => {
        restoreRef.current = restore;
    }, [restore]);

    useEffect(() => {
        let isMounted = true;
        setIsDraftReady(false);

        AsyncStorage.getItem(key)
            .then((rawValue) => {
                if (!isMounted) return;
                const draftData = safeParseDraft(rawValue);
                if (draftData) {
                    restoreRef.current?.(draftData);
                }
            })
            .catch((error) => {
                if (__DEV__) console.log('Draft restore failed', key, error);
            })
            .finally(() => {
                if (isMounted) setIsDraftReady(true);
            });

        return () => {
            isMounted = false;
        };
    }, [key]);

    const serializedDraft = useMemo(() => JSON.stringify({
        version: DRAFT_VERSION,
        updated_at: new Date().toISOString(),
        data,
    }), [data]);

    useEffect(() => {
        if (!enabled || !isDraftReady) return undefined;

        const timeout = setTimeout(() => {
            AsyncStorage.setItem(key, serializedDraft).catch((error) => {
                if (__DEV__) console.log('Draft save failed', key, error);
            });
        }, debounceMs);

        return () => clearTimeout(timeout);
    }, [debounceMs, enabled, isDraftReady, key, serializedDraft]);

    const clearDraft = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(key);
        } catch (error) {
            if (__DEV__) console.log('Draft clear failed', key, error);
        }
    }, [key]);

    return { clearDraft, isDraftReady };
};
