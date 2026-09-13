'use client';

import { useState, useTransition } from 'react';
import { createTask, rescheduleTask, completeTask } from './actions';

type Frequency = 'once' | 'weekly' | 'monthly' | 'every_n_months';
type Task = {
  id: string;
  name: string;
  frequency: Frequency;
  interval_months: number | null;
  next_due_date: string | null;
};
type Completion = {
  id: string;
  task_id: string;
  completed_by: string;
  completed_at: string;
  photo_url: string | null;
  photo_signed_url: string | null;
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
  once: 'Una vez',
  weekly: 'Semanal',
  monthly: 'Mensual',
  every_n_months: 'Cada N meses',
};

export function MaintenanceClient({
  buildingId,
  isStaffOnly,
  tasks,
  completions,
}: {
  buildingId: string;
  isStaffOnly: boolean;
  tasks: Task[];
  completions: Completion[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', frequency: 'monthly' as Frequency, interval_months: '', next_due_date: '' });
  const [rescheduling, setRescheduling] = useState<Record<string, string>>({});
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createTask(buildingId, {
        name: form.name,
        frequency: form.frequency,
        interval_months: form.frequency === 'every_n_months' ? Number(form.interval_months) : null,
        next_due_date: form.next_due_date,
      });
      if (!result.ok) setError(result.error);
      else setForm({ name: '', frequency: 'monthly', interval_months: '', next_due_date: '' });
    });
  }

  function reschedule(taskId: string) {
    const nextDate = rescheduling[taskId];
    if (!nextDate) return;
    setError(null);
    startTransition(async () => {
      const result = await rescheduleTask(buildingId, { task_id: taskId, next_due_date: nextDate });
      if (!result.ok) setError(result.error);
    });
  }

  function submitCompletion(taskId: string) {
    if (!photo) {
      setError('Selecciona una foto para marcar la tarea como hecha.');
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.append('file', photo);
    startTransition(async () => {
      const result = await completeTask(buildingId, { task_id: taskId }, fd);
      if (!result.ok) setError(result.error);
      else {
        setCompletingTaskId(null);
        setPhoto(null);
      }
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mantenimiento</h1>
          <p>Tareas de mantenimiento programadas y su historial de cumplimiento.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!isStaffOnly && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="field" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
            Nueva tarea
          </div>
          <div className="form-row">
            <div className="field" style={{ flex: 2 }}>
              <label>Nombre</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Frecuencia</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}>
                <option value="once">Una vez</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
                <option value="every_n_months">Cada N meses</option>
              </select>
            </div>
            {form.frequency === 'every_n_months' && (
              <div className="field" style={{ flex: 1 }}>
                <label>N meses</label>
                <input
                  type="number"
                  min="1"
                  value={form.interval_months}
                  onChange={(e) => setForm({ ...form, interval_months: e.target.value })}
                />
              </div>
            )}
            <div className="field" style={{ flex: 1 }}>
              <label>Fecha</label>
              <input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} />
            </div>
            <div className="field" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-inline" onClick={create} disabled={isPending || !form.name || !form.next_due_date}>
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Frecuencia</th>
              <th>Próxima fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  {FREQUENCY_LABELS[t.frequency]}
                  {t.frequency === 'every_n_months' && t.interval_months ? ` (${t.interval_months})` : ''}
                </td>
                <td>
                  {!isStaffOnly ? (
                    <input
                      type="date"
                      value={rescheduling[t.id] ?? t.next_due_date ?? ''}
                      onChange={(e) => setRescheduling({ ...rescheduling, [t.id]: e.target.value })}
                      onBlur={() => reschedule(t.id)}
                    />
                  ) : (
                    (t.next_due_date ?? '—')
                  )}
                </td>
                <td>
                  {completingTaskId === t.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                      <button className="btn" style={{ padding: '5px 10px' }} onClick={() => submitCompletion(t.id)} disabled={isPending}>
                        Confirmar
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 10px' }}
                        onClick={() => {
                          setCompletingTaskId(null);
                          setPhoto(null);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button className="btn" style={{ padding: '5px 10px' }} onClick={() => setCompletingTaskId(t.id)}>
                      Marcar hecho
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-cell">
                  Sin tareas de mantenimiento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card card-pad">
        <div className="field" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
          Historial de cumplimiento
        </div>
        <table>
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Completado</th>
              <th>Foto</th>
            </tr>
          </thead>
          <tbody>
            {completions.map((c) => (
              <tr key={c.id}>
                <td>{tasks.find((t) => t.id === c.task_id)?.name ?? '—'}</td>
                <td>{new Date(c.completed_at).toLocaleString()}</td>
                <td>
                  {c.photo_signed_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photo_signed_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {completions.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-cell">
                  Sin cumplimientos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
