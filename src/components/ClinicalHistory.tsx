'use client';

import { useMemo, useState } from 'react';
import { createClinicalSession, deleteClinicalSession, updateClinicalSession } from '@/app/actions';
import { toast } from 'sonner';

type SessionType = 'evaluacion' | 'seguimiento' | 'crisis' | 'alta';

export type ClinicalSessionDTO = {
  id: string;
  patientId: string;
  appointmentId: string | null;
  sessionAt: string;
  sessionType: SessionType;
  focus: string;
  subjective: string;
  evaluation: string;
  plan: string;
  createdAt: string;
};

export type AppointmentOpt = { id: string; date: string; status: string; notes?: string | null };

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
}

function typeLabel(t: SessionType) {
  return t === 'evaluacion'
    ? 'Evaluación'
    : t === 'seguimiento'
      ? 'Seguimiento'
      : t === 'crisis'
        ? 'Crisis'
        : 'Alta';
}

export function ClinicalHistory({
  patientId,
  initialSessions,
  appointmentOpts,
}: {
  patientId: string;
  initialSessions: ClinicalSessionDTO[];
  appointmentOpts: AppointmentOpt[];
}) {
  const [sessions, setSessions] = useState<ClinicalSessionDTO[]>(initialSessions ?? []);
  const [openId, setOpenId] = useState<string | null>(sessions[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    sessionAt: new Date().toISOString().slice(0, 10),
    sessionType: 'seguimiento' as SessionType,
    appointmentId: '' as string,
    focus: '',
    subjective: '',
    evaluation: '',
    plan: '',
  });

  const sorted = useMemo(() => {
    return [...sessions].sort((a, b) => new Date(b.sessionAt).getTime() - new Date(a.sessionAt).getTime());
  }, [sessions]);

  async function onCreate() {
    if (!form.focus.trim()) {
      toast.error('Escribe el motivo / enfoque');
      return;
    }
    setSaving(true);
    try {
      const res = await createClinicalSession({
        patientId,
        appointmentId: form.appointmentId ? form.appointmentId : null,
        sessionAtIso: new Date(`${form.sessionAt}T12:00:00`).toISOString(),
        sessionType: form.sessionType,
        focus: form.focus,
        subjective: form.subjective,
        evaluation: form.evaluation,
        plan: form.plan,
      });
      if (!res.success) throw new Error((res as any).error || 'No se pudo guardar');
      toast.success('Sesión guardada');

      // Refresh: optimistic add minimal (server will revalidate, but we keep UI smooth)
      setSessions((prev) => [
        {
          id: `tmp-${Date.now()}`,
          patientId,
          appointmentId: form.appointmentId ? form.appointmentId : null,
          sessionAt: new Date(`${form.sessionAt}T12:00:00`).toISOString(),
          sessionType: form.sessionType,
          focus: form.focus,
          subjective: form.subjective,
          evaluation: form.evaluation,
          plan: form.plan,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setCreating(false);
      setOpenId(null);
      setForm((f) => ({ ...f, focus: '', subjective: '', evaluation: '', plan: '' }));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate(id: string, patch: Partial<ClinicalSessionDTO>) {
    setSaving(true);
    try {
      const res = await updateClinicalSession({ id, patientId, ...patch } as any);
      if (!res.success) throw new Error((res as any).error || 'No se pudo actualizar');
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } as any : s)));
      toast.success('Actualizado');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo actualizar');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    const ok = window.confirm('¿Eliminar esta sesión clínica?');
    if (!ok) return;
    setSaving(true);
    try {
      const res = await deleteClinicalSession({ id, patientId });
      if (!res.success) throw new Error((res as any).error || 'No se pudo eliminar');
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Eliminada');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'No se pudo eliminar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Historia clínica</h2>
          <p className="text-xs text-slate-500 dark:text-slate-300">Línea de tiempo estructurada (10s para entender el caso)</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          {creating ? 'Cerrar' : '➕ Nueva sesión'}
        </button>
      </div>

      {creating ? (
        <div className="pc-card bg-white dark:bg-slate-950">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fecha</label>
              <input
                type="date"
                value={form.sessionAt}
                onChange={(e) => setForm((f) => ({ ...f, sessionAt: e.target.value }))}
                className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tipo de sesión</label>
              <select
                value={form.sessionType}
                onChange={(e) => setForm((f) => ({ ...f, sessionType: e.target.value as SessionType }))}
                className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              >
                <option value="evaluacion">Evaluación</option>
                <option value="seguimiento">Seguimiento</option>
                <option value="crisis">Crisis</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vincular a cita (opcional)</label>
              <select
                value={form.appointmentId}
                onChange={(e) => setForm((f) => ({ ...f, appointmentId: e.target.value }))}
                className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              >
                <option value="">Sin vínculo</option>
                {appointmentOpts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {fmtDate(a.date)} · {a.status}
                    {a.notes ? ` · ${a.notes}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Motivo o enfoque del día</label>
            <input
              value={form.focus}
              onChange={(e) => setForm((f) => ({ ...f, focus: e.target.value }))}
              placeholder="Ej: evaluación inicial / seguimiento de ansiedad"
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <Field label="Desarrollo / Subjetivo" value={form.subjective} onChange={(v) => setForm((f) => ({ ...f, subjective: v }))} />
            <Field label="Evaluación clínica" value={form.evaluation} onChange={(v) => setForm((f) => ({ ...f, evaluation: v }))} />
          </div>
          <div className="mt-3">
            <Field label="Plan o tareas asignadas" value={form.plan} onChange={(v) => setForm((f) => ({ ...f, plan: v }))} rows={3} />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onCreate}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Guardar sesión
            </button>
          </div>
        </div>
      ) : null}

      {/* Timeline */}
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-300">Aún no hay sesiones registradas.</div>
        ) : null}

        {sorted.map((s) => {
          const isOpen = openId === s.id;
          return (
            <div key={s.id} className="bg-white dark:bg-slate-950 overflow-hidden rounded-xl" style={{ boxShadow: 'var(--pc-card-shadow)' }}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : s.id)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {fmtDate(s.sessionAt)} · {typeLabel(s.sessionType)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-300 truncate">{s.focus}</div>
                </div>
                <div className="text-xs text-slate-400">{isOpen ? '▲' : '▼'}</div>
              </button>

              {isOpen ? (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <SmallTextArea
                      label="Desarrollo / Subjetivo"
                      defaultValue={s.subjective}
                      onBlur={(v) => onUpdate(s.id, { subjective: v })}
                    />
                    <SmallTextArea
                      label="Evaluación clínica"
                      defaultValue={s.evaluation}
                      onBlur={(v) => onUpdate(s.id, { evaluation: v })}
                    />
                  </div>
                  <div className="mt-3">
                    <SmallTextArea label="Plan / tareas" defaultValue={s.plan} rows={3} onBlur={(v) => onUpdate(s.id, { plan: v })} />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-300">
                      {s.appointmentId ? 'Vinculada a cita' : 'Sin vínculo a cita'}
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onDelete(s.id)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
      />
    </div>
  );
}

function SmallTextArea({
  label,
  defaultValue,
  onBlur,
  rows = 4,
}: {
  label: string;
  defaultValue: string;
  onBlur: (v: string) => void;
  rows?: number;
}) {
  const [v, setV] = useState(defaultValue ?? '');
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onBlur(v)}
        rows={rows}
        className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
      />
    </div>
  );
}
