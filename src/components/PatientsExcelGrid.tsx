'use client';

import { useMemo, useState } from 'react';
import { importPatientsFromExcel, updatePatient } from '@/app/actions';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

type Row = {
  id: string;
  fullName: string;
  documentId: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  sex: 'Masculino' | 'Femenino' | 'Otro' | null;
  status: 'activo' | 'cerrado' | 'inactivo' | null;
  startDate: string | null;
  closeDate: string | null;
  howArrived: string | null;
  detail: string | null;
  birthDate: string | null;
  type: 'PSY' | 'MED' | null;
  active: any;
  createdAt: string;
};

const COLS: Array<{ key: keyof Row; label: string; w: string }> = [
  { key: 'fullName', label: 'Nombre', w: 'min-w-[260px]' },
  { key: 'documentId', label: 'Documento', w: 'min-w-[140px]' },
  { key: 'email', label: 'Email', w: 'min-w-[220px]' },
  { key: 'phone', label: 'Teléfono', w: 'min-w-[160px]' },
  { key: 'sex', label: 'Sexo', w: 'min-w-[150px]' },
  { key: 'status', label: 'Estado', w: 'min-w-[140px]' },
  { key: 'startDate', label: 'Fecha inicio', w: 'min-w-[160px]' },
  { key: 'closeDate', label: 'Fecha cierre', w: 'min-w-[160px]' },
  { key: 'country', label: 'País', w: 'min-w-[140px]' },
  { key: 'city', label: 'Ciudad', w: 'min-w-[140px]' },
  { key: 'birthDate', label: 'Nacimiento', w: 'min-w-[140px]' },
  { key: 'howArrived', label: 'Cómo llegó', w: 'min-w-[180px]' },
  { key: 'detail', label: 'Detalle', w: 'min-w-[260px]' },
  { key: 'type', label: 'Tipo', w: 'min-w-[120px]' },
];

export function PatientsExcelGrid({ initialRows }: { initialRows: Row[] }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>(initialRows ?? []);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.fullName, r.documentId, r.email, r.phone, r.country, r.city].filter(Boolean).some((x) => String(x).toLowerCase().includes(s))
    );
  }, [q, rows]);

  async function saveCell(id: string, patch: Partial<Row>) {
    try {
      setSavingId(id);
      const res = await updatePatient(id, {
        ...(patch.fullName !== undefined ? { fullName: patch.fullName as string } : {}),
        ...(patch.documentId !== undefined ? { documentId: (patch.documentId as any) ?? null } : {}),
        ...(patch.email !== undefined ? { email: (patch.email as any) ?? null } : {}),
        ...(patch.phone !== undefined ? { phone: (patch.phone as any) ?? null } : {}),
        ...(patch.country !== undefined ? { country: (patch.country as any) ?? null } : {}),
        ...(patch.city !== undefined ? { city: (patch.city as any) ?? null } : {}),
        ...(patch.sex !== undefined ? { sex: (patch.sex as any) ?? null } : {}),
        ...(patch.status !== undefined ? { status: (patch.status as any) ?? null } : {}),
        ...(patch.startDate !== undefined ? { startDate: (patch.startDate as any) ?? null } : {}),
        ...(patch.closeDate !== undefined ? { closeDate: (patch.closeDate as any) ?? null } : {}),
        ...(patch.howArrived !== undefined ? { howArrived: (patch.howArrived as any) ?? null } : {}),
        ...(patch.detail !== undefined ? { detail: (patch.detail as any) ?? null } : {}),
        ...(patch.birthDate !== undefined ? { birthDate: (patch.birthDate as any) || '1900-01-01' } : {}),
        ...(patch.type !== undefined ? { type: (patch.type as any) || 'PSY' } : {}),
      });
      if (!res.success) throw new Error((res as any).error || 'No se pudo guardar');
      toast.success('Guardado');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo guardar');
    } finally {
      setSavingId(null);
    }
  }

  function setRowValue(id: string, key: keyof Row, value: any) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  return (
    <div className="pc-card bg-white dark:bg-slate-900">
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total: {filtered.length}</div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
          <ExcelImportButton
            onImported={(report) => {
              if (!report.success) {
                toast.error(report.errors?.[0]?.message || 'No se pudo importar');
                return;
              }
              toast.success(`Importación lista: ${report.created} creados · ${report.updated} actualizados · ${report.skipped} omitidos`);
              // Refresh server data
              window.location.reload();
            }}
          />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, documento, email…"
          className="w-full md:w-[380px] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        </div>
      </div>

      <div className="overflow-auto max-h-[70vh] rounded-b-2xl">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
            <tr>
              {COLS.map((c) => (
                <th key={String(c.key)} className={`text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-200 ${c.w}`}>
                  {c.label}
                </th>
              ))}
              <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-200 min-w-[140px]">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50">
                {/* Nombre */}
                <td className="px-3 py-2 min-w-[260px]">
                  <input
                    value={r.fullName}
                    onChange={(e) => setRowValue(r.id, 'fullName', e.target.value)}
                    onBlur={() => saveCell(r.id, { fullName: r.fullName })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Documento */}
                <td className="px-3 py-2 min-w-[140px]">
                  <input
                    value={r.documentId ?? ''}
                    onChange={(e) => setRowValue(r.id, 'documentId', e.target.value)}
                    onBlur={() => saveCell(r.id, { documentId: r.documentId ?? '' })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Email */}
                <td className="px-3 py-2 min-w-[220px]">
                  <input
                    value={r.email ?? ''}
                    onChange={(e) => setRowValue(r.id, 'email', e.target.value)}
                    onBlur={() => saveCell(r.id, { email: r.email ?? '' })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Tel */}
                <td className="px-3 py-2 min-w-[160px]">
                  <input
                    value={r.phone ?? ''}
                    onChange={(e) => setRowValue(r.id, 'phone', e.target.value)}
                    onBlur={() => saveCell(r.id, { phone: r.phone ?? '' })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Sexo */}
                <td className="px-3 py-2 min-w-[150px]">
                  <select
                    value={(r.sex ?? '') as any}
                    onChange={(e) => {
                      const v = (e.target.value || null) as any;
                      setRowValue(r.id, 'sex', v);
                      void saveCell(r.id, { sex: v });
                    }}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  >
                    <option value="">—</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </td>

                {/* Estado */}
                <td className="px-3 py-2 min-w-[140px]">
                  <select
                    value={(r.status ?? 'activo') as any}
                    onChange={(e) => {
                      const v = e.target.value as any;
                      setRowValue(r.id, 'status', v);
                      void saveCell(r.id, { status: v });
                    }}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </td>

                {/* Fecha inicio */}
                <td className="px-3 py-2 min-w-[160px]">
                  <input
                    type="date"
                    value={(r.startDate ?? '').slice(0, 10)}
                    onChange={(e) => setRowValue(r.id, 'startDate', e.target.value)}
                    onBlur={() => saveCell(r.id, { startDate: (r.startDate ?? '').slice(0, 10) })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Fecha cierre */}
                <td className="px-3 py-2 min-w-[160px]">
                  <input
                    type="date"
                    value={(r.closeDate ?? '').slice(0, 10)}
                    onChange={(e) => setRowValue(r.id, 'closeDate', e.target.value)}
                    onBlur={() => saveCell(r.id, { closeDate: (r.closeDate ?? '').slice(0, 10) })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* País */}
                <td className="px-3 py-2 min-w-[140px]">
                  <input
                    value={r.country ?? ''}
                    onChange={(e) => setRowValue(r.id, 'country', e.target.value)}
                    onBlur={() => saveCell(r.id, { country: r.country ?? '' })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Ciudad */}
                <td className="px-3 py-2 min-w-[140px]">
                  <input
                    value={r.city ?? ''}
                    onChange={(e) => setRowValue(r.id, 'city', e.target.value)}
                    onBlur={() => saveCell(r.id, { city: r.city ?? '' })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Birth */}
                <td className="px-3 py-2 min-w-[140px]">
                  <input
                    type="date"
                    value={(r.birthDate ?? '1900-01-01').slice(0, 10)}
                    onChange={(e) => setRowValue(r.id, 'birthDate', e.target.value)}
                    onBlur={() => saveCell(r.id, { birthDate: (r.birthDate ?? '1900-01-01').slice(0, 10) })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Cómo llegó */}
                <td className="px-3 py-2 min-w-[180px]">
                  <input
                    value={r.howArrived ?? ''}
                    onChange={(e) => setRowValue(r.id, 'howArrived', e.target.value)}
                    onBlur={() => saveCell(r.id, { howArrived: r.howArrived ?? '' })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Detalle */}
                <td className="px-3 py-2 min-w-[260px]">
                  <input
                    value={r.detail ?? ''}
                    onChange={(e) => setRowValue(r.id, 'detail', e.target.value)}
                    onBlur={() => saveCell(r.id, { detail: r.detail ?? '' })}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  />
                </td>

                {/* Tipo */}
                <td className="px-3 py-2 min-w-[120px]">
                  <select
                    value={(r.type ?? 'PSY') as any}
                    onChange={(e) => {
                      const v = e.target.value as any;
                      setRowValue(r.id, 'type', v);
                      void saveCell(r.id, { type: v });
                    }}
                    className="w-full bg-transparent border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"
                  >
                    <option value="PSY">Psicología</option>
                    <option value="MED">Medicina</option>
                  </select>
                </td>

                <td className="px-3 py-2 min-w-[140px]">
                  <a
                    href={`/patient/${r.id}`}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    Abrir
                  </a>
                  {savingId === r.id ? <span className="ml-2 text-xs text-slate-400">Guardando…</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExcelImportButton({ onImported }: { onImported: (report: any) => void }) {
  const [isImporting, setIsImporting] = useState(false);
  return (
    <label
      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
      title="Importar pacientes desde Excel (.xlsx)"
    >
      <Upload className="w-4 h-4" />
      {isImporting ? 'Importando…' : 'Importar Excel'}
      <input
        type="file"
        className="hidden"
        accept=".xlsx,.xls"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setIsImporting(true);
          try {
            const fd = new FormData();
            fd.append('file', f);
            const report = await importPatientsFromExcel(fd);
            onImported(report);
          } catch (err: any) {
            toast.error(err?.message || 'No se pudo importar');
          } finally {
            setIsImporting(false);
            e.currentTarget.value = '';
          }
        }}
      />
    </label>
  );
}
