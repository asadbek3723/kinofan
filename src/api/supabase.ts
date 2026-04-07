import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if ((url && !anonKey) || (!url && anonKey)) {
  console.warn('Kinofan: set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for Supabase mode.');
}

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
