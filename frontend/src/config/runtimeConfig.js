import Constants from 'expo-constants';

export const DEFAULT_RUNTIME_CONFIG = {
    apiUrl: 'https://dnuwenqsyurjgmyurttj.functions.supabase.co/api',
    supabaseUrl: 'https://dnuwenqsyurjgmyurttj.supabase.co',
    supabaseAnonKey: 'sb_publishable_cOsMYXv_rVaTPYvSbdiEYw_vXHXIs4L',
};

const extra =
    Constants?.expoConfig?.extra
    || Constants?.manifest?.extra
    || Constants?.manifest2?.extra?.expoClient?.extra
    || {};

const cleanValue = (value) => (typeof value === 'string' ? value.trim() : '');
const isLegacyApiUrl = (value) => {
    const normalizedValue = cleanValue(value).toLowerCase();
    return normalizedValue.includes('railway.app') || normalizedValue.includes('hunter-production-0341');
};

const firstUsableApiUrl = (...values) => (
    values.map(cleanValue).find((value) => value && !isLegacyApiUrl(value))
    || DEFAULT_RUNTIME_CONFIG.apiUrl
);

export const readRuntimeValue = (envName, extraName, fallback = '') => (
    cleanValue(process.env[envName])
    || cleanValue(extra?.[extraName])
    || fallback
);

const extraBuckets = extra?.supabaseStorageBuckets || {};

export const runtimeConfig = {
    apiUrl: firstUsableApiUrl(
        process.env.EXPO_PUBLIC_API_URL,
        process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL,
        extra?.apiUrl,
    ),
    supabaseUrl: readRuntimeValue('EXPO_PUBLIC_SUPABASE_URL', 'supabaseUrl', DEFAULT_RUNTIME_CONFIG.supabaseUrl),
    supabaseAnonKey: readRuntimeValue('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'supabaseAnonKey', DEFAULT_RUNTIME_CONFIG.supabaseAnonKey),
    storageBuckets: {
        petIdentity: readRuntimeValue('EXPO_PUBLIC_SUPABASE_PET_IDENTITY_BUCKET', 'petIdentityBucket', extraBuckets.petIdentity || 'pet-identity'),
        caseEvidence: readRuntimeValue('EXPO_PUBLIC_SUPABASE_CASE_EVIDENCE_BUCKET', 'caseEvidenceBucket', extraBuckets.caseEvidence || 'case-evidence'),
        serviceImages: readRuntimeValue('EXPO_PUBLIC_SUPABASE_SERVICE_IMAGES_BUCKET', 'serviceImagesBucket', extraBuckets.serviceImages || 'service-images'),
        eventImages: readRuntimeValue('EXPO_PUBLIC_SUPABASE_EVENT_IMAGES_BUCKET', 'eventImagesBucket', extraBuckets.eventImages || 'event-images'),
        supportAttachments: readRuntimeValue('EXPO_PUBLIC_SUPABASE_SUPPORT_ATTACHMENTS_BUCKET', 'supportAttachmentsBucket', extraBuckets.supportAttachments || 'support-attachments'),
    },
};

export const hasSupabaseConfig = Boolean(runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey);
