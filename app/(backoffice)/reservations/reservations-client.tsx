'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { approveReservation, declineReservation } from './actions';
import { Badge } from '@/components/Badge';

type Reservation = {
  id: string;
  facility_id: string;
  reserved_date: string;
  start_time: string;
  end_time: string;
  guests: number;
  status: 'requested' | 'approved' | 'declined' | 'cancelled';
  facility_name: string;
};

const STATUS: Record<Reservation['status'], { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  requested: { label: 'Solicitada', tone: 'warning' },
  approved: { label: 'Aprobada', tone: 'success' },
  declined: { label: 'Rechazada', tone: 'danger' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
};

export function ReservationsClient({
  buildingId,
  reservations,
}: {
  buildingId: string;
  reservations: Reservation[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Reservation['status']>('requested');

  const filtered = useMemo(
    () => (filter === 'all' ? reservations : reservations.filter((r) => r.status === filter)),
    [reservations, filter],
  );

  function approve(r: Reservation) {
    setError(null);
    startTransition(async () => {
      const result = await approveReservation(r.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  function decline(r: Reservation) {
    setError(null);
    startTransition(async () => {
      const result = await declineReservation(r.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reservas</h1>
          <p>Aprueba o rechaza solicitudes de reserva de instalaciones.</p>
        </div>
        <Link href="/facilities" className="btn btn-secondary">
          Instalaciones
        </Link>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {(['requested', 'approved', 'declined', 'all'] as const).map((s) => (
          <button key={s} className={`tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'Todas' : STATUS[s].label}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Instalación</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Invitados</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td>{r.facility_name}</td>
              <td>{r.reserved_date}</td>
              <td>
                {r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}
              </td>
              <td>{r.guests}</td>
              <td>
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                {r.status === 'requested' && (
                  <>
                    <button className="btn" style={{ padding: '5px 10px' }} onClick={() => approve(r)} disabled={isPending}>
                      Aprobar
                    </button>
                    <button className="btn btn-danger" style={{ padding: '5px 10px' }} onClick={() => decline(r)} disabled={isPending}>
                      Rechazar
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-cell">
                Sin reservas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
