
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateSelectArg, EventClickArg, EventDropArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import { toast } from 'sonner';
import { X, Settings, Loader2 } from 'lucide-react';

import {
  autocompletePatients,
  createAppointmentPro,
  deleteAppointment,
  listAppointmentsInRange,
  updateAppointmentDetails,
  updateAppointmentTime,
} from '@/app/actions';
import { useI18n } from '@/lib/i18n';

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

function addMinutes(iso: string, minutes: number) {
  const d = new Date(iso);
  return new Date(d.getTime() + minutes * 60_000).toISOString();
}

type CalendarSettings = {
  workStart: string; // "08:00:00"
  workEnd: string;   // "20:00:00"
  allowOverlap: boolean;
};

const DEFAULT_SETTINGS: CalendarSettings = {
  workStart: '08:00:00',
  workEnd: '20:00:00',
  allowOverlap: false,
};

function loadSettings(): CalendarSettings {
  try {
    const raw = localStorage.getItem('psycloud:calendarSettings');
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      workStart: typeof parsed.workStart === 'string' ? parsed.workStart : DEFAULT_SETTINGS.workStart,
      workEnd: typeof parsed.workEnd === 'string' ? parsed.workEnd : DEFAULT_SETTINGS.workEnd,
      allowOverlap: !!parsed.allowOverlap,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: CalendarSettings) {
  try {
    localStorage.setItem('psycloud:calendarSettings', JSON.stringify(s));
  } catch {}
}

export function CalendarBoard() {
  const { t, lang } = useI18n();

  const viewButtonText = useMemo(() => ({
    dayGridMonth: t('calendar.month'),
    timeGridWeek: t('calendar.week'),
    timeGridDay:  t('calendar.day'),
  }), [lang]);

  const [range, setRange] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    const end = new Date(now);
    end.setDate(end.getDate() + 14);
    return { start: start.toISOString(), end: end.toISOString() };
  });

  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [patientQuery, setPatientQuery] = useState('');
  const [patientOptions, setPatientOptions] = useState<Array<{ id: string; fullName: string }>>([]);
  const [patientId, setPatientId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');

  const [startIso, setStartIso] = useState<string>('');
  const [endIso, setEndIso] = useState<string>('');
  const [status, setStatus] = useState<'pending' | 'done' | 'cancelled'>('pending');
  const [notes, setNotes] = useState<string>('');

  // Payments
  const [feeCOP, setFeeCOP] = useState<number>(120000);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [paymentMethod, setPaymentMethod] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const debounceRef = useRef<any>(null);

  // Settings init
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    try {
      const rawFee = localStorage.getItem('psycloud:defaultFeeCOP');
      if (rawFee) {
        const n = Number(rawFee);
        if (!Number.isNaN(n) && n >= 0) setFeeCOP(n);
      }
    } catch {}
  }, []);

  async function load() {
    setLoading(true);
    try {
      const rows = await listAppointmentsInRange(range.start, range.end);
      setAppts(rows as any);
    } catch {
      toast.error('No se pudieron cargar las citas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  // Reliable refresh
  useEffect(() => {
    const onChange = () => load();
    window.addEventListener('psycloud:apptChanged', onChange);
    return () => window.removeEventListener('psycloud:apptChanged', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const events = useMemo(() => {
    return appts
      .filter((a) => a.status !== 'cancelled')
      .map((a) => ({
        id: a.id,
        title: a.patientName,
        start: a.date,
        end: a.endAt ?? addMinutes(a.date, 60),
        classNames: a.status === 'done' ? ['opacity-70'] : [],
        extendedProps: {
          patientId: a.patientId,
          patientName: a.patientName,
          notes: a.notes ?? '',
          status: a.status,
          feeCents: a.feeCents ?? 0,
          paymentStatus: a.paymentStatus ?? 'pending',
          paymentMethod: a.paymentMethod ?? null,
        },
      }));
  }, [appts]);

  // Patient autocomplete (modal)
  useEffect(() => {
    if (!modalOpen) return;
    const q = patientQuery.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q) {
        setPatientOptions([]);
        return;
      }
      setLoadingPatients(true);
      try {
        const rows = await autocompletePatients({ q, limit: 10 });
        setPatientOptions(rows.map((r: any) => ({ id: r.id, fullName: r.fullName })));
      } catch {
        // ignore
      } finally {
        setLoadingPatients(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [patientQuery, modalOpen]);

  function openCreate(start: Date, end: Date) {
    setModalMode('create');
    setEditingId(null);
    setPatientId('');
    setPatientName('');
    setPatientQuery('');
    setPatientOptions([]);
    setStatus('pending');
    setNotes('');
    setPaymentStatus('pending');
    setPaymentMethod('');
    setStartIso(start.toISOString());
    setEndIso(end.toISOString());
    setModalOpen(true);
  }

  function openEdit(ev: any) {
    setModalMode('edit');
    setEditingId(ev.id);
    setPatientId(ev.extendedProps.patientId);
    setPatientName(ev.extendedProps.patientName ?? ev.title);
    setPatientQuery(ev.extendedProps.patientName ?? ev.title);
    setPatientOptions([]);
    setStatus((ev.extendedProps.status ?? 'pending') as any);
    setNotes(ev.extendedProps.notes ?? '');
    setFeeCOP(Math.round(((ev.extendedProps.feeCents ?? 0) as number) / 100));
    setPaymentStatus((ev.extendedProps.paymentStatus ?? 'pending') as any);
    setPaymentMethod(ev.extendedProps.paymentMethod ?? '');
    setStartIso(ev.start.toISOString());
    setEndIso((ev.end ?? ev.start).toISOString());
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function onSaveModal() {
    if (!patientId) {
      toast.error(lang === 'en' ? 'Select a patient' : 'Selecciona un paciente');
      return;
    }
    const s = new Date(startIso);
    const e = new Date(endIso);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) {
      toast.error(lang === 'en' ? 'Invalid time range' : 'Rango inválido');
      return;
    }

    setSaving(true);

    // Optimistic update
    const optimisticId = modalMode === 'create' ? `tmp-${Date.now()}` : (editingId ?? '');
    const optimistic: Appt = {
      id: optimisticId,
      patientId,
      patientName: patientName || patientQuery || 'Paciente',
      date: s.toISOString(),
      endAt: e.toISOString(),
      status,
      notes,
      feeCents: Math.max(0, Math.round(feeCOP)) * 100,
      paymentStatus,
      paymentMethod: paymentMethod || null,
    };

    setAppts((prev) => {
      if (modalMode === 'create') return [optimistic, ...prev];
      return prev.map((a) => (a.id === optimisticId ? optimistic : a)).map((a) => (a.id === editingId ? optimistic : a));
    });

    try {
      if (modalMode === 'create') {
        const res = await createAppointmentPro({
          patientId,
          startIso: s.toISOString(),
          endIso: e.toISOString(),
          notes,
          status,
          allowOverlap: settings.allowOverlap,
          feeCents: Math.max(0, Math.round(feeCOP)) * 100,
          paymentStatus,
          paymentMethod: paymentMethod || undefined,
        });
        if (!res.success) {
          toast.error(res.error || t('calendar.warnOverlap'));
          await load();
          return;
        }
        toast.success(t('calendar.created'));
      } else {
        const res = await updateAppointmentDetails({
          id: editingId!,
          patientId,
          startIso: s.toISOString(),
          endIso: e.toISOString(),
          notes,
          status,
          allowOverlap: settings.allowOverlap,
          feeCents: Math.max(0, Math.round(feeCOP)) * 100,
          paymentStatus,
          paymentMethod: paymentMethod || undefined,
        });
        if (!res.success) {
          toast.error(res.error || t('calendar.warnOverlap'));
          await load();
          return;
        }
        toast.success(t('calendar.updated'));
      }

      try {
        localStorage.setItem('psycloud:defaultFeeCOP', String(Math.max(0, Math.round(feeCOP))));
      } catch {}

      closeModal();
      await load();
      window.dispatchEvent(new Event('psycloud:apptChanged'));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteModal() {
    if (!editingId) return;
    const ok = window.confirm(lang === 'en' ? 'Delete this appointment?' : '¿Eliminar esta cita?');
    if (!ok) return;

    const prev = appts;
    setAppts((p) => p.filter((x) => x.id !== editingId));

    const res = await deleteAppointment(editingId);
    if (!res.success) {
      toast.error(res.error || 'No se pudo eliminar');
      setAppts(prev);
      return;
    }
    toast.success(t('calendar.deleted'));
    closeModal();
    await load();
    window.dispatchEvent(new Event('psycloud:apptChanged'));
  }

  const calendarHeight = 540; // max-height ~500-550 for dashboard

  return (
    <div className="pc-card bg-white dark:bg-slate-900">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <h3 className="text-base font-semibold">{t('calendar.title')}</h3>
          <p className="text-[13px]" style={{ color: 'var(--pc-muted)' }}>{t('calendar.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {t('calendar.settings')}
          </button>
          {loading ? <span className="text-xs text-slate-400">{t('common.loading')}</span> : null}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden bg-white dark:bg-slate-950 max-h-[550px] overflow-y-auto">
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          views={{
            dayGridMonth: { buttonText: viewButtonText.dayGridMonth },
            timeGridWeek: { buttonText: viewButtonText.timeGridWeek },
            timeGridDay: { buttonText: viewButtonText.timeGridDay },
          }}
          buttonText={{ today: t('calendar.today') }}
          height={calendarHeight}
          locale={lang === 'en' ? 'en' : 'es'}
          slotMinTime={settings.workStart}
          slotMaxTime={settings.workEnd}
          slotDuration="00:30:00"
          expandRows
          stickyHeaderDates
          slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: false }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
          allDaySlot={false}
          nowIndicator
          editable
          selectable
          selectMirror
          eventResizableFromStart
          eventDisplay="block"
          eventContent={(arg) => {
            const ps = (arg.event.extendedProps as any)?.paymentStatus as 'paid' | 'pending' | undefined;
            const label = ps === 'paid' ? t('calendar.paid') : t('calendar.pending');
            return (
              <div className="px-1 py-0.5">
                <div className="text-[11px] font-semibold leading-4 truncate">{arg.event.title}</div>
                <div className="mt-0.5">
                  <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-200">
                    {label}
                  </span>
                </div>
              </div>
            );
          }}
          events={events}
          datesSet={(arg) => setRange({ start: arg.start.toISOString(), end: arg.end.toISOString() })}
          select={(arg: DateSelectArg) => {
            openCreate(arg.start, arg.end);
          }}
          eventDrop={async (arg: EventDropArg) => {
            const id = arg.event.id;
            const start = arg.event.start;
            const end = arg.event.end;
            if (!start || !end) return;

            // optimistic already applied by FullCalendar, just validate + re-fetch
            const res = await updateAppointmentTime({
              id,
              startIso: start.toISOString(),
              endIso: end.toISOString(),
              allowOverlap: settings.allowOverlap,
            });
            if (!res.success) {
              arg.revert();
              toast.error(res.error || t('calendar.warnOverlap'));
            } else {
              toast.success(t('calendar.updated'));
              await load();
              window.dispatchEvent(new Event('psycloud:apptChanged'));
            }
          }}
          eventResize={async (arg: EventResizeDoneArg) => {
            const id = arg.event.id;
            const start = arg.event.start;
            const end = arg.event.end;
            if (!start || !end) return;

            const res = await updateAppointmentTime({
              id,
              startIso: start.toISOString(),
              endIso: end.toISOString(),
              allowOverlap: settings.allowOverlap,
            });
            if (!res.success) {
              arg.revert();
              toast.error(res.error || t('calendar.warnOverlap'));
            } else {
              toast.success(t('calendar.updated'));
              await load();
              window.dispatchEvent(new Event('psycloud:apptChanged'));
            }
          }}
          eventClick={(arg: EventClickArg) => {
            openEdit(arg.event);
          }}
        />
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-slate-800 dark:text-slate-100">{t('calendar.settings')}</div>
              <button type="button" onClick={() => setSettingsOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('calendar.workHours')}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={settings.workStart.slice(0, 5)}
                    onChange={(e) => setSettings((s) => ({ ...s, workStart: `${e.target.value}:00` }))}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
                  />
                  <input
                    type="time"
                    value={settings.workEnd.slice(0, 5)}
                    onChange={(e) => setSettings((s) => ({ ...s, workEnd: `${e.target.value}:00` }))}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={settings.allowOverlap}
                  onChange={(e) => setSettings((s) => ({ ...s, allowOverlap: e.target.checked }))}
                />
                {t('calendar.allowOverlap')}
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  saveSettings(settings);
                  setSettingsOpen(false);
                  toast.success(t('calendar.settingsSaved'));
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-slate-800 dark:text-slate-100">
                {modalMode === 'create' ? (lang === 'en' ? 'New appointment' : 'Nueva cita') : (lang === 'en' ? 'Edit appointment' : 'Editar cita')}
              </div>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Paciente</div>
                <div className="relative">
                  <input
                    value={patientQuery}
                    onChange={(e) => {
                      setPatientQuery(e.target.value);
                      setPatientId('');
                      setPatientName('');
                    }}
                    placeholder="Buscar…"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  />
                  {loadingPatients && (
                    <div className="absolute right-2 top-2.5 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>

                {patientOptions.length > 0 && !patientId && (
                  <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {patientOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPatientId(p.id);
                          setPatientName(p.fullName);
                          setPatientQuery(p.fullName);
                          setPatientOptions([]);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900 text-sm"
                      >
                        {p.fullName}
                      </button>
                    ))}
                  </div>
                )}

                {patientId ? (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">ID: {patientId}</div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Inicio</div>
                  <input
                    type="datetime-local"
                    value={new Date(startIso).toISOString().slice(0, 16)}
                    onChange={(e) => setStartIso(new Date(e.target.value).toISOString())}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Fin</div>
                  <input
                    type="datetime-local"
                    value={new Date(endIso).toISOString().slice(0, 16)}
                    onChange={(e) => setEndIso(new Date(e.target.value).toISOString())}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Estado</div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
                  >
                    <option value="pending">{lang === 'en' ? 'Pending' : 'Pendiente'}</option>
                    <option value="done">{lang === 'en' ? 'Done' : 'Realizada'}</option>
                    <option value="cancelled">{lang === 'en' ? 'Cancelled' : 'Cancelada'}</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Duración</div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950">
                    {Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000)} min
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Valor (COP)</div>
                  <input
                    value={feeCOP}
                    onChange={(e) => setFeeCOP(Number(e.target.value || 0))}
                    inputMode="numeric"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Pago</div>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="paid">Pagado</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Método</div>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  >
                    <option value="">—</option>
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Motivo / notas</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full min-h-[80px] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                />
              </div>

              {!settings.allowOverlap && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'en'
                    ? 'Overlaps are blocked. You can enable them in Settings.'
                    : 'Esta hora ya está ocupada. Elige otro horario o reprograma la cita existente. (Puedes permitir solapamientos en Ajustes)'}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                {modalMode === 'edit' ? (
                  <button
                    type="button"
                    onClick={onDeleteModal}
                    className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 text-sm font-semibold"
                  >
                    {t('common.delete')}
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={onSaveModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}