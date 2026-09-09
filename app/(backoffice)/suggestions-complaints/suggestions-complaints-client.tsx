'use client';

import { useMemo, useState, useTransition } from 'react';
import { toggleFavorite, discardEntry } from './actions';
import { IconTrash } from '@/components/icons';

type Entry = {
  id: string;
  type: 'suggestion' | 'complaint';
  subject: string;
  body: string;
  starred: boolean;
  discarded_at: string | null;
  created_at: string;
};

export function SuggestionsComplaintsClient({
  buildingId,
  entries,
}: {
  buildingId: string;
  entries: Entry[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'suggestion' | 'complaint'>('suggestion');

  const visible = useMemo(() => entries.filter((e) => e.type === tab), [entries, tab]);

  function favorite(e: Entry) {
    setError(null);
    startTransition(async () => {
      const result = await toggleFavorite(e.id, buildingId, !e.starred);
      if (!result.ok) setError(result.error);
    });
  }

  function discard(e: Entry) {
    if (!confirm('¿Descartar esta entrada? Se eliminará permanentemente después de 24 horas.')) return;
    setError(null);
    startTransition(async () => {
      const result = await discardEntry(e.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Quejas y sugerencias</h1>
          <p>El contenido lo envían los residentes y es de solo lectura aquí.</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${tab === 'suggestion' ? ' active' : ''}`} onClick={() => setTab('suggestion')}>
          Sugerencias
        </button>
        <button className={`tab${tab === 'complaint' ? ' active' : ''}`} onClick={() => setTab('complaint')}>
          Quejas
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="row-list">
        {visible.map((e) => (
          <div key={e.id} className="row">
            <div className="row-top">
              <div>
                <div className="row-title">
                  {e.starred ? '⭐ ' : ''}
                  {e.subject}
                </div>
                <p className="row-body">{e.body}</p>
              </div>
              <div className="row-actions">
                <button className="btn btn-secondary" style={{ padding: '5px 10px' }} onClick={() => favorite(e)} disabled={isPending}>
                  {e.starred ? 'Quitar favorito' : 'Favorito'}
                </button>
                <button className="icon-btn danger" onClick={() => discard(e)} aria-label="Descartar">
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nada por aquí.</p>}
      </div>
    </div>
  );
}
