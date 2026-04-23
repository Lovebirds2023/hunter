import { createClient } from '@supabase/supabase-js';

// Use environment variables for URL and Key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zqfmaotviiqcekgzrdqe.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_P3_vCRDsTIEhXRB7gYwKgQ_TGV7BlEc';

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase credentials missing! Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
