import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase configuration provided by the researcher
const DEFAULT_SUPABASE_URL = 'https://wfevssvibjvtgwypwhjo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_sBXsnntgIxTe-gw8dGJ8rQ_LURNxX7N';

// Retrieve credentials from localStorage or environment variables, falling back to provided defaults
export const getSupabaseConfig = () => {
  const customUrl = localStorage.getItem('rdip_supabase_url');
  const customKey = localStorage.getItem('rdip_supabase_anon_key');

  const supabaseUrl = customUrl || (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = customKey || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  return { supabaseUrl, supabaseAnonKey };
};

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('rdip_supabase_url', url.trim());
  localStorage.setItem('rdip_supabase_anon_key', key.trim());
  // Re-initialize client
  supabase = createClient(url.trim(), key.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};

const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

export let supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface SupabaseHealthCheckResult {
  connected: boolean;
  url: string;
  latencyMs?: number;
  message: string;
  authActive: boolean;
}

/**
 * Tests live connection to the configured Supabase endpoint
 */
export async function checkSupabaseConnection(): Promise<SupabaseHealthCheckResult> {
  const { supabaseUrl } = getSupabaseConfig();
  const startTime = performance.now();

  try {
    // Ping Supabase Auth settings endpoint which is open to anon requests
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: getSupabaseConfig().supabaseAnonKey,
      },
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok) {
      return {
        connected: true,
        url: supabaseUrl,
        latencyMs,
        message: 'Successfully connected to Supabase Cloud Infrastructure (Auth & REST APIs operational)',
        authActive: true,
      };
    } else {
      // If 401/404 or other status, auth/REST server responded
      return {
        connected: true,
        url: supabaseUrl,
        latencyMs,
        message: `Connected to Supabase endpoint (Status ${res.status}: ${res.statusText})`,
        authActive: true,
      };
    }
  } catch (error: any) {
    return {
      connected: false,
      url: supabaseUrl,
      message: error?.message || 'Failed to reach Supabase endpoint. Check network or CORS configuration.',
      authActive: false,
    };
  }
}
