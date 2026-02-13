'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { formatMoneyFromCents, getMoneyDecimals } from '@/lib/money';

type KPIs = {
  revenueCents: number;
  revenuePrevCents: number;
  sessions: number;
  // Pacientes atendidos (únicos) en el mes
  patientsUnique: number;
  // Pacientes registrados en el mes (por "Paciente nuevo")
  patientsNew: number;
  // Pacientes atendidos en el mes que fueron registrados en el mismo mes
  patientsNewAttended: number;
  // Pacientes atendidos en el mes que ya existían antes del mes
  patientsReturningAttended: number;
};

type Row = {
  ym: string; // YYYY-MM
  revenueCents: number;
  patientsUnique: number;
  patientsNewAttended: number;
  patientsReturningAttended: number;
};

function pctChange(curr: number, prev: number): number | null {
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / p) * 100;
}

export function DashboardProClient({
  monthStartIso,
  kpis,
  monthlySeries,
}: {
  monthStartIso: string;
  kpis: KPIs;
  monthlySeries: Row[];
}) {
  const decimals = getMoneyDecimals();
  const monthLabel = useMemo(() => {
    try {
      const d = new Date(monthStartIso);
      return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(d);
    } catch {
      return monthStartIso.slice(0, 7);
    }
  }, [monthStartIso]);

  const revenueDelta = pctChange(kpis.revenueCents, kpis.revenuePrevCents);

  const chartData = useMemo(() => {
    return (monthlySeries || []).map((r) => ({
      ...r,
      label: r.ym,
    }));
  }, [monthlySeries]);

  // -------------------------
  // Comparación entre meses (pacientes e ingresos)
  // -------------------------
  const monthOptions = useMemo(() => {
    const opts = (monthlySeries || []).map((r) => r.ym).filter(Boolean);
    // Most recent first
    return [...new Set(opts)].sort((a, b) => (a < b ? 1 : -1));
  }, [monthlySeries]);

  const defaultBaseYm = monthStartIso.slice(0, 7);
  const defaultCompareYm = useMemo(() => {
    // if we have previous month in list, preselect it
    const idx = monthOptions.indexOf(defaultBaseYm);
    return idx >= 0 && monthOptions[idx + 1] ? monthOptions[idx + 1] : (monthOptions[1] ?? defaultBaseYm);
  }, [monthOptions, defaultBaseYm]);

  const [baseYm, setBaseYm] = useState<string>(defaultBaseYm);
  const [compareYm, setCompareYm] = useState<string>(defaultCompareYm);

  const seriesMap = useMemo(() => {
    const m = new Map<string, Row>();
    (monthlySeries || []).forEach((r) => m.set(r.ym, r));
    return m;
  }, [monthlySeries]);

  const baseRow = seriesMap.get(baseYm);
  const cmpRow = seriesMap.get(compareYm);
  const revenueDeltaMonths = pctChange(baseRow?.revenueCents ?? 0, cmpRow?.revenueCents ?? 0);
  const patientsDeltaMonths = pctChange(baseRow?.patientsUnique ?? 0, cmpRow?.patientsUnique ?? 0);

  return (
    <section className="pc-card bg-white dark:bg-slate-950">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Dashboard</div>
          <div className="text-xs text-slate-500 dark:text-slate-300">Resumen mensual — {monthLabel}</div>
        </div>
        <a
          href="/finance"
          className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          Ver Finanzas
        </a>
      </div>

      {/* KPI cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          title="💰 Ingresos (pagados)"
          value={formatMoneyFromCents(kpis.revenueCents || 0, decimals)}
          sub={
            revenueDelta === null
              ? '—'
              : `${revenueDelta >= 0 ? '▲' : '▼'} ${Math.abs(revenueDelta).toFixed(1)}% vs mes anterior`
          }
        />
        <KpiCard title="👥 Atendidos (únicos)" value={String(kpis.patientsUnique || 0)} sub="Citas no canceladas" />
        <KpiCard title="🟢 Nuevos (registrados)" value={String(kpis.patientsNew || 0)} sub="Creados con “Paciente nuevo”" />
        <KpiCard title="🔵 Recurrentes (atendidos)" value={String(kpis.patientsReturningAttended || 0)} sub="Registrados antes del mes" />
        <KpiCard title="📅 Sesiones" value={String(kpis.sessions || 0)} sub="No canceladas" />
      </div>

      {/* Month compare */}
      <div className="mt-4 pc-card">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Comparar meses</div>
            <div className="text-xs text-slate-500 dark:text-slate-300">Pacientes (únicos atendidos) e ingresos</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Mes A
              <select
                className="ml-2 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                value={baseYm}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setBaseYm(e.target.value)}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Mes B
              <select
                className="ml-2 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                value={compareYm}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setCompareYm(e.target.value)}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="pc-card">
            <div className="text-xs" style={{ color: 'var(--pc-muted)' }}>Ingresos (A vs B)</div>
            <div className="mt-2 text-[18px] font-semibold">
              {formatMoneyFromCents(baseRow?.revenueCents ?? 0, decimals)}{' '}
              <span className="text-slate-400">/</span>{' '}
              {formatMoneyFromCents(cmpRow?.revenueCents ?? 0, decimals)}
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--pc-muted)' }}>
              {revenueDeltaMonths === null ? '—' : `${revenueDeltaMonths >= 0 ? '▲' : '▼'} ${Math.abs(revenueDeltaMonths).toFixed(1)}%`}
            </div>
          </div>

          <div className="pc-card">
            <div className="text-xs" style={{ color: 'var(--pc-muted)' }}>Pacientes únicos (A vs B)</div>
            <div className="mt-2 text-[18px] font-semibold">
              {String(baseRow?.patientsUnique ?? 0)} <span className="text-slate-400">/</span> {String(cmpRow?.patientsUnique ?? 0)}
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--pc-muted)' }}>
              {patientsDeltaMonths === null ? '—' : `${patientsDeltaMonths >= 0 ? '▲' : '▼'} ${Math.abs(patientsDeltaMonths).toFixed(1)}%`}
            </div>
          </div>

          <div className="pc-card">
            <div className="text-xs" style={{ color: 'var(--pc-muted)' }}>Nuevos atendidos (A vs B)</div>
            <div className="mt-2 text-[18px] font-semibold">
              {String(baseRow?.patientsNewAttended ?? 0)} <span className="text-slate-400">/</span> {String(cmpRow?.patientsNewAttended ?? 0)}
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--pc-muted)' }}>
              {pctChange(baseRow?.patientsNewAttended ?? 0, cmpRow?.patientsNewAttended ?? 0) === null
                ? '—'
                : `${(pctChange(baseRow?.patientsNewAttended ?? 0, cmpRow?.patientsNewAttended ?? 0) ?? 0) >= 0 ? '▲' : '▼'} ${Math.abs(pctChange(baseRow?.patientsNewAttended ?? 0, cmpRow?.patientsNewAttended ?? 0) ?? 0).toFixed(1)}%`}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="pc-card">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ingresos últimos 12 meses</div>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) => {
                    const v = Number(value) || 0;
                    return formatMoneyFromCents(v, decimals);
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenueCents" name="Ingresos" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">*Se calcula con citas pagadas (fee).</div>
        </div>

        <div className="pc-card">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pacientes últimos 12 meses</div>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="patientsNewAttended" name="Nuevos (atendidos)" />
                <Bar dataKey="patientsReturningAttended" name="Recurrentes (atendidos)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">*Atendidos por mes (citas no canceladas).</div>
        </div>
      </div>
    </section>
  );
}

function KpiCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="pc-card">
      <div className="text-[13px] font-medium" style={{ color: 'var(--pc-muted)' }}>
        {title}
      </div>
      <div className="text-[26px] font-semibold mt-2 leading-none">{value}</div>
      {sub ? <div className="mt-2 text-xs" style={{ color: 'var(--pc-muted)' }}>{sub}</div> : null}
    </div>
  );
}
