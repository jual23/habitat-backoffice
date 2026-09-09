import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';

export default async function RootPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (ctx.role === 'staff') redirect('/visitors');
  if (ctx.role === 'building_admin' || ctx.role === 'app_admin') redirect('/panel');
  redirect('/login');
}
