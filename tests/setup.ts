import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * T016: test-auth helper. Signs in as a given user's credentials (from
 * tests/fixtures.ts's createTestUser()) using the publishable/anon key, so RLS
 * is exercised exactly as the real app exercises it — no service-role
 * shortcuts once a test is acting "as" a role.
 */
export function signInAs(email: string, password: string): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'tests/setup.ts requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment.',
    );
  }

  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}

export async function signIn(client: SupabaseClient<Database>, email: string, password: string) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed: ${error.message}`);
  return client;
}
