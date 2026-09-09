import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/session';
import { LoginForm } from './login-form';
import { IconShield } from '@/components/icons';

/** T013: login page + session handling. If already signed in with a backoffice
 * role (app_admin/building_admin/staff), skip straight past the form. */
export default async function LoginPage() {
  const supabase = await createClient();
  const ctx = await getUserContext(supabase);

  if (ctx.role === 'app_admin' || ctx.role === 'building_admin') redirect('/panel');
  if (ctx.role === 'staff') redirect('/visitors');

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <div className="card card-pad" style={{ width: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="sidebar-logo">
            <IconShield width={20} height={20} />
          </div>
          <div>
            <div className="sidebar-title">Habitat</div>
            <div className="sidebar-subtitle">ADMINISTRACIÓN</div>
          </div>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 0 }}>
          Inicia sesión con tu cuenta de administrador o personal.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
