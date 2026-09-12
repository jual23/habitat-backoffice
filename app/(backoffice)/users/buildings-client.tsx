'use client';

import { useState, useTransition } from 'react';
import { createBuilding, updateBuilding, reassignBuildingAdministrator, type AdministratorChoice } from './buildings-actions';
import { fileFormData } from '@/lib/supabase/storage';
import { IconPencil, IconBuilding, IconUsers } from '@/components/icons';

type AdminProfile = {
  user_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type Building = {
  id: string;
  name: string;
  logo_url: string | null;
  logo_signed_url: string | null;
  administrators: AdminProfile[];
};

const emptyNewAccount = { email: '', password: '', first_name: '', last_name: '', document_id: '' };

function adminLabel(a: AdminProfile) {
  return a.full_name || `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email || a.user_id;
}

/** research.md §10: shared by the create-building form and the per-building reassign control. */
function AdministratorPicker({
  existingAdministrators,
  mode,
  onModeChange,
  existingUserId,
  onExistingUserIdChange,
  newAccount,
  onNewAccountChange,
}: {
  existingAdministrators: AdminProfile[];
  mode: 'existing' | 'new';
  onModeChange: (mode: 'existing' | 'new') => void;
  existingUserId: string;
  onExistingUserIdChange: (id: string) => void;
  newAccount: typeof emptyNewAccount;
  onNewAccountChange: (form: typeof emptyNewAccount) => void;
}) {
  return (
    <div className="field">
      <label>Administrador del edificio</label>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <label style={{ fontWeight: 400 }}>
          <input type="radio" checked={mode === 'existing'} onChange={() => onModeChange('existing')} /> Elegir existente
        </label>
        <label style={{ fontWeight: 400 }}>
          <input type="radio" checked={mode === 'new'} onChange={() => onModeChange('new')} /> Crear cuenta nueva
        </label>
      </div>

      {mode === 'existing' ? (
        existingAdministrators.length > 0 ? (
          <select value={existingUserId} onChange={(e) => onExistingUserIdChange(e.target.value)}>
            <option value="">Selecciona un administrador…</option>
            {existingAdministrators.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {adminLabel(a)} {a.email ? `(${a.email})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Todavía no hay ningún Administrador para reutilizar — crea una cuenta nueva.
          </p>
        )
      ) : (
        <div className="form-row" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Nombre</label>
            <input value={newAccount.first_name} onChange={(e) => onNewAccountChange({ ...newAccount, first_name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Apellido</label>
            <input value={newAccount.last_name} onChange={(e) => onNewAccountChange({ ...newAccount, last_name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Documento</label>
            <input value={newAccount.document_id} onChange={(e) => onNewAccountChange({ ...newAccount, document_id: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label>Email</label>
            <input type="email" value={newAccount.email} onChange={(e) => onNewAccountChange({ ...newAccount, email: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>Contraseña</label>
            <input
              type="password"
              value={newAccount.password}
              onChange={(e) => onNewAccountChange({ ...newAccount, password: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function BuildingsClient({
  buildings,
  existingAdministrators,
}: {
  buildings: Building[];
  existingAdministrators: AdminProfile[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [adminMode, setAdminMode] = useState<'existing' | 'new'>(existingAdministrators.length > 0 ? 'existing' : 'new');
  const [existingUserId, setExistingUserId] = useState('');
  const [newAccount, setNewAccount] = useState(emptyNewAccount);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);

  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reassignMode, setReassignMode] = useState<'existing' | 'new'>('existing');
  const [reassignUserId, setReassignUserId] = useState('');
  const [reassignNewAccount, setReassignNewAccount] = useState(emptyNewAccount);

  function administratorChoice(mode: 'existing' | 'new', userId: string, account: typeof emptyNewAccount): AdministratorChoice {
    return mode === 'existing' ? { kind: 'existing', userId } : { kind: 'new', ...account };
  }

  function resetCreateForm() {
    setName('');
    setLogoFile(null);
    setAdminMode(existingAdministrators.length > 0 ? 'existing' : 'new');
    setExistingUserId('');
    setNewAccount(emptyNewAccount);
    setShowCreate(false);
  }

  function submitCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createBuilding(name, fileFormData(logoFile), administratorChoice(adminMode, existingUserId, newAccount));
      if (!result.ok) setError(result.error);
      else resetCreateForm();
    });
  }

  function startEdit(b: Building) {
    setEditingId(b.id);
    setEditName(b.name);
    setEditLogoFile(null);
  }

  function submitEdit() {
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      const result = await updateBuilding(editingId, editName, fileFormData(editLogoFile));
      if (!result.ok) setError(result.error);
      else setEditingId(null);
    });
  }

  function startReassign(b: Building) {
    setReassigningId(b.id);
    setReassignMode(existingAdministrators.length > 0 ? 'existing' : 'new');
    setReassignUserId('');
    setReassignNewAccount(emptyNewAccount);
  }

  function submitReassign() {
    if (!reassigningId) return;
    setError(null);
    startTransition(async () => {
      const result = await reassignBuildingAdministrator(
        reassigningId,
        administratorChoice(reassignMode, reassignUserId, reassignNewAccount),
      );
      if (!result.ok) setError(result.error);
      else setReassigningId(null);
    });
  }

  const canSubmitCreate =
    !isPending &&
    name.trim() &&
    (adminMode === 'existing'
      ? existingUserId
      : newAccount.first_name.trim() && newAccount.last_name.trim() && newAccount.document_id.trim() && newAccount.email.trim() && newAccount.password.length >= 8);

  const canSubmitReassign =
    !isPending &&
    (reassignMode === 'existing'
      ? reassignUserId
      : reassignNewAccount.first_name.trim() &&
        reassignNewAccount.last_name.trim() &&
        reassignNewAccount.document_id.trim() &&
        reassignNewAccount.email.trim() &&
        reassignNewAccount.password.length >= 8);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuarios y roles</h1>
          <p>Crea edificios y administra sus Administradores.</p>
        </div>
        <button className="btn" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancelar' : 'Crear edificio'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {showCreate && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="field">
            <label>Nombre del edificio</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Logo (opcional, debe ser cuadrado)</label>
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
          </div>
          <AdministratorPicker
            existingAdministrators={existingAdministrators}
            mode={adminMode}
            onModeChange={setAdminMode}
            existingUserId={existingUserId}
            onExistingUserIdChange={setExistingUserId}
            newAccount={newAccount}
            onNewAccountChange={setNewAccount}
          />
          <button className="btn" onClick={submitCreate} disabled={!canSubmitCreate} style={{ marginTop: 8 }}>
            Crear edificio
          </button>
        </div>
      )}

      <div className="grid">
        {buildings.map((b) => (
          <div key={b.id} className="tile">
            <div className="tile-body">
              <div className="tile-image-wrap">
                {b.logo_signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logo_signed_url} alt="" className="tile-image" />
                ) : (
                  <div className="tile-image-placeholder">
                    <IconBuilding width={24} height={24} />
                  </div>
                )}
              </div>

              {editingId === b.id ? (
                <div style={{ marginTop: 8 }}>
                  <div className="field">
                    <label>Nombre</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Logo</label>
                    <input type="file" accept="image/*" onChange={(e) => setEditLogoFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={{ padding: '5px 10px' }} onClick={submitEdit} disabled={isPending || !editName.trim()}>
                      Guardar
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '5px 10px' }} onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {b.name}
                    <button className="icon-btn" onClick={() => startEdit(b)} title="Editar">
                      <IconPencil width={14} height={14} />
                    </button>
                  </div>

                  <div className="tile-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <IconUsers width={14} height={14} />
                    {b.administrators.length > 0 ? (
                      b.administrators.map((a) => adminLabel(a)).join(', ')
                    ) : (
                      <span style={{ color: 'var(--color-danger)' }}>Sin administrador</span>
                    )}
                  </div>

                  {reassigningId === b.id ? (
                    <div style={{ marginTop: 8 }}>
                      <AdministratorPicker
                        existingAdministrators={existingAdministrators}
                        mode={reassignMode}
                        onModeChange={setReassignMode}
                        existingUserId={reassignUserId}
                        onExistingUserIdChange={setReassignUserId}
                        newAccount={reassignNewAccount}
                        onNewAccountChange={setReassignNewAccount}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" style={{ padding: '5px 10px' }} onClick={submitReassign} disabled={!canSubmitReassign}>
                          Guardar
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '5px 10px' }} onClick={() => setReassigningId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-secondary" style={{ marginTop: 8, padding: '5px 10px' }} onClick={() => startReassign(b)}>
                      {b.administrators.length > 0 ? 'Reasignar administrador' : 'Asignar administrador'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {buildings.length === 0 && <p>Todavía no hay edificios. Crea el primero arriba.</p>}
      </div>
    </div>
  );
}
