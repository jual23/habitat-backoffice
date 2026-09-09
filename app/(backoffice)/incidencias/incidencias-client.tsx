'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import { startProgress, resolveTicket, rejectTicket, markDuplicate, addComment } from './actions';
import { Badge } from '@/components/Badge';
import type { Enums } from '@/lib/supabase/database.types';

type TicketStatus = Enums<'ticket_status'>;

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  rejection_reason: string | null;
  duplicate_of_ticket_id: string | null;
  apartment_id: string | null;
  reported_by: string;
  created_at: string;
};

type Comment = { id: string; ticket_id: string; author_id: string; body: string; created_at: string };
type Apartment = { id: string; unit_number: string; tower: string | null };
type DuplicateCandidate = { id: string; title: string };

const STATUS: Record<TicketStatus, { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  in_progress: { label: 'En progreso', tone: 'neutral' },
  resolved: { label: 'Resuelto', tone: 'success' },
  rejected: { label: 'Rechazado', tone: 'danger' },
  duplicate: { label: 'Duplicado', tone: 'neutral' },
};

type SortKey = 'title' | 'created_at' | 'status';

function apartmentLabel(apartments: Apartment[], apartmentId: string | null) {
  if (!apartmentId) return '—';
  const a = apartments.find((x) => x.id === apartmentId);
  if (!a) return '—';
  return a.tower ? `${a.tower} · ${a.unit_number}` : a.unit_number;
}

export function IncidenciasClient({
  buildingId,
  tickets,
  comments,
  apartments,
  duplicateCandidates,
}: {
  buildingId: string;
  tickets: Ticket[];
  comments: Comment[];
  apartments: Apartment[];
  duplicateCandidates: DuplicateCandidate[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [rejectDraft, setRejectDraft] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState('');
  const [showDuplicateForm, setShowDuplicateForm] = useState(false);

  const visible = useMemo(() => {
    const filtered = statusFilter === 'all' ? tickets : tickets.filter((t) => t.status === statusFilter);
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      else cmp = a.created_at.localeCompare(b.created_at);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [tickets, statusFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleExpand(t: Ticket) {
    setError(null);
    setShowRejectForm(false);
    setShowDuplicateForm(false);
    setCommentDraft('');
    setRejectDraft('');
    setDuplicateTarget('');
    setExpandedId((id) => (id === t.id ? null : t.id));
  }

  function doStartProgress(t: Ticket) {
    setError(null);
    startTransition(async () => {
      const result = await startProgress(t.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  function doResolve(t: Ticket) {
    setError(null);
    startTransition(async () => {
      const result = await resolveTicket(t.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  function submitReject(t: Ticket) {
    setError(null);
    startTransition(async () => {
      const result = await rejectTicket({ ticket_id: t.id, rejection_reason: rejectDraft }, buildingId);
      if (!result.ok) setError(result.error);
      else {
        setShowRejectForm(false);
        setRejectDraft('');
      }
    });
  }

  function submitDuplicate(t: Ticket) {
    setError(null);
    startTransition(async () => {
      const result = await markDuplicate({ ticket_id: t.id, duplicate_of_ticket_id: duplicateTarget }, buildingId);
      if (!result.ok) setError(result.error);
      else {
        setShowDuplicateForm(false);
        setDuplicateTarget('');
      }
    });
  }

  function submitComment(t: Ticket) {
    setError(null);
    startTransition(async () => {
      const result = await addComment({ ticket_id: t.id, body: commentDraft }, buildingId);
      if (!result.ok) setError(result.error);
      else setCommentDraft('');
    });
  }

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Incidencias</h1>
          <p>Gestiona solicitudes de mantenimiento y servicio reportadas por los residentes.</p>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Filtrar por estado</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}>
            <option value="all">Todos</option>
            {Object.entries(STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <table>
        <thead>
          <tr>
            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('title')}>
              Título{sortIndicator('title')}
            </th>
            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>
              Fecha{sortIndicator('created_at')}
            </th>
            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>
              Estado{sortIndicator('status')}
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((t) => {
            const target = t.duplicate_of_ticket_id
              ? tickets.find((x) => x.id === t.duplicate_of_ticket_id)
              : null;
            const ticketComments = comments.filter((c) => c.ticket_id === t.id);
            const isExpanded = expandedId === t.id;
            const isTerminal = t.status === 'resolved' || t.status === 'rejected' || t.status === 'duplicate';

            return (
              <Fragment key={t.id}>
                <tr id={`ticket-${t.id}`} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(t)}>
                  <td>{t.title}</td>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td>
                    <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                  </td>
                  <td>{isExpanded ? '▲' : '▼'}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={4}>
                      <div onClick={(e) => e.stopPropagation()}>
                        <p>
                          <strong>Apartamento:</strong> {apartmentLabel(apartments, t.apartment_id)}
                        </p>
                        {t.description && (
                          <p>
                            <strong>Descripción:</strong> {t.description}
                          </p>
                        )}
                        {t.status === 'rejected' && t.rejection_reason && (
                          <p>
                            <strong>Motivo de rechazo:</strong> {t.rejection_reason}
                          </p>
                        )}
                        {t.status === 'duplicate' && (
                          <p>
                            <strong>Duplicado de:</strong>{' '}
                            {target ? <a href={`#ticket-${target.id}`}>{target.title}</a> : 'Ticket no encontrado'}
                          </p>
                        )}

                        {ticketComments.length > 0 && (
                          <div>
                            <strong>Comentarios:</strong>
                            <ul>
                              {ticketComments.map((c) => (
                                <li key={c.id}>
                                  {c.body}{' '}
                                  <span style={{ color: 'var(--color-text-muted)' }}>
                                    ({new Date(c.created_at).toLocaleString()})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {t.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="btn" onClick={() => doStartProgress(t)} disabled={isPending}>
                              Iniciar progreso
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setShowRejectForm((v) => !v)}
                              disabled={isPending}
                            >
                              Rechazar
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setShowDuplicateForm((v) => !v)}
                              disabled={isPending}
                            >
                              Marcar duplicado
                            </button>
                          </div>
                        )}

                        {t.status === 'in_progress' && (
                          <div style={{ marginTop: 8 }}>
                            <div className="field">
                              <label>Agregar comentario (visible para el residente)</label>
                              <input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-secondary"
                                onClick={() => submitComment(t)}
                                disabled={isPending || !commentDraft.trim()}
                              >
                                Comentar
                              </button>
                              <button className="btn" onClick={() => doResolve(t)} disabled={isPending}>
                                Resolver
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => setShowRejectForm((v) => !v)}
                                disabled={isPending}
                              >
                                Rechazar
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => setShowDuplicateForm((v) => !v)}
                                disabled={isPending}
                              >
                                Marcar duplicado
                              </button>
                            </div>
                          </div>
                        )}

                        {!isTerminal && showRejectForm && (
                          <div style={{ marginTop: 8 }}>
                            <div className="field">
                              <label>Motivo de rechazo (requerido)</label>
                              <input value={rejectDraft} onChange={(e) => setRejectDraft(e.target.value)} />
                            </div>
                            <button
                              className="btn"
                              onClick={() => submitReject(t)}
                              disabled={isPending || !rejectDraft.trim()}
                            >
                              Confirmar rechazo
                            </button>
                          </div>
                        )}

                        {!isTerminal && showDuplicateForm && (
                          <div style={{ marginTop: 8 }}>
                            <div className="field">
                              <label>Ticket original</label>
                              <select value={duplicateTarget} onChange={(e) => setDuplicateTarget(e.target.value)}>
                                <option value="">Seleccionar…</option>
                                {duplicateCandidates
                                  .filter((c) => c.id !== t.id)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.title}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <button
                              className="btn"
                              onClick={() => submitDuplicate(t)}
                              disabled={isPending || !duplicateTarget}
                            >
                              Confirmar duplicado
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {visible.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-cell">
                Sin incidencias.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
