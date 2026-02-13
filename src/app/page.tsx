
import { db } from '@/db';
import { appointments, clinicalSessions, patients } from '@/db/schema';
import { and, gte, lte, sql } from 'drizzle-orm';
import { PatientSearch } from '@/components/PatientSearch';
import { CreatePatientModal } from '@/components/CreatePatientModal';
import { HeaderToggles } from '@/components/HeaderToggles';
import { ClockAlerts } from '@/components/ClockAlerts';
import { NotificationsBell } from '@/components/NotificationsBell';
import { MetricsAppointmentsCard } from '@/components/MetricsAppointmentsCard';
import { requireSession, canSeeLegacy } from '@/lib/serverAuth';
import { UserMenu } from '@/components/UserMenu'; 
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const allowLegacy = canSeeLegacy(session);
  const uid = session.uid;
  const apptOwnerWhere = allowLegacy
    ? sql`(${appointments.userId} = ${uid} OR ${appointments.userId} IS NULL)`
    : sql`${appointments.userId} = ${uid}`;
  const patientOwnerWhere = allowLegacy
    ? sql`(${patients.userId} = ${uid} OR ${patients.userId} IS NULL)`
    : sql`${patients.userId} = ${uid}`;
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();

  const weekStart = startOfDay(new Date(now));
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  const weekEnd = endOfDay(new Date(weekStart));
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [todayCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointments)
    .where(and(
      gte(appointments.date, todayStart),
      lte(appointments.date, todayEnd),
      apptOwnerWhere
    ))
    .all();

  const [weekCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointments)
    .where(and(
      gte(appointments.date, weekStart.toISOString()),
      lte(appointments.date, weekEnd.toISOString()),
      apptOwnerWhere
    ))
    .all();

  const [patientCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(patients)
    .where(patientOwnerWhere)
    .all();

  // Citas de hoy (para reloj + alertas 15min inicio/fin)
  const todayAppointments = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      startIso: appointments.date,
      endIso: appointments.endAt,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      patientName: patients.fullName,
    })
    .from(appointments)
    .leftJoin(patients, sql`${patients.id} = ${appointments.patientId}`)
    .where(and(
      gte(appointments.date, todayStart),
      lte(appointments.date, todayEnd),
      apptOwnerWhere
    ))
    .all();

  // Citas de la semana (para tabla/notificaciones)
  const weekAppointments = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      startIso: appointments.date,
      endIso: appointments.endAt,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      patientName: patients.fullName,
    })
    .from(appointments)
    .leftJoin(patients, sql`${patients.id} = ${appointments.patientId}`)
    .where(and(
      gte(appointments.date, weekStart.toISOString()),
      lte(appointments.date, weekEnd.toISOString()),
      apptOwnerWhere
    ))
    .all();

  // Patients without future appointment
  const [noFutureRow] = (await (db as any).all(sql`
    SELECT count(*) as count
    FROM patients p
    WHERE p.id NOT IN (
      SELECT a.patient_id FROM appointments a
      WHERE a.date >= ${now.toISOString()} AND a.status != 'cancelled'
    )
    AND (p.user_id = ${session.uid} OR (p.user_id IS NULL AND ${allowLegacy ? 1 : 0}))
  `)) as any[];

  const metrics = {
    today: todayCountRow?.count ?? 0,
    week: weekCountRow?.count ?? 0,
    patients: patientCountRow?.count ?? 0,
    noFuture: noFutureRow?.count ?? 0,
    noStructured: 0,
  };


  // Appointments marked as done but without a structured clinical session linked
  const [noStructuredRow] = (await (db as any).all(sql`
    SELECT count(*) as count
    FROM appointments a
    LEFT JOIN clinical_sessions cs ON cs.appointment_id = a.id
    WHERE a.status = 'done' AND cs.id IS NULL
      AND (a.user_id = ${session.uid} OR (a.user_id IS NULL AND ${allowLegacy ? 1 : 0}))
  `)) as any[];

  metrics.noStructured = noStructuredRow?.count ?? 0;

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">PsyCloud</h1>
            <p className="text-slate-500 dark:text-slate-400">Organizador clínico</p>
          </div>

          <div className="flex items-center gap-3">
            <HeaderToggles />
            <a
              href="/control"
              className="hidden md:inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              📊 Control
            </a>
            <a
              href="/finance"
              className="hidden md:inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              💰 Finanzas
            </a>
            <NotificationsBell todayItems={todayAppointments as any} weekItems={weekAppointments as any} />
            <ClockAlerts
              todayCount={metrics.today}
              appointments={todayAppointments as any}
            />
            <CreatePatientModal />
            {session?.email ? <UserMenu email={session.email} /> : null}
          </div>
        </header>

        {/* SaaS Dashboard 30/70 */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* Left: search + results */}
          <div className="lg:col-span-3">
            <PatientSearch />
          </div>

          {/* Right: agenda + calendar + metrics */}
          <div className="lg:col-span-7 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsAppointmentsCard
                title="📅 Citas hoy"
                value={metrics.today}
                modalTitle="Citas hoy"
                items={todayAppointments as any}
              />
              <MetricsAppointmentsCard
                title="📆 Esta semana"
                value={metrics.week}
                modalTitle="Citas esta semana"
                items={weekAppointments as any}
              />
              <MetricCard title="📝 Sesiones sin nota" value={metrics.noStructured} />
              <MetricCard title="⚠ Pacientes sin próxima cita" value={metrics.noFuture} />
            </div>

            <DashboardClient />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="pc-card">
      <div className="text-[13px] font-medium" style={{ color: 'var(--pc-muted)' }}>{title}</div>
      <div className="text-[28px] font-semibold mt-2 leading-none">{value}</div>
    </div>
  );
}