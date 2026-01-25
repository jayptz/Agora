import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using service role key
// This bypasses RLS and should only be used in API routes

let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

// Export singleton instance (throws if not configured - for admin endpoints)
function getSupabaseAdminOrThrow() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error("Supabase not configured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return client;
}

export const supabaseAdmin = getSupabaseAdminOrThrow();
