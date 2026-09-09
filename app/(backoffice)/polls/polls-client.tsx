'use client';

import { useState, useTransition } from 'react';
import { createPoll } from './actions';
import { Badge } from '@/components/Badge';
import { Toggle } from '@/components/Toggle';

type Option = { id: string; label: string; sort_order: number };
type Breakdown = { option_id: string; apartment_id: string; apartments: { tower: string | null; unit_number: string } | null };
type Poll = {
  id: string;
  title: string;
  description: string | null;
  allow_multiple: boolean;
  anonymous: boolean;
  closes_at: string;
  options: Option[];
  results: { option_id: string; count: number }[];
  breakdown: Breakdown[] | null;
};

function apartmentLabel(a: { tower: string | null; unit_number: string } | null) {
  if (!a) return '—';
  return a.tower ? `${a.tower} ${a.unit_number}` : a.unit_number;
}

function PollCard({ poll }: { poll: Poll }) {
  const isActive = new Date(poll.closes_at).getTime() > Date.now();
  const [open, setOpen] = useState(isActive);
  const totalVotes = poll.results.reduce((sum, r) => sum + r.count, 0);
  const winningCount = Math.max(0, ...poll.results.map((r) => r.count));

  return (
    <div className="card card-pad" style={{ marginBottom: 12 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <strong>{poll.title}</strong>{' '}
          <Badge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Activa' : 'Cerrada'}</Badge>
        </div>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {!open && !isActive && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
          {totalVotes} voto(s) — resultado principal:{' '}
          {poll.options.find((o) => poll.results.find((r) => r.option_id === o.id)?.count === winningCount)?.label ?? '—'}
        </p>
      )}
      {open && (
        <div style={{ marginTop: 12 }}>
          {poll.description && <p style={{ marginBottom: 8 }}>{poll.description}</p>}
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {poll.allow_multiple ? 'Múltiples respuestas' : 'Una respuesta'} ·{' '}
            {poll.anonymous ? 'Anónima' : 'No anónima'} · Cierra: {new Date(poll.closes_at).toLocaleString()}
          </p>
          <table style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Opción</th>
                <th>Votos</th>
              </tr>
            </thead>
            <tbody>
              {poll.options.map((o) => (
                <tr key={o.id}>
                  <td>{o.label}</td>
                  <td>{poll.results.find((r) => r.option_id === o.id)?.count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!poll.anonymous && poll.breakdown && poll.breakdown.length > 0 && (
            <>
              <p style={{ marginTop: 12, fontWeight: 600, fontSize: 13 }}>Detalle por apartamento</p>
              <table>
                <thead>
                  <tr>
                    <th>Apartamento</th>
                    <th>Opción</th>
                  </tr>
                </thead>
                <tbody>
                  {poll.breakdown.map((b, i) => (
                    <tr key={i}>
                      <td>{apartmentLabel(b.apartments)}</td>
                      <td>{poll.options.find((o) => o.id === b.option_id)?.label ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PollsClient({ buildingId, polls }: { buildingId: string; polls: Poll[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    optionsText: '',
    allow_multiple: false,
    anonymous: false,
    closes_at: '',
  });

  function create() {
    setError(null);
    const options = form.optionsText
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);
    startTransition(async () => {
      const result = await createPoll(buildingId, {
        title: form.title,
        description: form.description || null,
        options,
        allow_multiple: form.allow_multiple,
        anonymous: form.anonymous,
        closes_at: form.closes_at,
      });
      if (!result.ok) setError(result.error);
      else setForm({ title: '', description: '', optionsText: '', allow_multiple: false, anonymous: false, closes_at: '' });
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Encuestas comunitarias</h1>
          <p>Crea y monitorea encuestas para los residentes del edificio.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
          Nueva encuesta
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Título</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Descripción (opcional)</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Opciones (una por línea)</label>
          <textarea value={form.optionsText} onChange={(e) => setForm({ ...form, optionsText: e.target.value })} />
        </div>
        <div className="form-row" style={{ marginBottom: 8 }}>
          <Toggle
            checked={form.allow_multiple}
            onChange={(allow_multiple) => setForm({ ...form, allow_multiple })}
            label="Permitir múltiples respuestas"
          />
          <Toggle
            checked={form.anonymous}
            onChange={(anonymous) => setForm({ ...form, anonymous })}
            label="Anónima"
          />
          <div className="field">
            <label>Fecha de cierre</label>
            <input
              type="datetime-local"
              value={form.closes_at}
              onChange={(e) => setForm({ ...form, closes_at: e.target.value })}
            />
          </div>
        </div>
        <button
          className="btn"
          onClick={create}
          disabled={isPending || !form.title || !form.optionsText.trim() || !form.closes_at}
        >
          Crear encuesta
        </button>
      </div>

      {polls.map((p) => (
        <PollCard key={p.id} poll={p} />
      ))}
      {polls.length === 0 && <p className="empty-cell">Sin encuestas todavía.</p>}
    </div>
  );
}
