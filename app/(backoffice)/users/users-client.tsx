'use client';

import { useState, useTransition } from 'react';
import {
  createResident,
  updateResident,
  deleteResident,
  cancelResidentInvitation,
} from './actions';
import { createStaff, deleteStaff, cancelStaffInvitation } from '../visitors/staff-actions';
import { IconPencil, IconTrash } from '@/components/icons';

type Apartment = { id: string; tower: string | null; unit_number: string };
type Resident = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  document_id: string | null;
  email: string | null;
  apartment_id: string | null;
  tenant_type: 'resident' | 'renter';
};

/** 007-finance-ops-expansion (FR-001): Spanish label for the Renter role. */
const TENANT_TYPE_LABELS: Record<'resident' | 'renter', string> = {
  resident: 'Residente',
  renter: 'Arrendatario',
};
type PendingResident = { id: string; email: string; full_name: string | null; apartment_id: string | null; expires_at: string };
type RoleUser = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  document_id: string | null;
};
type PendingStaff = { id: string; email: string; full_name: string | null; expires_at: string };

type Tab = 'admin' | 'staff' | 'resident';

const emptyCreateForm = {
  first_name: '',
  last_name: '',
  document_id: '',
  email: '',
  password: '',
  apartment_id: '',
};

function apartmentLabel(apartments: Apartment[], id: string | null) {
  const apt = apartments.find((a) => a.id === id);
  if (!apt) return 'Sin apartamento';
  return apt.tower ? `${apt.tower} ${apt.unit_number}` : apt.unit_number;
}

export function UsersClient({
  buildingId,
  apartments,
  residents,
  pendingResidentInvites,
  admins,
  staff,
  pendingStaffInvites,
}: {
  buildingId: string;
  apartments: Apartment[];
  residents: Resident[];
  pendingResidentInvites: PendingResident[];
  admins: RoleUser[];
  staff: RoleUser[];
  pendingStaffInvites: PendingStaff[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('resident');
  const [createRole, setCreateRole] = useState<'resident' | 'renter' | 'staff'>('resident');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    apartment_id: '',
    first_name: '',
    last_name: '',
    document_id: '',
  });

  function createUser() {
    setError(null);
    startTransition(async () => {
      const shared = {
        email: createForm.email,
        password: createForm.password,
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        document_id: createForm.document_id,
      };
      const result =
        createRole === 'staff'
          ? await createStaff(buildingId, shared)
          : await createResident(
              buildingId,
              { ...shared, apartment_id: createForm.apartment_id },
              createRole,
            );
      if (!result.ok) setError(result.error);
      else setCreateForm(emptyCreateForm);
    });
  }

  function startEditResident(r: Resident) {
    setEditingResidentId(r.id);
    setEditForm({
      email: r.email ?? '',
      apartment_id: r.apartment_id ?? '',
      first_name: r.first_name ?? '',
      last_name: r.last_name ?? '',
      document_id: r.document_id ?? '',
    });
  }

  function saveResidentEdit() {
    if (!editingResidentId) return;
    setError(null);
    startTransition(async () => {
      const result = await updateResident(editingResidentId, buildingId, {
        email: editForm.email || undefined,
        apartment_id: editForm.apartment_id || undefined,
        first_name: editForm.first_name || undefined,
        last_name: editForm.last_name || undefined,
        document_id: editForm.document_id || undefined,
      });
      if (!result.ok) setError(result.error);
      else setEditingResidentId(null);
    });
  }

  function removeResident(r: Resident) {
    if (!confirm(`¿Eliminar a ${r.full_name || r.email}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteResident(r.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  function cancelResident(inv: PendingResident) {
    setError(null);
    startTransition(async () => {
      const result = await cancelResidentInvitation(inv.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  function removeStaff(s: RoleUser) {
    if (!confirm(`¿Quitar acceso de personal a ${s.full_name || s.email}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStaff(s.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  function cancelStaff(inv: PendingStaff) {
    setError(null);
    startTransition(async () => {
      const result = await cancelStaffInvitation(inv.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  const canSubmitCreate =
    !isPending &&
    createForm.first_name.trim() &&
    createForm.last_name.trim() &&
    createForm.document_id.trim() &&
    createForm.email.trim() &&
    createForm.password.length >= 8 &&
    (createRole === 'staff' || createForm.apartment_id);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuarios y roles</h1>
          <p>Gestiona residentes, personal y administradores.</p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 4, fontWeight: 600, fontSize: 13 }}>
          Crear usuario
        </div>
        <div className="form-row">
          <div className="field" style={{ flex: 1 }}>
            <label>Nombre</label>
            <input
              value={createForm.first_name}
              onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Apellido</label>
            <input
              value={createForm.last_name}
              onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Documento</label>
            <input
              value={createForm.document_id}
              onChange={(e) => setCreateForm({ ...createForm, document_id: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="field" style={{ flex: 2 }}>
            <label>Correo</label>
            <input
              type="email"
              placeholder="resident@example.com"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Rol</label>
            <select
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as 'resident' | 'renter' | 'staff')}
            >
              <option value="resident">Residente</option>
              <option value="renter">Arrendatario</option>
              <option value="staff">Personal</option>
            </select>
          </div>
          {createRole !== 'staff' && (
            <div className="field" style={{ flex: 1 }}>
              <label>Apartamento</label>
              <select
                value={createForm.apartment_id}
                onChange={(e) => setCreateForm({ ...createForm, apartment_id: e.target.value })}
              >
                <option value="">Seleccionar…</option>
                {apartments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {apartmentLabel(apartments, a.id)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Contraseña temporal</label>
          <input
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" onClick={createUser} disabled={!canSubmitCreate}>
          Crear usuario
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${tab === 'admin' ? ' active' : ''}`} onClick={() => setTab('admin')}>
          Administrador ({admins.length})
        </button>
        <button className={`tab${tab === 'staff' ? ' active' : ''}`} onClick={() => setTab('staff')}>
          Personal ({staff.length + pendingStaffInvites.length})
        </button>
        <button className={`tab${tab === 'resident' ? ' active' : ''}`} onClick={() => setTab('resident')}>
          Residente ({residents.length + pendingResidentInvites.length})
        </button>
      </div>

      {tab === 'admin' && (
        <table>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.full_name || '—'}</td>
                <td>{a.email}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>Administrador</td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td className="empty-cell">Sin administradores asignados.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {tab === 'staff' && (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Documento</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.full_name || '—'}</td>
                <td>{s.email}</td>
                <td>{s.document_id ?? '—'}</td>
                <td>
                  <button className="icon-btn danger" onClick={() => removeStaff(s)} aria-label="Quitar">
                    <IconTrash width={16} height={16} />
                  </button>
                </td>
              </tr>
            ))}
            {pendingStaffInvites.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.full_name || '—'}</td>
                <td>{inv.email} · pendiente</td>
                <td>—</td>
                <td>
                  <button className="icon-btn danger" onClick={() => cancelStaff(inv)} aria-label="Cancelar">
                    <IconTrash width={16} height={16} />
                  </button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && pendingStaffInvites.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-cell">
                  Sin personal todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {tab === 'resident' && (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Documento</th>
              <th>Apartamento</th>
              <th>Tipo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {residents.map((r) => (
              <tr key={r.id}>
                <td>
                  {editingResidentId === r.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        style={{ width: 90 }}
                        placeholder="Nombre"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      />
                      <input
                        style={{ width: 90 }}
                        placeholder="Apellido"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      />
                    </div>
                  ) : (
                    r.full_name || '—'
                  )}
                </td>
                <td>
                  {editingResidentId === r.id ? (
                    <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  ) : (
                    r.email
                  )}
                </td>
                <td>
                  {editingResidentId === r.id ? (
                    <input
                      value={editForm.document_id}
                      onChange={(e) => setEditForm({ ...editForm, document_id: e.target.value })}
                    />
                  ) : (
                    r.document_id ?? '—'
                  )}
                </td>
                <td>
                  {editingResidentId === r.id ? (
                    <select
                      value={editForm.apartment_id}
                      onChange={(e) => setEditForm({ ...editForm, apartment_id: e.target.value })}
                    >
                      {apartments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {apartmentLabel(apartments, a.id)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    apartmentLabel(apartments, r.apartment_id)
                  )}
                </td>
                <td>{TENANT_TYPE_LABELS[r.tenant_type]}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {editingResidentId === r.id ? (
                    <>
                      <button className="btn" style={{ padding: '5px 10px' }} onClick={saveResidentEdit} disabled={isPending}>
                        Guardar
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 10px' }}
                        onClick={() => setEditingResidentId(null)}
                        disabled={isPending}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="icon-btn" onClick={() => startEditResident(r)} aria-label="Editar">
                        <IconPencil width={16} height={16} />
                      </button>
                      <button className="icon-btn danger" onClick={() => removeResident(r)} aria-label="Eliminar">
                        <IconTrash width={16} height={16} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {pendingResidentInvites.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.full_name || '—'}</td>
                <td>{inv.email} · pendiente</td>
                <td>—</td>
                <td>{apartmentLabel(apartments, inv.apartment_id)}</td>
                <td>—</td>
                <td>
                  <button className="icon-btn danger" onClick={() => cancelResident(inv)} aria-label="Cancelar">
                    <IconTrash width={16} height={16} />
                  </button>
                </td>
              </tr>
            ))}
            {residents.length === 0 && pendingResidentInvites.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  Sin residentes todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
