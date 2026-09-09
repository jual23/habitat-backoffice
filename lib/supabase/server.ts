import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the session via cookies and uses the publishable/anon key —
 * authorization is enforced by Postgres RLS (research.md item 1), not by this
 * client's privilege level.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component that can't set cookies — safe to
            // ignore as long as middleware/layout refreshes the session.
          }
        },
      },
    },
  );
}
