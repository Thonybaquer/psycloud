'use client';

import { useMemo, useState } from 'react';
import { updateAppointmentPayment, updateAppointmentDetails } from '@/app/actions';
import { toast } from 'sonner';
import { getMoneyDecimals } from '@/lib/money';

export type PaymentRow = {
  id: string;
  date: string;
  status: string;
  feeCents: number;
  paymentStatus: 'pending' | 'paid';
  paymentMethod: string | null;
  notes: string | null;
};

function fmtMoneyCOP(cents: number) {
  const v = Math.round((cents ?? 0) / 100);
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function PatientPayments({ initial }: { initial: PaymentRow[] }) {
  const decimals = getMoneyDecimals();
  const [rows, setRows] = useState<PaymentRow[]>(initial ?? []);
  const [savingId, setSavingId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = rows.reduce((acc, r) => acc + (r.feeCents ?? 0), 0);
    const paid = rows.filter((r) => r.paymentStatus === 'paid').reduce((acc, r) => acc + (r.feeCents ?? 0), 0);
    const pending = rows.filter((r) => r.paymentStatus !== 'paid').reduce((acc, r) => acc + (r.feeCents ?? 0), 0);
    // Heuristic: most recent non-zero fee
    const lastFee = rows.find((r) => (r.feeCents ?? 0) > 0)?.feeCents ?? 0;
    return { total, paid, pending, lastFee };
  }, [rows]);

  async function saveRow(id: string, patch: Partial<PaymentRow>) {
    setSavingId(id);
    try {
      // Payment fields
      const res1 = await updateAppointmentPayment({
        id,
        ...(patch.feeCents !== undefined ? { feeCents: patch.feeCents } : {}),
        ...(patch.paymentStatus !== undefined ? { paymentStatus: patch.paymentStatus } : {}),
        ...(patch.paymentMethod !== undefined ? { paymentMethod: patch.paymentMethod } : {}),
      });
      if (!res1.success) throw new Error((res1 as any).error || 'No se pudo guardar');

      // Status (pending/done/cancelled) uses a different action
      if (patch.status !== undefined) {
        const res2 = await updateAppointmentDetails({ id, status: patch.status as any });
        if (!res2.success) throw new Error((res2 as any).error || 'No se pudo guardar');
      }

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as any : r)));
      toast.success('Guardado');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo guardar');
    } finally {
      setSavingId(null);
    }
  }

  function setLocal(id: string, patch: Partial<PaymentRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as any : r)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Pagos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-300">Control simple: pagado / pendiente, método y totales</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Valor por sesión" value={fmtMoneyCOP(summary.lastFee)} />
        <SummaryCard label="Total pagado" value={fmtMoneyCOP(summary.paid)} />
        <SummaryCard label="Pendiente" value={fmtMoneyCOP(summary.pending)} />
      </div>

      <div className="bg-white dark:bg-slate-950 overflow-hidden rounded-xl" style={{ boxShadow: 'var(--pc-card-shadow)' }}>
        <div className="overflow-auto max-h-[420px]">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-200 min-w-[220px]">Cita</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-200 min-w-[160px]">Estado cita</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-200 min-w-[160px]">Pago</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-200 min-w-[220px]">Método</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-200 min-w-[180px]">Valor</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-200 min-w-[220px]">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtDateTime(r.date)}</td>

                  <td className="px-3 py-2">
                    <select
                      value={r.status as any}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLocal(r.id, { status: v });
                        void saveRow(r.id, { status: v });
                      }}
                      className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-slate-800 dark:text-slate-100"
                    >
                      <option value="pending">pending</option>
                      <option value="done">done</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>

                  <td className="px-3 py-2">
                    <select
                      value={r.paymentStatus}
                      onChange={(e) => {
                        const v = e.target.value as any;
                        setLocal(r.id, { paymentStatus: v });
                        void saveRow(r.id, { paymentStatus: v });
                      }}
                      className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-slate-800 dark:text-slate-100"
                    >
                      <option value="pending">Pendiente</option>
                      <option value="paid">Pagado</option>
                    </select>
                  </td>

                  <td className="px-3 py-2">
                    <select
                      value={r.paymentMethod ?? ''}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        setLocal(r.id, { paymentMethod: v });
                        void saveRow(r.id, { paymentMethod: v });
                      }}
                      className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-slate-800 dark:text-slate-100"
                    >
                      <option value="">—</option>
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                      <option value="other">Otro</option>
                    </select>
                  </td>

                  <td className="px-3 py-2">
                    <input
                      value={Math.round((r.feeCents ?? 0) / 100)}
                      onChange={(e) => {
                        const n = Number(e.target.value || 0);
                        setLocal(r.id, { feeCents: Math.max(0, Math.round(n)) * 100 });
                      }}
                      onBlur={() => saveRow(r.id, { feeCents: r.feeCents })}
                      className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-slate-800 dark:text-slate-100"
                      inputMode="numeric"
                    />
                    <div className="text-xs text-slate-400 mt-1">{fmtMoneyCOP(r.feeCents)}</div>
                  </td>

                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {savingId ? <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-300">Guardando…</div> : null}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="pc-card bg-white dark:bg-slate-950">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">{label}</div>
      <div className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mt-1">{value}</div>
    </div>
  );
}
