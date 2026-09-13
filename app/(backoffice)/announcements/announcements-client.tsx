'use client';

import { useState, useTransition } from 'react';
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePin,
  addAttachment,
  getAttachmentUrl,
} from './actions';
import { Modal } from '@/components/Modal';
import { Toggle } from '@/components/Toggle';
import { IconPin, IconPencil, IconTrash, IconPlus, IconPaperclip } from '@/components/icons';
import { fileFormData } from '@/lib/supabase/storage';

type Attachment = { id: string; file_name: string };
type Announcement = {
  id: string;
  title: string;
  body: string;
  banner_url: string | null;
  banner_signed_url: string | null;
  pinned: boolean;
  created_at: string;
  attachments: Attachment[];
};

const emptyForm = { title: '', body: '', pinned: false };

export function AnnouncementsClient({
  buildingId,
  announcements,
}: {
  buildingId: string;
  announcements: Announcement[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setBannerFile(null);
    setAttachFile(null);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(a: Announcement) {
    setEditingId(a.id);
    setForm({ title: a.title, body: a.body, pinned: a.pinned });
    setBannerFile(null);
    setAttachFile(null);
    setError(null);
    setModalOpen(true);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = editingId
        ? await updateAnnouncement(editingId, buildingId, form, fileFormData(bannerFile))
        : await createAnnouncement(buildingId, form, fileFormData(bannerFile));
      if (!result.ok) setError(result.error);
      else setModalOpen(false);
    });
  }

  function remove(a: Announcement) {
    if (!confirm(`¿Eliminar "${a.title}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAnnouncement(a.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  function togglePinned(a: Announcement) {
    setError(null);
    startTransition(async () => {
      const result = await togglePin(a.id, buildingId, !a.pinned);
      if (!result.ok) setError(result.error);
    });
  }

  function uploadAttachment() {
    if (!editingId || !attachFile) return;
    setError(null);
    startTransition(async () => {
      const result = await addAttachment(editingId, buildingId, fileFormData(attachFile)!);
      if (!result.ok) setError(result.error);
      else setAttachFile(null);
    });
  }

  async function openAttachment(attachmentId: string) {
    setError(null);
    const result = await getAttachmentUrl(attachmentId);
    if (!result.ok) setError(result.error);
    else window.open(result.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Noticias y avisos</h1>
          <p>Publica anuncios y gestiona categorías.</p>
        </div>
        <button className="btn" onClick={openCreate}>
          <IconPlus width={16} height={16} /> Nuevo aviso
        </button>
      </div>

      {error && !modalOpen && <p className="error-text">{error}</p>}

      <div className="row-list">
        {announcements.map((a) => (
          <div key={a.id} className="row">
            <div className="row-top">
              <div style={{ flex: 1 }}>
                {a.banner_signed_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.banner_signed_url}
                    alt=""
                    style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }}
                  />
                )}
                <div className="row-title">
                  {a.pinned && <IconPin width={14} height={14} style={{ color: 'var(--color-accent)' }} />}
                  {a.title}
                </div>
                <p className="row-body">{a.body}</p>
                {a.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {a.attachments.map((att) => (
                      <button
                        key={att.id}
                        className="btn btn-secondary"
                        onClick={() => openAttachment(att.id)}
                        style={{ padding: '4px 10px', fontSize: 12.5 }}
                      >
                        <IconPaperclip width={14} height={14} /> {att.file_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="row-actions">
                <button
                  className={`icon-btn${a.pinned ? ' pinned' : ''}`}
                  onClick={() => togglePinned(a)}
                  aria-label={a.pinned ? 'Desfijar' : 'Fijar arriba'}
                  title={a.pinned ? 'Desfijar' : 'Fijar arriba'}
                >
                  <IconPin width={16} height={16} />
                </button>
                <button className="icon-btn" onClick={() => openEdit(a)} aria-label="Editar">
                  <IconPencil width={16} height={16} />
                </button>
                <button className="icon-btn danger" onClick={() => remove(a)} aria-label="Eliminar">
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {announcements.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>Aún no hay avisos.</p>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar aviso' : 'Nuevo aviso'}>
        <div className="field">
          <label>Título *</label>
          <input
            placeholder="Titular del aviso"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Contenido *</label>
          <textarea
            rows={5}
            placeholder="Escribe los detalles del aviso…"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Banner (opcional, máx. 5MB)</label>
          <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="field">
          <Toggle
            checked={form.pinned}
            onChange={(v) => setForm({ ...form, pinned: v })}
            label="Fijar arriba — se muestra primero en la lista"
          />
        </div>
        {editingId && (
          <div className="field">
            <label>Adjuntar archivo</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="file"
                style={{ fontSize: 12 }}
                onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
              />
              <button
                className="btn btn-secondary"
                onClick={uploadAttachment}
                disabled={!attachFile || isPending}
                style={{ padding: '5px 10px', fontSize: 12.5 }}
              >
                <IconPaperclip width={14} height={14} /> Adjuntar
              </button>
            </div>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={isPending}>
            Cancelar
          </button>
          <button className="btn" onClick={submit} disabled={isPending || !form.title}>
            {editingId ? 'Guardar' : 'Publicar aviso'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
