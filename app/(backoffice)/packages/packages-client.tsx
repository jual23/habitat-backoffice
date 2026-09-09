'use client';

import { useState, useTransition } from 'react';
import { registerPackage, markPickedUp } from './actions';
import { fileFormData } from '@/lib/supabase/storage';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { IconPlus, IconPackage } from '@/components/icons';
import type { Enums } from '@/lib/supabase/database.types';

type PackageStatus = Enums<'package_status'>;

type Apartment = { id: string; unit_number: string; tower: string | null };

type Package = {
  id: string;
  apartment_id: string;
  description: string;
  photo_url: string | null;
  photo_signed_url: string | null;
  status: PackageStatus;
  created_at: string;
  picked_up_at: string | null;
};

function apartmentLabel(apartments: Apartment[], apartmentId: string) {
  const a = apartments.find((x) => x.id === apartmentId);
  if (!a) return '—';
  return a.tower ? `${a.tower} · ${a.unit_number}` : a.unit_number;
}

export function PackagesClient({
  buildingId,
  apartments,
  packages,
}: {
  buildingId: string;
  apartments: Apartment[];
  packages: Package[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [apartmentId, setApartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  function openCreate() {
    setApartmentId('');
    setDescription('');
    setPhotoFile(null);
    setError(null);
    setModalOpen(true);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await registerPackage(
        buildingId,
        { apartment_id: apartmentId, description },
        fileFormData(photoFile),
      );
      if (!result.ok) setError(result.error);
      else setModalOpen(false);
    });
  }

  function pickUp(p: Package) {
    setError(null);
    startTransition(async () => {
      const result = await markPickedUp(p.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  const pending = packages.filter((p) => p.status === 'pending');
  const pickedUp = packages.filter((p) => p.status === 'picked_up');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Paquetería</h1>
          <p>Registra paquetes recibidos y avisa a los residentes de cada apartamento.</p>
        </div>
        <button className="btn" onClick={openCreate}>
          <IconPlus width={16} height={16} /> Registrar paquete
        </button>
      </div>

      {error && !modalOpen && <p className="error-text">{error}</p>}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Pendientes de recoger</h2>
      <table>
        <thead>
          <tr>
            <th>Apartamento</th>
            <th>Descripción</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pending.map((p) => (
            <tr key={p.id}>
              <td>{apartmentLabel(apartments, p.apartment_id)}</td>
              <td>
                {p.description}
                {p.photo_signed_url && (
                  <>
                    {' '}
                    <a href={p.photo_signed_url} target="_blank" rel="noreferrer">
                      Ver foto
                    </a>
                  </>
                )}
              </td>
              <td>{new Date(p.created_at).toLocaleDateString()}</td>
              <td>
                <button className="btn" style={{ padding: '5px 10px' }} onClick={() => pickUp(p)} disabled={isPending}>
                  Recogido
                </button>
              </td>
            </tr>
          ))}
          {pending.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-cell">
                Sin paquetes pendientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Recogidos</h2>
      <table>
        <thead>
          <tr>
            <th>Apartamento</th>
            <th>Descripción</th>
            <th>Estado</th>
            <th>Recogido</th>
          </tr>
        </thead>
        <tbody>
          {pickedUp.map((p) => (
            <tr key={p.id}>
              <td>{apartmentLabel(apartments, p.apartment_id)}</td>
              <td>{p.description}</td>
              <td>
                <Badge tone="success">Recogido</Badge>
              </td>
              <td>{p.picked_up_at ? new Date(p.picked_up_at).toLocaleString() : '—'}</td>
            </tr>
          ))}
          {pickedUp.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-cell">
                Aún no hay paquetes recogidos.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar paquete">
        <div className="field">
          <label>Apartamento</label>
          <select value={apartmentId} onChange={(e) => setApartmentId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {apartments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tower ? `${a.tower} · ${a.unit_number}` : a.unit_number}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Descripción</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label>Foto (opcional, máx. 5MB)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={isPending}>
            Cancelar
          </button>
          <button className="btn" onClick={submit} disabled={isPending || !apartmentId || !description.trim()}>
            <IconPackage width={16} height={16} /> Registrar
          </button>
        </div>
      </Modal>
    </div>
  );
}
