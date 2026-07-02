const appJson = require('./app.json');
const path = require('path');

const DEFAULT_API_URL = 'https://dnuwenqsyurjgmyurttj.functions.supabase.co/api';
const DEFAULT_SUPABASE_URL = 'https://dnuwenqsyurjgmyurttj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_cOsMYXv_rVaTPYvSbdiEYw_vXHXIs4L';

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
const isLegacyApiUrl = (value) => {
  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue.includes('railway.app') || normalizedValue.includes('hunter-production-0341');
};
const firstUsableApiUrl = (...values) => (
  values.find((value) => value && !isLegacyApiUrl(value)) || DEFAULT_API_URL
);

module.exports = () => {
  const expo = JSON.parse(JSON.stringify(appJson.expo));
  const apiUrl = firstUsableApiUrl(
    getEnvValue('EXPO_PUBLIC_API_URL'),
    getEnvValue('EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL'),
  );
  const supabaseUrl = getEnvValue('EXPO_PUBLIC_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = getEnvValue('EXPO_PUBLIC_SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;
  const supabaseStorageBuckets = {
    petIdentity: getEnvValue('EXPO_PUBLIC_SUPABASE_PET_IDENTITY_BUCKET') || 'pet-identity',
    caseEvidence: getEnvValue('EXPO_PUBLIC_SUPABASE_CASE_EVIDENCE_BUCKET') || 'case-evidence',
    serviceImages: getEnvValue('EXPO_PUBLIC_SUPABASE_SERVICE_IMAGES_BUCKET') || 'service-images',
    eventImages: getEnvValue('EXPO_PUBLIC_SUPABASE_EVENT_IMAGES_BUCKET') || 'event-images',
    supportAttachments: getEnvValue('EXPO_PUBLIC_SUPABASE_SUPPORT_ATTACHMENTS_BUCKET') || 'support-attachments',
  };
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
    apiUrl,
    supabaseUrl,
    supabaseAnonKey,
    supabaseStorageBuckets,
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

  if (process.env.EAS_BUILD && !apiUrl) {
    throw new Error('Set EXPO_PUBLIC_API_URL to your Supabase-backed API endpoint before creating release builds.');
  }

  if (process.env.EAS_BUILD && (!supabaseUrl || !supabaseAnonKey)) {
    throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before creating release builds.');
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
