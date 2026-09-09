'use client';

import { useState, useTransition } from 'react';
import { createActivity, updateActivity, deleteActivity } from './actions';
import { fileFormData } from '@/lib/supabase/storage';
import { Modal } from '@/components/Modal';
import { IconCalendar, IconPencil, IconTrash, IconPlus } from '@/components/icons';

type Activity = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  max_participants: number | null;
  banner_url: string | null;
  banner_signed_url: string | null;
};

const emptyForm = { title: '', description: '', location: '', starts_at: '', ends_at: '', max_participants: '' };

function toLocalInput(iso: string) {
  return iso ? iso.slice(0, 16) : '';
}

export function ActivitiesClient({ buildingId, activities }: { buildingId: string; activities: Activity[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setBannerFile(null);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(a: Activity) {
    setEditingId(a.id);
    setForm({
      title: a.title,
      description: a.description ?? '',
      location: a.location ?? '',
      starts_at: toLocalInput(a.starts_at),
      ends_at: toLocalInput(a.ends_at ?? ''),
      max_participants: a.max_participants?.toString() ?? '',
    });
    setBannerFile(null);
    setError(null);
    setModalOpen(true);
  }

  function submit() {
    setError(null);
    const input = {
      title: form.title,
      description: form.description,
      location: form.location,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : '',
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : '',
      max_participants: form.max_participants ? Number(form.max_participants) : null,
    };
    startTransition(async () => {
      const result = editingId
        ? await updateActivity(editingId, buildingId, input, fileFormData(bannerFile))
        : await createActivity(buildingId, input, fileFormData(bannerFile));
      if (!result.ok) setError(result.error);
      else setModalOpen(false);
    });
  }

  function remove(a: Activity) {
    if (!confirm(`¿Eliminar "${a.title}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteActivity(a.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Actividades</h1>
          <p>Gestiona las actividades programadas de tu edificio.</p>
        </div>
        <button className="btn" onClick={openCreate}>
          <IconPlus width={16} height={16} /> Nueva actividad
        </button>
      </div>

      {error && !modalOpen && <p className="error-text">{error}</p>}

      <div className="grid">
        {activities.map((a) => (
          <div key={a.id} className="tile">
            {a.banner_signed_url ? (
              <div className="tile-image-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.banner_signed_url} alt="" className="tile-image" />
              </div>
            ) : (
              <div className="tile-body" style={{ paddingBottom: 0 }}>
                <div className="tile-icon-avatar">
                  <IconCalendar />
                </div>
              </div>
            )}
            <div className="tile-body">
              <div className="tile-title">{a.title}</div>
              {a.description && <div className="tile-meta">{a.description}</div>}
              <div className="tile-meta">{new Date(a.starts_at).toLocaleString('es')}</div>
              <div className="tile-meta">{a.max_participants ? `Cupo ${a.max_participants}` : 'Cupo ilimitado'}</div>
              <div className="tile-footer" style={{ justifyContent: 'flex-end' }}>
                <div className="tile-actions">
                  <button className="icon-btn" onClick={() => openEdit(a)} aria-label="Editar">
                    <IconPencil width={16} height={16} />
                  </button>
                  <button className="icon-btn danger" onClick={() => remove(a)} aria-label="Eliminar">
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>Aún no hay actividades.</p>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar actividad' : 'Nueva actividad'}>
        <div className="field">
          <label>Título</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label>Descripción (opcional)</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="field">
          <label>Lugar (opcional)</label>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Inicia</label>
            <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </div>
          <div className="field">
            <label>Termina (opcional)</label>
            <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Cupo máximo (opcional, vacío = ilimitado)</label>
          <input
            type="number"
            min={1}
            value={form.max_participants}
            onChange={(e) => setForm({ ...form, max_participants: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Banner (opcional, máx. 5MB)</label>
          <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={isPending}>
            Cancelar
          </button>
          <button className="btn" onClick={submit} disabled={isPending || !form.title || !form.starts_at}>
            {editingId ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
