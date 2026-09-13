'use client';

import { useMemo, useState, useTransition } from 'react';
import { setApartmentFee, bulkSetFees, approvePayment, setFinanceSettings } from './actions';
import { Badge } from '@/components/Badge';

type Apartment = {
  id: string;
  tower: string | null;
  unit_number: string;
  monthly_fee: number | null;
};
type Settings = {
  payment_available_day: number | null;
  payment_due_day: number | null;
  late_fee_type: 'flat' | 'percent' | null;
  late_fee_amount: number | null;
};
type Payment = {
  id: string;
  apartment_id: string;
  amount: number;
  late_fee_amount: number | null;
  status: 'pending' | 'submitted' | 'received' | 'overdue';
  available_date: string;
  due_date: string;
  reviewed_at: string | null;
  apartments: { tower: string | null; unit_number: string } | null;
};

const STATUS: Record<
  Payment['status'],
  { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }
> = {
  pending: { label: 'Pendiente', tone: 'neutral' },
  submitted: { label: 'Confirmación enviada', tone: 'warning' },
  received: { label: 'Recibido', tone: 'success' },
  overdue: { label: 'Vencido', tone: 'danger' },
};

function apartmentLabel(a: { tower: string | null; unit_number: string } | null) {
  if (!a) return '—';
  return a.tower ? `${a.tower} ${a.unit_number}` : a.unit_number;
}

export function FinanceClient({
  buildingId,
  apartments,
  settings,
  payments,
}: {
  buildingId: string;
  apartments: Apartment[];
  settings: Settings;
  payments: Payment[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  const [feeApartmentId, setFeeApartmentId] = useState('');
  const [feeAmount, setFeeAmount] = useState('');

  const [settingsForm, setSettingsForm] = useState({
    payment_available_day: settings.payment_available_day?.toString() ?? '',
    payment_due_day: settings.payment_due_day?.toString() ?? '',
    late_fee_type: settings.late_fee_type ?? '',
    late_fee_amount: settings.late_fee_amount?.toString() ?? '',
  });

  const [filterApartment, setFilterApartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (filterApartment && p.apartment_id !== filterApartment) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterFrom && p.due_date < filterFrom) return false;
      if (filterTo && p.due_date > filterTo) return false;
      return true;
    });
  }, [payments, filterApartment, filterStatus, filterFrom, filterTo]);

  function saveFee() {
    setError(null);
    startTransition(async () => {
      const result = await setApartmentFee(buildingId, {
        apartment_id: feeApartmentId,
        amount: Number(feeAmount),
      });
      if (!result.ok) setError(result.error);
      else {
        setFeeApartmentId('');
        setFeeAmount('');
      }
    });
  }

  function uploadCsv(file: File | null) {
    if (!file) return;
    setError(null);
    setBulkErrors([]);
    startTransition(async () => {
      const text = await file.text();
      const result = await bulkSetFees(buildingId, text);
      if (!result.ok) setError(result.error);
      if (result.errors?.length) setBulkErrors(result.errors);
    });
  }

  function saveSettings() {
    setError(null);
    startTransition(async () => {
      const result = await setFinanceSettings(buildingId, {
        payment_available_day: Number(settingsForm.payment_available_day),
        payment_due_day: Number(settingsForm.payment_due_day),
        late_fee_type:
          settingsForm.late_fee_type === ''
            ? null
            : (settingsForm.late_fee_type as 'flat' | 'percent'),
        late_fee_amount:
          settingsForm.late_fee_amount === '' ? null : Number(settingsForm.late_fee_amount),
      });
      if (!result.ok) setError(result.error);
    });
  }

  function approve(paymentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await approvePayment(buildingId, { payment_id: paymentId });
      if (!result.ok) setError(result.error);
    });
  }

  function exportCsv() {
    const header = 'Apartamento,Monto,Recargo,Estado,Disponible,Vence';
    const lines = filteredPayments.map((p) =>
      [
        apartmentLabel(p.apartments),
        p.amount,
        p.late_fee_amount ?? '',
        STATUS[p.status].label,
        p.available_date,
        p.due_date,
      ].join(','),
    );
    const blob = new Blob([[header, ...lines].join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pagos.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Finanzas</h1>
          <p>Cuotas por apartamento, ciclo de pago, recargos por mora, y el historial de pagos.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {bulkErrors.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <strong>Algunas filas no se aplicaron:</strong>
          <ul>
            {bulkErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
          Cuota por apartamento
        </div>
        <div className="form-row">
          <div className="field" style={{ flex: 1 }}>
            <label>Apartamento</label>
            <select value={feeApartmentId} onChange={(e) => setFeeApartmentId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {apartmentLabel(a)} {a.monthly_fee !== null ? `(actual: ${a.monthly_fee})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Monto</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
            />
          </div>
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button
              className="btn btn-inline"
              onClick={saveFee}
              disabled={isPending || !feeApartmentId || !feeAmount}
            >
              Guardar
            </button>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: 12 }}>
          <a className="btn btn-secondary" href="/finance/template">
            Descargar plantilla CSV
          </a>
          <div className="field">
            <label>Subir CSV de cuotas</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => uploadCsv(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="field" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
          Ciclo de pago y recargo por mora
        </div>
        <div className="form-row">
          <div className="field" style={{ flex: 1 }}>
            <label>Día disponible (1-31)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={settingsForm.payment_available_day}
              onChange={(e) =>
                setSettingsForm({ ...settingsForm, payment_available_day: e.target.value })
              }
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Día de vencimiento (1-31)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={settingsForm.payment_due_day}
              onChange={(e) =>
                setSettingsForm({ ...settingsForm, payment_due_day: e.target.value })
              }
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Tipo de recargo</label>
            <select
              value={settingsForm.late_fee_type}
              onChange={(e) => setSettingsForm({ ...settingsForm, late_fee_type: e.target.value })}
            >
              <option value="">Sin recargo</option>
              <option value="flat">Monto fijo</option>
              <option value="percent">Porcentaje</option>
            </select>
          </div>
          {settingsForm.late_fee_type !== '' && (
            <div className="field" style={{ flex: 1 }}>
              <label>{settingsForm.late_fee_type === 'percent' ? 'Porcentaje' : 'Monto'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settingsForm.late_fee_amount}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, late_fee_amount: e.target.value })
                }
              />
            </div>
          )}
          <div className="field" style={{ alignSelf: 'flex-end' }}>
            <button className="btn" onClick={saveSettings} disabled={isPending}>
              Guardar
            </button>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div className="field" style={{ fontWeight: 600, fontSize: 13 }}>
            Pagos
          </div>
          <button className="btn btn-secondary" onClick={exportCsv}>
            Exportar
          </button>
        </div>

        <div className="form-row" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Apartamento</label>
            <select value={filterApartment} onChange={(e) => setFilterApartment(e.target.value)}>
              <option value="">Todos</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {apartmentLabel(a)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="submitted">Confirmación enviada</option>
              <option value="received">Recibido</option>
              <option value="overdue">Vencido</option>
            </select>
          </div>
          <div className="field">
            <label>Vence desde</label>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Vence hasta</label>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Apartamento</th>
              <th>Monto</th>
              <th>Recargo</th>
              <th>Estado</th>
              <th>Disponible</th>
              <th>Vence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((p) => (
              <tr key={p.id}>
                <td>{apartmentLabel(p.apartments)}</td>
                <td>{p.amount}</td>
                <td>{p.late_fee_amount ?? '—'}</td>
                <td>
                  <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                </td>
                <td>{p.available_date}</td>
                <td>{p.due_date}</td>
                <td>
                  {(p.status === 'pending' ||
                    p.status === 'submitted' ||
                    p.status === 'overdue') && (
                    <button
                      className="btn"
                      style={{ padding: '5px 10px' }}
                      onClick={() => approve(p.id)}
                      disabled={isPending}
                    >
                      Aprobar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-cell">
                  Sin pagos que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
