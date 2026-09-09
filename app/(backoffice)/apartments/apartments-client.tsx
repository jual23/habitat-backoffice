'use client';

import { useState, useTransition } from 'react';
import { createApartment, updateApartment, deleteApartment } from './actions';
import { Modal } from '@/components/Modal';
import { IconPencil, IconTrash, IconPlus } from '@/components/icons';

type Apartment = {
  id: string;
  tower: string | null;
  unit_number: string;
  floor: number | null;
  created_at: string;
};
type Resident = {
  id: string;
  full_name: string;
  email: string | null;
  apartment_id: string | null;
};

const emptyForm = { tower: '', unit_number: '', floor: '' };

export function ApartmentsClient({
  buildingId,
  apartments,
  residents,
}: {
  buildingId: string;
  apartments: Apartment[];
  residents: Resident[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const residentsByApartment = new Map<string, Resident[]>();
  for (const r of residents) {
    if (!r.apartment_id) continue;
    const list = residentsByApartment.get(r.apartment_id) ?? [];
    list.push(r);
    residentsByApartment.set(r.apartment_id, list);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function submit() {
    setError(null);
    const input = {
      tower: form.tower,
      unit_number: form.unit_number,
      floor: form.floor ? Number(form.floor) : null,
    };
    startTransition(async () => {
      const result = editingId
        ? await updateApartment(editingId, buildingId, input)
        : await createApartment(buildingId, input);
      if (!result.ok) setError(result.error);
      else setModalOpen(false);
    });
  }

  function startEdit(apt: Apartment) {
    setEditingId(apt.id);
    setForm({ tower: apt.tower ?? '', unit_number: apt.unit_number, floor: apt.floor?.toString() ?? '' });
    setError(null);
    setModalOpen(true);
  }

  function remove(apt: Apartment) {
    if (!confirm(`¿Eliminar la unidad ${apt.unit_number}? Fallará si aún tiene residentes.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteApartment(apt.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Apartamentos</h1>
          <p>Gestiona el listado de apartamentos de tu edificio.</p>
        </div>
        <button className="btn" onClick={openCreate}>
          <IconPlus width={16} height={16} /> Nuevo apartamento
        </button>
      </div>

      {error && !modalOpen && <p className="error-text">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Torre</th>
            <th>Unidad</th>
            <th>Piso</th>
            <th>Residentes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {apartments.map((apt) => {
            const list = residentsByApartment.get(apt.id) ?? [];
            return (
              <tr key={apt.id}>
                <td>{apt.tower ?? '—'}</td>
                <td>{apt.unit_number}</td>
                <td>{apt.floor ?? '—'}</td>
                <td>{list.length === 0 ? '—' : list.map((r) => r.full_name || r.email).join(', ')}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="icon-btn" onClick={() => startEdit(apt)} aria-label="Editar">
                    <IconPencil width={16} height={16} />
                  </button>
                  <button className="icon-btn danger" onClick={() => remove(apt)} aria-label="Eliminar">
                    <IconTrash width={16} height={16} />
                  </button>
                </td>
              </tr>
            );
          })}
          {apartments.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-cell">
                Aún no hay apartamentos.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar apartamento' : 'Nuevo apartamento'}>
        <div className="field">
          <label>Torre (opcional)</label>
          <input value={form.tower} onChange={(e) => setForm({ ...form, tower: e.target.value })} />
        </div>
        <div className="field">
          <label>Número de unidad</label>
          <input value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} />
        </div>
        <div className="field">
          <label>Piso (opcional)</label>
          <input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={isPending}>
            Cancelar
          </button>
          <button className="btn" onClick={submit} disabled={isPending || !form.unit_number}>
            {editingId ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
