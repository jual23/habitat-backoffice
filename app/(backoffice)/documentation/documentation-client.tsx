'use client';

import { useState, useTransition } from 'react';
import {
  createFolder,
  renameFolder,
  deleteFolder,
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
} from './actions';
import { IconFile, IconPencil, IconTrash, IconPlus } from '@/components/icons';
import { fileFormData } from '@/lib/supabase/storage';

type Folder = { id: string; name: string; parent_id: string | null };
type Doc = { id: string; name: string; folder_id: string | null; size_bytes: number | null };

export function DocumentationClient({
  buildingId,
  folders,
  documents,
}: {
  buildingId: string;
  folders: Folder[];
  documents: Doc[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  function folderLabel(id: string) {
    return folders.find((f) => f.id === id)?.name ?? '(desconocida)';
  }

  function createChildFolder() {
    if (!newFolderName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createFolder(buildingId, { name: newFolderName, parent_id: selectedFolder });
      if (!result.ok) setError(result.error);
      else setNewFolderName('');
    });
  }

  function rename(f: Folder) {
    const name = prompt('Nuevo nombre de la carpeta', f.name);
    if (!name || name === f.name) return;
    setError(null);
    startTransition(async () => {
      const result = await renameFolder(f.id, buildingId, name);
      if (!result.ok) setError(result.error);
    });
  }

  function remove(f: Folder) {
    if (!confirm(`¿Eliminar "${f.name}" y todo su contenido?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteFolder(f.id, buildingId);
      if (!result.ok) setError(result.error);
      else if (selectedFolder === f.id) setSelectedFolder(null);
    });
  }

  function upload() {
    if (!uploadFile) return;
    setError(null);
    startTransition(async () => {
      const result = await uploadDocument(buildingId, selectedFolder, fileFormData(uploadFile)!);
      if (!result.ok) setError(result.error);
      else setUploadFile(null);
    });
  }

  function removeDoc(d: Doc) {
    if (!confirm(`¿Eliminar "${d.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDocument(d.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  async function openDoc(d: Doc) {
    setError(null);
    const result = await getDocumentUrl(d.id);
    if (!result.ok) setError(result.error);
    else window.open(result.url, '_blank', 'noopener,noreferrer');
  }

  const visibleFolders = folders.filter((f) => f.parent_id === selectedFolder);
  const visibleDocs = documents.filter((d) => d.folder_id === selectedFolder);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Documentos</h1>
          <p>Organiza documentos en carpetas.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-secondary" style={{ padding: '5px 10px' }} onClick={() => setSelectedFolder(null)}>
          Raíz
        </button>
        {selectedFolder && <span style={{ color: 'var(--color-text-muted)' }}>/ {folderLabel(selectedFolder)}</span>}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card card-pad" style={{ maxWidth: 480, marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
          Nueva subcarpeta aquí
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} style={{ flex: 1, padding: 9, border: '1px solid var(--color-border)', borderRadius: 6 }} />
          <button className="btn" onClick={createChildFolder} disabled={isPending || !newFolderName.trim()}>
            <IconPlus width={16} height={16} /> Crear
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15 }}>Carpetas</h2>
        <table>
          <tbody>
            {visibleFolders.map((f) => (
              <tr key={f.id}>
                <td>
                  <button className="btn btn-secondary" style={{ padding: '5px 10px' }} onClick={() => setSelectedFolder(f.id)}>
                    📁 {f.name}
                  </button>
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="icon-btn" onClick={() => rename(f)} aria-label="Renombrar">
                    <IconPencil width={16} height={16} />
                  </button>
                  <button className="icon-btn danger" onClick={() => remove(f)} aria-label="Eliminar">
                    <IconTrash width={16} height={16} />
                  </button>
                </td>
              </tr>
            ))}
            {visibleFolders.length === 0 && (
              <tr>
                <td className="empty-cell">Sin subcarpetas aquí.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 style={{ fontSize: 15 }}>Documentos aquí</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          <button className="btn" onClick={upload} disabled={isPending || !uploadFile}>
            Subir (máx. 20MB)
          </button>
        </div>
        <table>
          <tbody>
            {visibleDocs.map((d) => (
              <tr key={d.id}>
                <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconFile width={16} height={16} /> {d.name}
                </td>
                <td>{d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB` : '—'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary" style={{ padding: '5px 10px' }} onClick={() => openDoc(d)}>
                    Abrir
                  </button>
                  <button className="icon-btn danger" onClick={() => removeDoc(d)} aria-label="Eliminar">
                    <IconTrash width={16} height={16} />
                  </button>
                </td>
              </tr>
            ))}
            {visibleDocs.length === 0 && (
              <tr>
                <td className="empty-cell">Sin documentos aquí.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
