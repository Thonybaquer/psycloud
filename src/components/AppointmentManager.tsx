
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createAppointmentPro, getUpcomingAppointments, autocompletePatients } from '@/app/actions';
import { Calendar, Clock, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

type PatientOpt = { id: string; fullName: string };
type Appt = {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  endAt?: string | null;
  status: string;
  notes?: string | null;
  feeCents?: number;
  paymentStatus?: 'pending' | 'paid';
  paymentMethod?: string | null;
};

function formatTime(iso: string, lang: 'es' | 'en') {
  const d = new Date(iso);
  return d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' });
}

function addMinutes(iso: string, minutes: number) {
  const d = new Date(iso);
  return new Date(d.getTime() + minutes * 60_000).toISOString();
}

export function AppointmentManager() {
  const { t, lang } = useI18n();

  const [upcoming, setUpcoming] = useState<Appt[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [motivo, setMotivo] = useState('');

  // Payments
  const [feeCOP, setFeeCOP] = useState<number>(120000);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [paymentMethod, setPaymentMethod] = useState<string>('');

  const [patientQuery, setPatientQuery] = useState('');
  const [patientOpts, setPatientOpts] = useState<PatientOpt[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientOpt | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Settings shared with CalendarBoard
  const [allowOverlap, setAllowOverlap] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('psycloud:calendarSettings');
      if (raw) {
        const parsed = JSON.parse(raw);
        setAllowOverlap(!!parsed.allowOverlap);
      }
      const rawFee = localStorage.getItem('psycloud:defaultFeeCOP');
      if (rawFee) {
        const n = Number(rawFee);
        if (!Number.isNaN(n) && n >= 0) setFeeCOP(n);
      }
    } catch {}
  }, []);

  async function refreshUpcoming() {
    try {
      const list = await getUpcomingAppointments();
      setUpcoming(list as any);
    } catch {
      // noop
    }
  }

  useEffect(() => {
    refreshUpcoming();
  }, []);

  useEffect(() => {
    // Defaults (evita citas raras)
    if (!date) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setDate(`${yyyy}-${mm}-${dd}`);
    }
    if (!time) setTime('09:00');
  }, [date, time]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('psycloud:lastFeeCOP');
      if (raw) setFeeCOP(Math.max(0, Number(raw) || 0));
    } catch {}
  }, []);

  // Autocomplete patients
  useEffect(() => {
    const q = patientQuery.trim();
    const tmr = setTimeout(async () => {
      if (!q) {
        setPatientOpts([]);
        return;
      }
      setLoadingPatients(true);
      try {
        const rows = await autocompletePatients({ q, limit: 10 });
        setPatientOpts(rows.map((r: any) => ({ id: r.id, fullName: r.fullName })));
        setDropdownOpen(true);
      } catch {
        // ignore
      } finally {
        setLoadingPatients(false);
      }
    }, 250);

    return () => clearTimeout(tmr);
  }, [patientQuery]);

  const canCreate = useMemo(() => {
    return !!selectedPatient && !!date && !!time;
  }, [selectedPatient, date, time]);

  const onCreate = async () => {
    if (!canCreate || !selectedPatient) return;

    const startIso = new Date(`${date}T${time}:00`).toISOString();
    const endIso = addMinutes(startIso, durationMinutes);

    const res = await createAppointmentPro({
      patientId: selectedPatient.id,
      startIso,
      endIso,
      notes: motivo || undefined,
      status: 'pending',
      allowOverlap,
      feeCents: Math.max(0, Math.round(feeCOP)) * 100,
      paymentStatus,
      paymentMethod: paymentMethod || undefined,
    });

    if (!res.success) {
      toast.error(res.error || 'No se pudo crear la cita');
      return;
    }

    toast.success(t('calendar.created'));
    setMotivo('');
    try {
      localStorage.setItem('psycloud:defaultFeeCOP', String(Math.max(0, Math.round(feeCOP))));
    } catch {}
    refreshUpcoming();
    window.dispatchEvent(new Event('psycloud:apptChanged'));
  };

  return (
    <div className="pc-card bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Agenda rápida</h3>
          <p className="text-[13px]" style={{ color: 'var(--pc-muted)' }}>Crear en segundos · luego ajusta en el calendario</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 relative">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Paciente</label>
          <div className="relative mt-1">
            <input
              ref={inputRef}
              value={selectedPatient ? selectedPatient.fullName : patientQuery}
              onChange={(e) => {
                setSelectedPatient(null);
                setPatientQuery(e.target.value);
              }}
              onFocus={() => patientOpts.length > 0 && setDropdownOpen(true)}
              placeholder="Buscar…"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {loadingPatients && (
              <div className="absolute right-2 top-2.5 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
          </div>

          {dropdownOpen && patientOpts.length > 0 && !selectedPatient && (
            <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-lg overflow-hidden">
              {patientOpts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelectedPatient(p);
                    setPatientQuery('');
                    setDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
                >
                  {p.fullName}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Hora
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Motivo / notas</label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: sesión de seguimiento"
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Duración</label>
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={onCreate}
            disabled={!canCreate}
            className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40"
            type="button"
          >
            <Plus className="w-4 h-4" />
            Crear
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Valor (COP)</label>
          <input
            value={feeCOP}
            onChange={(e) => setFeeCOP(Number(e.target.value || 0))}
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pago</label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as any)}
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Método</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          >
            <option value="">—</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Próximas citas</div>
        <div className="space-y-2">
          {upcoming.length === 0 ? (
            <div className="text-sm text-slate-400 dark:text-slate-500 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
              Sin citas próximas
            </div>
          ) : (
            upcoming.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{a.patientName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(a.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES')} · {formatTime(a.date, lang)}
                  </div>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 font-semibold">
                  {a.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
