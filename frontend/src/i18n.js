import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './translations/en.json';
import sw from './translations/sw.json';
import es from './translations/es.json';
import fr from './translations/fr.json';
import de from './translations/de.json';
import pt from './translations/pt.json';
import ar from './translations/ar.json';
import zh from './translations/zh.json';
import hi from './translations/hi.json';
import ja from './translations/ja.json';

export const LANGUAGE_KEY = 'user-language';

export const getSavedLanguage = async () => {
    try {
        return await AsyncStorage.getItem(LANGUAGE_KEY);
    } catch (error) {
        if (__DEV__) console.log('Error reading language from AsyncStorage', error);
        return null;
    }
};

export const setSavedLanguage = async (language) => {
    try {
        await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
        if (__DEV__) console.log('Error saving language to AsyncStorage', error);
    }
};

const languageDetector = {
    type: 'languageDetector',
    async: true,
    detect: async (callback) => {
        const savedLanguage = await getSavedLanguage();
        if (savedLanguage) {
            return callback(savedLanguage);
        }
        return callback('en');
    },
    init: () => { },
    cacheUserLanguage: async (language) => {
        await setSavedLanguage(language);
    },
};

i18n
    .use(languageDetector)
    .use(initReactI18next)
    .init({
        compatibilityJSON: 'v3',
        resources: {
            en: { translation: en },
            sw: { translation: sw },
            es: { translation: es },
            fr: { translation: fr },
            de: { translation: de },
            pt: { translation: pt },
            ar: { translation: ar },
            zh: { translation: zh },
            hi: { translation: hi },
            ja: { translation: ja },
        },
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    });

export const setAppLanguage = async (language) => {
    if (!language) return;
    await i18n.changeLanguage(language);
    await setSavedLanguage(language);
};

export default i18n;
