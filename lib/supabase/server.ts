import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requestCache } from '../request-cache';
import type { Database } from './database.types';

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the session via cookies and uses the publishable/anon key —
 * authorization is enforced by Postgres RLS (research.md item 1), not by this
 * client's privilege level.
 *
 * 011-module-navigation-performance (research.md §2): wrapped in
 * `requestCache()` (lib/request-cache.ts) so every call within a single
 * request/render returns the *same* client instance instead of constructing
 * a new one each time. This is what lets `getUserContext(supabase)`
 * (lib/session.ts) — itself also wrapped in `requestCache()` — actually
 * deduplicate across `layout.tsx` and a module's `page.tsx`: React's
 * `cache()` (which `requestCache()` uses when available) memoizes by
 * argument identity, so without this, `getUserContext` would receive a
 * different `supabase` object from each caller and would never hit.
 * `getUserContext` deliberately keeps taking `supabase` as a parameter
 * (rather than calling `createClient()` internally) so it stays directly
 * testable with a plain client outside a Next.js request context, the same
 * way `createBuildingUser()` (lib/user-provisioning.ts) is. This function
 * itself is never imported by tests (it depends on `next/headers`'s
 * `cookies()`, which requires a real Next.js request context) — only
 * `requestCache()`'s Vitest-safe fallback matters for `getUserContext`.
 */
export const createClient = requestCache(async function createClient() {
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
});
