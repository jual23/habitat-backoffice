'use client';

import { useState, useTransition } from 'react';
import { acknowledgeEmergency } from './actions';
import { Badge } from '@/components/Badge';

type Emergency = {
  id: string;
  reported_by: string;
  apartment_id: string | null;
  description: string | null;
  status: 'unhandled' | 'resolved';
  created_at: string;
  resolved_at: string | null;
  apartments: { tower: string | null; unit_number: string } | null;
};

function apartmentLabel(a: { tower: string | null; unit_number: string } | null) {
  if (!a) return '—';
  return a.tower ? `${a.tower} ${a.unit_number}` : a.unit_number;
}

export function EmergencyClient({ buildingId, emergencies }: { buildingId: string; emergencies: Emergency[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function acknowledge(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await acknowledgeEmergency(buildingId, { emergency_id: id });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Emergencias</h1>
          <p>Emergencias reportadas por residentes desde la app móvil.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Apartamento</th>
            <th>Descripción</th>
            <th>Reportado</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {emergencies.map((e) => (
            <tr key={e.id}>
              <td>{apartmentLabel(e.apartments)}</td>
              <td>{e.description ?? '—'}</td>
              <td>{new Date(e.created_at).toLocaleString()}</td>
              <td>
                <Badge tone={e.status === 'unhandled' ? 'danger' : 'success'}>
                  {e.status === 'unhandled' ? 'Sin atender' : 'Resuelto'}
                </Badge>
              </td>
              <td>
                {e.status === 'unhandled' && (
                  <button className="btn" style={{ padding: '5px 10px' }} onClick={() => acknowledge(e.id)} disabled={isPending}>
                    Confirmar atendido
                  </button>
                )}
              </td>
            </tr>
          ))}
          {emergencies.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-cell">
                Sin emergencias reportadas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
