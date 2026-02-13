'use client';

import Link from 'next/link';
import { X, CalendarClock } from 'lucide-react';
import type { ReactNode } from 'react';

export type ApptItem = {
  id: string;
  patientId: string;
  startIso: string;
  endIso?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  patientName?: string | null;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AppointmentsModal({
  isOpen,
  onClose,
  title,
  items,
  headerRight,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: ApptItem[];
  headerRight?: ReactNode;
}) {
  if (!isOpen) return null;

  const sorted = [...(items ?? [])].sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {sorted.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No hay citas para mostrar.</div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-auto max-h-[65vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Fecha</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Hora</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Paciente</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Estado</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => {
                    const pay = a.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente';
                    const st = a.status ?? 'pending';
                    const stLabel = st === 'done' ? 'Hecha' : st === 'cancelled' ? 'Cancelada' : 'Pendiente';
                    return (
                      <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 whitespace-nowrap">{fmtDate(a.startIso)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {fmtTime(a.startIso)}{a.endIso ? ` - ${fmtTime(a.endIso)}` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/patient/${a.patientId}`} className="text-blue-700 dark:text-blue-400 hover:underline font-semibold">
                            {a.patientName ?? 'Paciente'}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{stLabel}</td>
                        <td className="px-4 py-3">{pay}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
