import * as Location from 'expo-location';

export const TARGET_ACCURACY_METERS = 50;
export const MAX_ACCEPTABLE_ACCURACY_METERS = 150;

const timeoutAfter = (ms) => new Promise((_, reject) => {
    const error = new Error('Location request timed out');
    error.code = 'location_timeout';
    setTimeout(() => reject(error), ms);
});

const getAccuracy = (location) => {
    const accuracy = Number(location?.coords?.accuracy);
    return Number.isFinite(accuracy) ? accuracy : null;
};

const isBetterLocation = (candidate, current) => {
    if (!candidate?.coords) return false;
    if (!current?.coords) return true;

    const nextAccuracy = getAccuracy(candidate);
    const currentAccuracy = getAccuracy(current);
    if (nextAccuracy === null) return currentAccuracy === null && candidate.timestamp > current.timestamp;
    if (currentAccuracy === null) return true;
    return nextAccuracy < currentAccuracy;
};

const toReliableLocationResult = (location, maxAcceptableAccuracyMeters) => {
    if (!location?.coords) {
        const error = new Error('Location unavailable');
        error.code = 'location_unavailable';
        throw error;
    }

    const accuracyMeters = getAccuracy(location);
    return {
        coords: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: accuracyMeters,
            mocked: location.mocked,
        },
        timestamp: location.timestamp,
        accuracyMeters,
        isLowAccuracy: accuracyMeters !== null && accuracyMeters > maxAcceptableAccuracyMeters,
        isMocked: Boolean(location.mocked),
    };
};

export const formatCoordinatePair = (coords) => {
    if (!Number.isFinite(Number(coords?.latitude)) || !Number.isFinite(Number(coords?.longitude))) return '';
    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
};

export const formatLocationAccuracy = (accuracyMeters) => {
    if (accuracyMeters === null || accuracyMeters === undefined) return 'Accuracy unavailable';
    const rounded = accuracyMeters >= 100 ? Math.round(accuracyMeters / 10) * 10 : Math.round(accuracyMeters);
    return `Accuracy about ${rounded} m`;
};

export const reverseGeocodeToAddress = async (coords) => {
    const reverse = await Location.reverseGeocodeAsync(coords);
    if (!reverse?.length) return '';

    const addr = reverse[0];
    return [
        addr.name,
        addr.street,
        addr.district,
        addr.city,
        addr.region,
        addr.country,
    ]
        .filter(Boolean)
        .filter((part, index, parts) => parts.indexOf(part) === index)
        .join(', ');
};

export const getReliableCurrentLocation = async ({
    targetAccuracyMeters = TARGET_ACCURACY_METERS,
    maxAcceptableAccuracyMeters = MAX_ACCEPTABLE_ACCURACY_METERS,
    initialTimeoutMs = 12000,
    improveTimeoutMs = 8000,
} = {}) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        const error = new Error('Location permission denied');
        error.code = 'permission_denied';
        throw error;
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!servicesEnabled) {
        const error = new Error('Location services disabled');
        error.code = 'services_disabled';
        throw error;
    }

    let bestLocation = null;
    const remember = (location) => {
        if (isBetterLocation(location, bestLocation)) {
            bestLocation = location;
        }
        return bestLocation;
    };

    try {
        const initial = await Promise.race([
            Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
                mayShowUserSettingsDialog: true,
            }),
            timeoutAfter(initialTimeoutMs),
        ]);
        remember(initial);
    } catch (error) {
        if (error.code !== 'location_timeout') throw error;
    }

    if (bestLocation && (getAccuracy(bestLocation) === null || getAccuracy(bestLocation) <= targetAccuracyMeters)) {
        return toReliableLocationResult(bestLocation, maxAcceptableAccuracyMeters);
    }

    let subscription = null;
    let settled = false;
    let subscriptionRemoved = false;

    const removeSubscription = () => {
        if (subscription && !subscriptionRemoved) {
            subscription.remove();
            subscriptionRemoved = true;
        }
    };

    await new Promise(async (resolve) => {
        let timer = null;
        const finish = () => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            removeSubscription();
            resolve();
        };

        timer = setTimeout(finish, improveTimeoutMs);
        try {
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    mayShowUserSettingsDialog: true,
                    timeInterval: 800,
                    distanceInterval: 0,
                },
                (location) => {
                    remember(location);
                    const accuracy = getAccuracy(bestLocation);
                    if (accuracy === null || accuracy <= targetAccuracyMeters) {
                        clearTimeout(timer);
                        finish();
                    }
                },
                finish
            );
            if (settled) {
                removeSubscription();
            }
        } catch {
            finish();
        }
    });

    removeSubscription();

    return toReliableLocationResult(bestLocation, maxAcceptableAccuracyMeters);
};
