import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * 006-direct-user-creation (T007): a server-only service-role Supabase client,
 * mirroring tests/fixtures.ts's getServiceClient() but for the running app.
 * This is the ONLY place in application code (outside tests) that holds
 * SUPABASE_SERVICE_ROLE_KEY — see plan.md's Constraints and Complexity
 * Tracking. It exists solely so lib/user-provisioning.ts's createBuildingUser()
 * can call the Supabase Auth Admin API (auth.admin.createUser()), which is the
 * only supported way to create an auth.users row with an admin-chosen
 * password (research.md item 1).
 *
 * MUST NEVER be imported by a Client Component ('use client' file) — this
 * module is safe only because Next.js Server Actions/Components run
 * exclusively server-side, and SUPABASE_SERVICE_ROLE_KEY (unlike
 * NEXT_PUBLIC_SUPABASE_ANON_KEY) is never bundled for the browser.
 */

let adminClient: SupabaseClient<Database> | null = null;

export function getAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'lib/supabase/admin.ts requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.',
    );
  }

  adminClient = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
