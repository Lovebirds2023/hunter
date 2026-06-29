const appJson = require('./app.json');

const isUsableGoogleClientId = (clientId) => {
  if (!clientId) return false;
  const normalized = clientId.trim().toLowerCase();
  return normalized.endsWith('.apps.googleusercontent.com') && !normalized.startsWith('your-');
};

module.exports = () => {
  const expo = JSON.parse(JSON.stringify(appJson.expo));
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '';

  expo.android = expo.android || {};
  expo.android.config = expo.android.config || {};
  expo.android.config.googleMaps = expo.android.config.googleMaps || {};
  expo.android.config.googleMaps.apiKey = googleMapsApiKey;

  expo.extra = {
    ...(expo.extra || {}),
    googleMapsConfigured: Boolean(googleMapsApiKey),
  };

  if (process.env.EAS_BUILD && !googleMapsApiKey) {
    throw new Error('Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY before creating native release builds.');
  }

  if (process.env.EAS_BUILD) {
    const buildPlatform = process.env.EAS_BUILD_PLATFORM;

    if ((!buildPlatform || buildPlatform === 'android') && !isUsableGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)) {
      throw new Error(`Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID before creating Android builds for ${expo.android.package}.`);
    }

    if ((!buildPlatform || buildPlatform === 'ios') && !isUsableGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID)) {
      throw new Error(`Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID before creating iOS builds for ${expo.ios.bundleIdentifier}.`);
    }
  }

  return expo;
};
