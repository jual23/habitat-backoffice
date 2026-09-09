'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/**
 * Supabase client for Client Components. Uses the publishable/anon key only —
 * this is safe to bundle into the browser (constitution: no service-role key
 * ever referenced from client-bundled code, see T089).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
