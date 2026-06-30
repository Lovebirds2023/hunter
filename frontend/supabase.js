import { createClient } from '@supabase/supabase-js';
import { hasSupabaseConfig, runtimeConfig } from './src/config/runtimeConfig';

const missingSupabaseMessage = 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';

export const isSupabaseConfigured = hasSupabaseConfig;

export const supabase = hasSupabaseConfig
  ? createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey)
  : new Proxy({}, {
      get() {
        throw new Error(missingSupabaseMessage);
      },
    });
