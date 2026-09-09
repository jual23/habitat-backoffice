'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IconSignOut } from '@/components/icons';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  }

  return (
    <button onClick={handleSignOut} className="nav-item" style={{ border: 'none', width: '100%', cursor: 'pointer', background: 'transparent' }}>
      <IconSignOut />
      Cerrar sesión
    </button>
  );
}
