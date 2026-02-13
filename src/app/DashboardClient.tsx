'use client';

import dynamic from 'next/dynamic';

const CalendarBoard = dynamic(
  () => import('@/components/CalendarBoard').then((m) => m.CalendarBoard),
  {
    ssr: false,
    loading: () => <div className="pc-card">Cargando calendario…</div>,
  }
);

const AppointmentManager = dynamic(
  () => import('@/components/AppointmentManager').then((m) => m.AppointmentManager),
  {
    ssr: false,
    loading: () => <div className="pc-card">Cargando agenda…</div>,
  }
);

export function DashboardClient() {
  return (
    <>
      <AppointmentManager />
      <CalendarBoard />
    </>
  );
}
