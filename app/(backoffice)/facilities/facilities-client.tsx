'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createFacility, updateFacility, deleteFacility } from './actions';
import { fileFormData } from '@/lib/supabase/storage';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { Toggle } from '@/components/Toggle';
import { IconBuilding, IconPencil, IconTrash, IconPlus } from '@/components/icons';

type Facility = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  image_signed_url: string | null;
  opens_at: string;
  closes_at: string;
  open_days: number[];
  reservable: boolean;
};

const emptyForm = {
  name: '',
  description: '',
  opens_at: '06:00',
  closes_at: '22:00',
  reservable: false,
};

/**
 * 004-facilities-incidencias-packages (T034, research.md item 3): whether a
 * facility is currently within its configured schedule, evaluated in the
 * building's own timezone (not the viewer's) — `open_days` follows JS
 * `Date#getDay()` (0 = Sunday … 6 = Saturday). Handles an overnight-spanning
 * range (closes_at < opens_at) as open if now is past opens_at OR before
 * closes_at.
 */
function isFacilityOpen(facility: Pick<Facility, 'opens_at' | 'closes_at' | 'open_days'>, buildingTimezone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: buildingTimezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const nowMinutes = Number(hour) * 60 + Number(minute);

  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const today = weekdayIndex[weekdayShort] ?? 0;

  const toMinutes = (t: string) => {
    const [h, m] = t.slice(0, 5).split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const opens = toMinutes(facility.opens_at);
  const closes = toMinutes(facility.closes_at);

  if (opens === closes) return false;

  if (opens < closes) {
    // Same-day range — only "open" on a configured day, during the window.
    return facility.open_days.includes(today) && nowMinutes >= opens && nowMinutes < closes;
  }

  // Overnight-spanning range (e.g. 22:00–02:00): open either from opens_at
  // through midnight (today must be a configured day) or from midnight
  // through closes_at (yesterday must have been a configured day).
  const yesterday = (today + 6) % 7;
  if (nowMinutes >= opens) return facility.open_days.includes(today);
  if (nowMinutes < closes) return facility.open_days.includes(yesterday);
  return false;
}

export function FacilitiesClient({
  buildingId,
  facilities,
  buildingTimezone,
}: {
  buildingId: string;
  facilities: Facility[];
  buildingTimezone: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(f: Facility) {
    setEditingId(f.id);
    setForm({
      name: f.name,
      description: f.description ?? '',
      opens_at: f.opens_at?.slice(0, 5) ?? '06:00',
      closes_at: f.closes_at?.slice(0, 5) ?? '22:00',
      reservable: f.reservable,
    });
    setImageFile(null);
    setError(null);
    setModalOpen(true);
  }

  function submit() {
    setError(null);
    const input = {
      name: form.name,
      description: form.description,
      opens_at: form.opens_at,
      closes_at: form.closes_at,
      reservable: form.reservable,
    };
    startTransition(async () => {
      const result = editingId
        ? await updateFacility(editingId, buildingId, input, fileFormData(imageFile))
        : await createFacility(buildingId, input, fileFormData(imageFile));
      if (!result.ok) setError(result.error);
      else setModalOpen(false);
    });
  }

  function toggleReservable(f: Facility, reservable: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await updateFacility(
        f.id,
        buildingId,
        {
          name: f.name,
          description: f.description ?? '',
          opens_at: f.opens_at?.slice(0, 5),
          closes_at: f.closes_at?.slice(0, 5),
          reservable,
        },
        null,
      );
      if (!result.ok) setError(result.error);
    });
  }

  function remove(f: Facility) {
    if (!confirm(`¿Eliminar "${f.name}"? Las reservas pendientes serán rechazadas.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteFacility(f.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Instalaciones</h1>
          <p>Gestiona áreas comunes, horarios y reservas.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/reservations" className="btn btn-secondary">
            Reservas
          </Link>
          <button className="btn" onClick={openCreate}>
            <IconPlus width={16} height={16} /> Nueva instalación
          </button>
        </div>
      </div>

      {error && !modalOpen && <p className="error-text">{error}</p>}

      <div className="grid">
        {facilities.map((f) => {
          const open = isFacilityOpen(f, buildingTimezone);
          return (
          <div key={f.id} className="tile">
            {f.image_signed_url ? (
              <div className="tile-image-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.image_signed_url} alt="" className="tile-image" />
                <span className="tile-badge-overlay">
                  <Badge tone={open ? 'success' : 'danger'}>{open ? 'Abierto' : 'Cerrado'}</Badge>
                </span>
              </div>
            ) : null}
            <div className="tile-body">
              {!f.image_signed_url && (
                <div className="tile-header-row">
                  <div className="tile-icon-avatar">
                    <IconBuilding />
                  </div>
                  <Badge tone={open ? 'success' : 'danger'}>{open ? 'Abierto' : 'Cerrado'}</Badge>
                </div>
              )}
              <div className="tile-title">{f.name}</div>
              {f.description && <div className="tile-meta">{f.description}</div>}
              <div className="tile-meta">
                Hoy: {f.opens_at?.slice(0, 5)} – {f.closes_at?.slice(0, 5)}
              </div>
              <div className="tile-footer">
                <Toggle
                  checked={f.reservable}
                  onChange={(v) => toggleReservable(f, v)}
                  disabled={isPending}
                  label="Reservable"
                />
                <div className="tile-actions">
                  <button className="icon-btn" onClick={() => openEdit(f)} aria-label="Editar">
                    <IconPencil width={16} height={16} />
                  </button>
                  <button className="icon-btn danger" onClick={() => remove(f)} aria-label="Eliminar">
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })}
        {facilities.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>Aún no hay instalaciones.</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar instalación' : 'Nueva instalación'}
      >
        <div className="field">
          <label>Nombre</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Descripción (opcional)</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Abre</label>
            <input
              type="time"
              value={form.opens_at}
              onChange={(e) => setForm({ ...form, opens_at: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Cierra</label>
            <input
              type="time"
              value={form.closes_at}
              onChange={(e) => setForm({ ...form, closes_at: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <Toggle
            checked={form.reservable}
            onChange={(v) => setForm({ ...form, reservable: v })}
            label="Permitir reservas"
          />
        </div>
        <div className="field">
          <label>Imagen (opcional, máx. 5MB)</label>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={isPending}>
            Cancelar
          </button>
          <button className="btn" onClick={submit} disabled={isPending || !form.name}>
            {editingId ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
