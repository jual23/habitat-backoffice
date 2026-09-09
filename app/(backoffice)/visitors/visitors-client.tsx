'use client';

import { useState, useTransition } from 'react';
import { markVisitorArrived } from './actions';
import { Badge } from '@/components/Badge';

type Visitor = {
  id: string;
  full_name: string;
  document_id: string | null;
  vehicle_plate: string | null;
  status: 'pending' | 'arrived' | 'expired';
  expires_at: string;
  arrived_at: string | null;
  apartment_id: string | null;
  apartments: { tower: string | null; unit_number: string } | null;
};

/** 007-finance-ops-expansion (US3): apartment label, matching apartmentLabel() elsewhere. */
function apartmentLabel(v: Visitor) {
  if (!v.apartments) return '—';
  return v.apartments.tower ? `${v.apartments.tower} ${v.apartments.unit_number}` : v.apartments.unit_number;
}

const STATUS: Record<Visitor['status'], { label: string; tone: 'success' | 'neutral' | 'warning' }> = {
  pending: { label: 'Esperado', tone: 'warning' },
  arrived: { label: 'Llegó', tone: 'success' },
  expired: { label: 'Expirado', tone: 'neutral' },
};

export function VisitorsClient({ buildingId, visitors }: { buildingId: string; visitors: Visitor[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function markArrived(v: Visitor) {
    setError(null);
    startTransition(async () => {
      const result = await markVisitorArrived(v.id, buildingId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Visitas</h1>
          <p>Las visitas esperadas expiran automáticamente 8 horas después de registrarse.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Apartamento</th>
            <th>Documento</th>
            <th>Vehículo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visitors.map((v) => (
            <tr key={v.id}>
              <td>{v.full_name}</td>
              <td>{apartmentLabel(v)}</td>
              <td>{v.document_id ?? '—'}</td>
              <td>{v.vehicle_plate ?? '—'}</td>
              <td>
                <Badge tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Badge>
              </td>
              <td>
                {v.status === 'pending' && (
                  <button className="btn" style={{ padding: '5px 10px' }} onClick={() => markArrived(v)} disabled={isPending}>
                    Marcar llegada
                  </button>
                )}
              </td>
            </tr>
          ))}
          {visitors.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-cell">
                Sin visitas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
