"use client";

import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client using anon key
// This respects RLS policies

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (client) {
    return client;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  client = createClient(supabaseUrl, anonKey);

  return client;
}
