'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { AppointmentsModal, type ApptItem } from '@/components/AppointmentsModal';

function localDayKey(d = new Date()) {
  // YYYY-MM-DD in the user's local timezone.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function NotificationsBell({
  todayItems,
  weekItems,
}: {
  todayItems: ApptItem[];
  weekItems: ApptItem[];
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'today' | 'week'>('today');

  // "Visto" por día: si el usuario abre el modal, quitamos el badge para el día actual,
  // pero NO borramos las notificaciones (siguen dentro del modal).
  const storageKey = 'psycloud.notifications.seenDay';
  const [seenDay, setSeenDay] = useState<string | null>(null);
  useEffect(() => {
    try {
      setSeenDay(localStorage.getItem(storageKey));
    } catch {
      // ignore
    }
  }, []);

  const markSeenToday = () => {
    const k = localDayKey();
    setSeenDay(k);
    try {
      localStorage.setItem(storageKey, k);
    } catch {
      // ignore
    }
  };

  const badge = useMemo(() => {
    // If user already opened notifications today, hide the badge.
    if (seenDay === localDayKey()) return 0;
    const now = Date.now();
    // notificaciones útiles: próximas en las siguientes 24h (o hoy, si prefieres)
    const upcoming = (weekItems ?? []).filter((a) => {
      const t = new Date(a.startIso).getTime();
      return !Number.isNaN(t) && t >= now;
    });
    return upcoming.length;
  }, [weekItems, seenDay]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setView('today');
          markSeenToday();
          setOpen(true);
        }}
        className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200"
        title="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      <AppointmentsModal
        isOpen={open}
        onClose={() => {
          markSeenToday();
          setOpen(false);
        }}
        title={view === 'today' ? 'Citas hoy' : 'Citas esta semana'}
        headerRight={
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <button
              type="button"
              onClick={() => setView('today')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                view === 'today'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setView('week')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                view === 'week'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
              }`}
            >
              Semana
            </button>
          </div>
        }
        items={view === 'today' ? todayItems : weekItems}
      />
    </>
  );
}
