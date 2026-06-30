const appJson = require('./app.json');
const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch (error) {
  // Expo CLI loads .env automatically; this keeps local EAS builds explicit.
}

const isUsableGoogleClientId = (clientId) => {
  if (!clientId) return false;
  const normalized = clientId.trim().toLowerCase();
  return normalized.endsWith('.apps.googleusercontent.com') && !normalized.startsWith('your-');
};

const getEnvValue = (name) => process.env[name]?.trim() || '';

module.exports = () => {
  const expo = JSON.parse(JSON.stringify(appJson.expo));
  const googleClientIds = {
    web: getEnvValue('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
    ios: getEnvValue('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
    android: getEnvValue('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
  };
  const googleMapsApiKey =
    getEnvValue('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY') ||
    getEnvValue('GOOGLE_MAPS_API_KEY') ||
    '';

  expo.android = expo.android || {};
  expo.android.config = expo.android.config || {};
  expo.android.config.googleMaps = expo.android.config.googleMaps || {};
  expo.android.config.googleMaps.apiKey = googleMapsApiKey;

  expo.extra = {
    ...(expo.extra || {}),
    googleMapsConfigured: Boolean(googleMapsApiKey),
    googleClientIds,
    googleRedirectPath: getEnvValue('EXPO_PUBLIC_GOOGLE_REDIRECT_PATH') || 'auth/google',
    googleRedirectUri: getEnvValue('EXPO_PUBLIC_GOOGLE_REDIRECT_URI'),
    androidPackage: expo.android.package,
    appDisplayName: expo.name,
  };

  if (process.env.EAS_BUILD && !googleMapsApiKey) {
    throw new Error('Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY before creating native release builds.');
  }

  if (process.env.EAS_BUILD) {
    const buildPlatform = process.env.EAS_BUILD_PLATFORM;

    if ((!buildPlatform || buildPlatform === 'android') && !isUsableGoogleClientId(googleClientIds.android)) {
      throw new Error(`Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID before creating Android builds for ${expo.android.package}.`);
    }

    if ((!buildPlatform || buildPlatform === 'ios') && !isUsableGoogleClientId(googleClientIds.ios)) {
      throw new Error(`Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID before creating iOS builds for ${expo.ios.bundleIdentifier}.`);
    }
  }

  return expo;
};
