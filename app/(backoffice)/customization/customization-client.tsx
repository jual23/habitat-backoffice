'use client';

import { useState, useTransition } from 'react';
import { updateCustomization } from './actions';
import { fileFormData } from '@/lib/supabase/storage';

export function CustomizationClient({
  buildingId,
  accentColor,
  logoUrl,
  logoSignedUrl,
}: {
  buildingId: string;
  accentColor: string;
  logoUrl: string | null;
  logoSignedUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [color, setColor] = useState(accentColor);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  function submit() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateCustomization(buildingId, { accent_color: color }, fileFormData(logoFile));
      if (!result.ok) setError(result.error);
      else {
        setSuccess(true);
        setLogoFile(null);
      }
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Personalización</h1>
          <p>Define el color de acento y el logo de tu edificio.</p>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 420 }}>
        <div className="field">
          <label>Color de acento</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 38, padding: 2 }} />
            <input value={color} onChange={(e) => setColor(e.target.value)} style={{ flex: 1 }} />
          </div>
        </div>
        <div className="field">
          <label>Logo (debe ser cuadrado, máx. 5MB)</label>
          {logoSignedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSignedUrl}
              alt=""
              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, marginBottom: 6 }}
            />
          ) : (
            logoUrl && (
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Logo guardado, pero no se pudo cargar la vista previa.
              </p>
            )
          )}
          <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
        </div>
        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">Guardado.</p>}
        <button className="btn" onClick={submit} disabled={isPending}>
          Guardar
        </button>
      </div>
    </div>
  );
}
