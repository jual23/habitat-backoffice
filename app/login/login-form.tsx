'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      return;
    }

    // Hard navigation instead of router.refresh()+router.push('/'): right after
    // a fresh sign-in, refresh() re-renders /login itself while push() races it
    // to navigate away, which can leave the page looking like it "just
    // refreshed" with no visible error. A full navigation guarantees the next
    // request carries the new session cookie and lands on the real landing
    // route computed by app/page.tsx. This is the auth entry transition, not
    // navigation between backoffice pages, so it doesn't conflict with the
    // constitution's no-full-reload rule for those.
    window.location.href = '/';
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="btn" disabled={submitting} style={{ width: '100%' }}>
        {submitting ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  );
}
