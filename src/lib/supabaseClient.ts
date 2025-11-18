import { createClient } from "@supabase/supabase-js";

function sanitize(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/\r?\n/g, "").trim();
}

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || (import.meta.env as any).NEXT_PUBLIC_SUPABASE_URL;
const rawAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || (import.meta.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl = sanitize(rawUrl);
const supabaseAnonKey = sanitize(rawAnon);

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
