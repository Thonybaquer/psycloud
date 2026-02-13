'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export type ClockAppt = {
  id: string;
  patientId: string;
  startIso: string;
  endIso?: string | null;
  paymentStatus?: string | null; // pending | paid
  patientName?: string | null;
};

function fmtTime(d: Date, use12h: boolean) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: use12h });
}

function minutesDiff(fromMs: number, toMs: number) {
  return Math.round((toMs - fromMs) / 60000);
}

export function ClockAlerts({ todayCount, appointments, use12h = true }: { todayCount: number; appointments: ClockAppt[]; use12h?: boolean }) {
  const [now, setNow] = useState<Date>(new Date());

  const todays = useMemo(() => {
    const list = (appointments ?? [])
      .filter((a) => a?.startIso)
      .map((a) => {
        const start = new Date(a.startIso);
        const end = a.endIso ? new Date(a.endIso) : new Date(start.getTime() + 60 * 60 * 1000);
        return {
          ...a,
          start,
          end,
        };
      })
      .filter((a) => !Number.isNaN(a.start.getTime()) && !Number.isNaN(a.end.getTime()))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return list;
  }, [appointments]);

  // reloj
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Toast inicial con número de citas del día
  useEffect(() => {
    if (!todayCount) return;
    const key = `psycloud:todayToast:${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // ignore
    }
    toast.message(`Hoy tienes ${todayCount} cita${todayCount === 1 ? '' : 's'}.`);
  }, [todayCount]);

  // alertas antes de inicio (15/10/5) y antes de fin (15)
  useEffect(() => {
    if (!todays.length) return;

    const fireOncePerMinute = (key: string) => {
      try {
        const k = `psycloud:clock:${key}`;
        if (sessionStorage.getItem(k)) return false;
        sessionStorage.setItem(k, '1');
        // limpia mañana
        return true;
      } catch {
        return true;
      }
    };

    const tick = () => {
      const nowMs = Date.now();

      // Próxima cita
      const next = todays.find((a) => a.start.getTime() >= nowMs);
      if (next) {
        const minsToStart = minutesDiff(nowMs, next.start.getTime());
        if ([15, 10, 5].includes(minsToStart)) {
          const minuteKey = `${new Date().toDateString()}:${next.id}:start:${minsToStart}:${new Date().toISOString().slice(0, 16)}`;
          if (!fireOncePerMinute(minuteKey)) return;
          const paid = next.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente';
          toast.info(`En ${minsToStart} min inicia: ${next.patientName ?? 'Paciente'} (${fmtTime(next.start, use12h)}) · ${paid}`);
        }
      }

      // Cita en curso
      const current = todays.find((a) => nowMs >= a.start.getTime() && nowMs <= a.end.getTime());
      if (current) {
        const minsToEnd = minutesDiff(nowMs, current.end.getTime());
        if (minsToEnd === 15) {
          const minuteKey = `${new Date().toDateString()}:${current.id}:end:${minsToEnd}:${new Date().toISOString().slice(0, 16)}`;
          if (!fireOncePerMinute(minuteKey)) return;
          toast.warning(`Quedan 15 min para terminar: ${current.patientName ?? 'Paciente'} (fin ${fmtTime(current.end, use12h)})`);
        }
      }
    };

    // evita work innecesario: evalúa 1 vez por minuto
    let lastMinuteKey = '';
    const t = setInterval(() => {
      const k = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      if (k === lastMinuteKey) return;
      lastMinuteKey = k;
      tick();
    }, 1200);

    return () => clearInterval(t);
  }, [todays]);

  const nextInfo = useMemo(() => {
    const nowMs = now.getTime();
    const next = todays.find((a) => a.start.getTime() >= nowMs);
    if (!next) return null;
    const mins = minutesDiff(nowMs, next.start.getTime());
    const label = mins <= 0 ? 'Ahora' : `en ${mins} min`;
    return {
      label,
      name: next.patientName ?? 'Paciente',
      time: fmtTime(next.start, use12h),
      pay: next.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente',
    };
  }, [now, todays, use12h]);

  return (
    <div className="hidden md:flex items-center gap-3">
      <div className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur text-sm font-semibold text-slate-700 dark:text-slate-100">
        {fmtTime(now, use12h)}
      </div>
      {nextInfo && (
        <div className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur text-xs text-slate-600 dark:text-slate-200">
          Próxima: <span className="font-semibold">{nextInfo.name}</span> · {nextInfo.time} · {nextInfo.pay} · {nextInfo.label}
        </div>
      )}
    </div>
  );
}
