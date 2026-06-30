import Constants from 'expo-constants';

const extra =
    Constants?.expoConfig?.extra
    || Constants?.manifest?.extra
    || Constants?.manifest2?.extra?.expoClient?.extra
    || {};

const cleanValue = (value) => (typeof value === 'string' ? value.trim() : '');

export const readRuntimeValue = (envName, extraName, fallback = '') => (
    cleanValue(process.env[envName])
    || cleanValue(extra?.[extraName])
    || fallback
);

const extraBuckets = extra?.supabaseStorageBuckets || {};

export const runtimeConfig = {
    apiUrl: readRuntimeValue('EXPO_PUBLIC_API_URL', 'apiUrl'),
    supabaseUrl: readRuntimeValue('EXPO_PUBLIC_SUPABASE_URL', 'supabaseUrl'),
    supabaseAnonKey: readRuntimeValue('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'supabaseAnonKey'),
    storageBuckets: {
        petIdentity: readRuntimeValue('EXPO_PUBLIC_SUPABASE_PET_IDENTITY_BUCKET', 'petIdentityBucket', extraBuckets.petIdentity || 'pet-identity'),
        caseEvidence: readRuntimeValue('EXPO_PUBLIC_SUPABASE_CASE_EVIDENCE_BUCKET', 'caseEvidenceBucket', extraBuckets.caseEvidence || 'case-evidence'),
        serviceImages: readRuntimeValue('EXPO_PUBLIC_SUPABASE_SERVICE_IMAGES_BUCKET', 'serviceImagesBucket', extraBuckets.serviceImages || 'service-images'),
        eventImages: readRuntimeValue('EXPO_PUBLIC_SUPABASE_EVENT_IMAGES_BUCKET', 'eventImagesBucket', extraBuckets.eventImages || 'event-images'),
        supportAttachments: readRuntimeValue('EXPO_PUBLIC_SUPABASE_SUPPORT_ATTACHMENTS_BUCKET', 'supportAttachmentsBucket', extraBuckets.supportAttachments || 'support-attachments'),
    },
};

export const hasSupabaseConfig = Boolean(runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey);
