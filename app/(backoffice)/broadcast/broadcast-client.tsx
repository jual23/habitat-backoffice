'use client';

import { useState, useTransition } from 'react';
import {
  sendBroadcast,
  deactivateBroadcast,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
  setStaffBroadcastPermission,
} from './actions';
import { Badge } from '@/components/Badge';
import { Toggle } from '@/components/Toggle';
import { IconFire, IconWaterDrop, IconAlertTriangle, IconMegaphone, IconPencil, IconTrash } from '@/components/icons';
import type { BroadcastIcon } from '@/lib/validation/broadcast';

const ICON_COMPONENTS: Record<BroadcastIcon, typeof IconFire> = {
  fire: IconFire,
  'water-drop': IconWaterDrop,
  'warning-triangle': IconAlertTriangle,
  megaphone: IconMegaphone,
};

const ICON_LABELS: Record<BroadcastIcon, string> = {
  fire: 'Incendio',
  'water-drop': 'Inundación',
  'warning-triangle': 'Advertencia',
  megaphone: 'General',
};

function IconPreview({ icon }: { icon: string | null }) {
  const Icon = icon && icon in ICON_COMPONENTS ? ICON_COMPONENTS[icon as BroadcastIcon] : null;
  if (!Icon) return null;
  return <Icon width={16} height={16} />;
}

type Broadcast = {
  id: string;
  message: string;
  icon: string | null;
  template_id: string | null;
  status: 'active' | 'deactivated';
  sent_by: string;
  deactivated_at: string | null;
  created_at: string;
};
type Template = { id: string; message: string; icon: string | null; created_at: string };

export function BroadcastClient({
  buildingId,
  isStaffOnly,
  broadcasts,
  templates,
  staffBroadcastEnabled,
}: {
  buildingId: string;
  isStaffOnly: boolean;
  broadcasts: Broadcast[];
  templates: Template[];
  staffBroadcastEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateIcon, setTemplateIcon] = useState<BroadcastIcon | ''>('');

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ message: '', icon: '' as BroadcastIcon | '' });

  // Staff sees the send/active list but the toggle blocks send/deactivate when
  // off -- defense in depth alongside the RLS gate (staffBroadcastEnabled).
  const canAct = !isStaffOnly || staffBroadcastEnabled;

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (template) setMessage(template.message);
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await sendBroadcast(buildingId, {
        message,
        template_id: templateId || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (saveAsTemplate && !templateId) {
        await saveTemplate(buildingId, { message, icon: templateIcon || null });
      }
      setMessage('');
      setTemplateId('');
      setSaveAsTemplate(false);
      setTemplateIcon('');
    });
  }

  function deactivate(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deactivateBroadcast(id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  function startEditTemplate(t: Template) {
    setEditingTemplateId(t.id);
    setEditForm({ message: t.message, icon: (t.icon as BroadcastIcon) ?? '' });
  }

  function saveTemplateEdit() {
    if (!editingTemplateId) return;
    setError(null);
    startTransition(async () => {
      const result = await updateTemplate(buildingId, {
        template_id: editingTemplateId,
        message: editForm.message,
        icon: editForm.icon || null,
      });
      if (!result.ok) setError(result.error);
      else setEditingTemplateId(null);
    });
  }

  function removeTemplate(t: Template) {
    if (!confirm(`¿Eliminar la plantilla "${t.message}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTemplate(t.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  function toggleStaffPermission(enabled: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setStaffBroadcastPermission(buildingId, { enabled });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Difusión</h1>
          <p>Envía alertas urgentes a todos los residentes del edificio.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isStaffOnly && !staffBroadcastEnabled && (
        <p className="error-text">
          El Administrador aún no ha habilitado el envío de difusiones para el personal.
        </p>
      )}

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
          Nuevo mensaje
        </div>
        {templates.length > 0 && (
          <div className="field" style={{ marginBottom: 8, maxWidth: 320 }}>
            <label>Usar plantilla</label>
            <select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Mensaje nuevo</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.message.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Mensaje</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        {!templateId && (
          <div className="form-row" style={{ marginBottom: 8, alignItems: 'center' }}>
            <Toggle checked={saveAsTemplate} onChange={setSaveAsTemplate} label="Guardar como plantilla" />
            {saveAsTemplate && (
              <div className="field">
                <label>Ícono</label>
                <select value={templateIcon} onChange={(e) => setTemplateIcon(e.target.value as BroadcastIcon)}>
                  <option value="">Sin ícono</option>
                  {(Object.keys(ICON_LABELS) as BroadcastIcon[]).map((key) => (
                    <option key={key} value={key}>
                      {ICON_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
        <button className="btn" onClick={send} disabled={isPending || !message.trim() || !canAct}>
          Enviar difusión
        </button>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
          Difusiones
        </div>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Mensaje</th>
              <th>Estado</th>
              <th>Enviado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => (
              <tr key={b.id}>
                <td>
                  <IconPreview icon={b.icon} />
                </td>
                <td>{b.message}</td>
                <td>
                  <Badge tone={b.status === 'active' ? 'success' : 'neutral'}>
                    {b.status === 'active' ? 'Activa' : 'Desactivada'}
                  </Badge>
                </td>
                <td>{new Date(b.created_at).toLocaleString()}</td>
                <td>
                  {b.status === 'active' && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '5px 10px' }}
                      onClick={() => deactivate(b.id)}
                      disabled={isPending || !canAct}
                    >
                      Desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-cell">
                  Sin difusiones todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isStaffOnly && (
        <>
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <div className="field" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
              Plantillas
            </div>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Mensaje</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    {editingTemplateId === t.id ? (
                      <>
                        <td>
                          <select
                            value={editForm.icon}
                            onChange={(e) => setEditForm({ ...editForm, icon: e.target.value as BroadcastIcon })}
                          >
                            <option value="">Sin ícono</option>
                            {(Object.keys(ICON_LABELS) as BroadcastIcon[]).map((key) => (
                              <option key={key} value={key}>
                                {ICON_LABELS[key]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={editForm.message}
                            onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                          />
                        </td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="btn" style={{ padding: '5px 10px' }} onClick={saveTemplateEdit} disabled={isPending}>
                            Guardar
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px' }}
                            onClick={() => setEditingTemplateId(null)}
                          >
                            Cancelar
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <IconPreview icon={t.icon} />
                        </td>
                        <td>{t.message}</td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="icon-btn" onClick={() => startEditTemplate(t)} aria-label="Editar">
                            <IconPencil width={16} height={16} />
                          </button>
                          <button className="icon-btn danger" onClick={() => removeTemplate(t)} aria-label="Eliminar">
                            <IconTrash width={16} height={16} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-cell">
                      Sin plantillas guardadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            <Toggle
              checked={staffBroadcastEnabled}
              onChange={toggleStaffPermission}
              label="Permitir que el personal envíe difusiones"
            />
          </div>
        </>
      )}
    </div>
  );
}
