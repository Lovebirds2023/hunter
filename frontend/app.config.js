const appJson = require('./app.json');

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

  return expo;
};
