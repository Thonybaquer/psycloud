import { db } from '@/db';
import { appointments, patients } from '@/db/schema';
import { and, gte, lte, sql } from 'drizzle-orm';
import Link from 'next/link';
import { requireSession, canSeeLegacy } from '@/lib/serverAuth';
import { HeaderToggles } from '@/components/HeaderToggles';
import { NotificationsBell } from '@/components/NotificationsBell';
import { ClockAlerts } from '@/components/ClockAlerts';
import { UserMenu } from '@/components/UserMenu';
import { DashboardProClient } from '../DashboardProClient';

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
function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addMonths(d: Date, delta: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + delta);
  return x;
}

export default async function ControlPage() {
  const session = await requireSession();
  const allowLegacy = canSeeLegacy(session);
  const uid = session.uid;

  const allowLegacyFlag = allowLegacy ? 1 : 0;

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();

  const weekStart = startOfDay(new Date(now));
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  const weekEnd = endOfDay(new Date(weekStart));
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Used for notifications/alerts
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
      sql`(${appointments.userId} = ${uid} OR (${appointments.userId} IS NULL AND ${allowLegacyFlag}))`
    ))
    .all();

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
      sql`(${appointments.userId} = ${uid} OR (${appointments.userId} IS NULL AND ${allowLegacyFlag}))`
    ))
    .all();

  // -------------------------
  // Control KPIs (month)
  // "Nuevos" = pacientes registrados en el mes (createdAt)
  // "Recurrentes" = pacientes atendidos en el mes que fueron registrados antes del mes
  // -------------------------
  const monthStart = startOfMonth(now);
  const nextMonthStart = startOfMonth(addMonths(monthStart, 1));
  const prevMonthStart = startOfMonth(addMonths(monthStart, -1));

  // Revenue (paid appointments)
  const [revRow] = (await (db as any).all(sql`
    SELECT COALESCE(SUM(a.fee_cents), 0) AS cents
    FROM appointments a
    WHERE a.date >= ${monthStart.toISOString()} AND a.date < ${nextMonthStart.toISOString()}
      AND a.status != 'cancelled'
      AND a.payment_status = 'paid'
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
  `)) as any[];

  const [revPrevRow] = (await (db as any).all(sql`
    SELECT COALESCE(SUM(a.fee_cents), 0) AS cents
    FROM appointments a
    WHERE a.date >= ${prevMonthStart.toISOString()} AND a.date < ${monthStart.toISOString()}
      AND a.status != 'cancelled'
      AND a.payment_status = 'paid'
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
  `)) as any[];

  // Sessions (appointments not cancelled)
  const [sessionsRow] = (await (db as any).all(sql`
    SELECT COUNT(*) AS count
    FROM appointments a
    WHERE a.date >= ${monthStart.toISOString()} AND a.date < ${nextMonthStart.toISOString()}
      AND a.status != 'cancelled'
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
  `)) as any[];

  // Unique attended patients in month
  const [uniqueAttendedRow] = (await (db as any).all(sql`
    SELECT COUNT(DISTINCT a.patient_id) AS count
    FROM appointments a
    WHERE a.date >= ${monthStart.toISOString()} AND a.date < ${nextMonthStart.toISOString()}
      AND a.status != 'cancelled'
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
  `)) as any[];

  // New registrations in month (patient createdAt)
  const [newRegisteredRow] = (await (db as any).all(sql`
    SELECT COUNT(*) AS count
    FROM patients p
    WHERE p.created_at >= ${monthStart.toISOString()} AND p.created_at < ${nextMonthStart.toISOString()}
      AND (p.user_id = ${uid} OR (p.user_id IS NULL AND ${allowLegacyFlag}))
  `)) as any[];

  // Returning (attended) in month: patients with appointments in month AND created before month
  const [returningAttendedRow] = (await (db as any).all(sql`
    SELECT COUNT(DISTINCT a.patient_id) AS count
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.date >= ${monthStart.toISOString()} AND a.date < ${nextMonthStart.toISOString()}
      AND a.status != 'cancelled'
      AND p.created_at < ${monthStart.toISOString()}
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
      AND (p.user_id = ${uid} OR (p.user_id IS NULL AND ${allowLegacyFlag}))
  `)) as any[];

  // New attended (registered in same month and attended)
  const [newAttendedRow] = (await (db as any).all(sql`
    SELECT COUNT(DISTINCT a.patient_id) AS count
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.date >= ${monthStart.toISOString()} AND a.date < ${nextMonthStart.toISOString()}
      AND a.status != 'cancelled'
      AND p.created_at >= ${monthStart.toISOString()} AND p.created_at < ${nextMonthStart.toISOString()}
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
      AND (p.user_id = ${uid} OR (p.user_id IS NULL AND ${allowLegacyFlag}))
  `)) as any[];

  const monthKpis = {
    revenueCents: Number(revRow?.cents ?? 0) || 0,
    revenuePrevCents: Number(revPrevRow?.cents ?? 0) || 0,
    sessions: Number(sessionsRow?.count ?? 0) || 0,
    patientsUnique: Number(uniqueAttendedRow?.count ?? 0) || 0,
    patientsNew: Number(newRegisteredRow?.count ?? 0) || 0,
    patientsNewAttended: Number(newAttendedRow?.count ?? 0) || 0,
    patientsReturningAttended: Number(returningAttendedRow?.count ?? 0) || 0,
  };

  // 12-month series for charts
  const seriesStart = startOfMonth(addMonths(monthStart, -11));
  const seriesEnd = nextMonthStart;

  const revenueRows = (await (db as any).all(sql`
    SELECT strftime('%Y-%m', a.date) AS ym, COALESCE(SUM(a.fee_cents), 0) AS cents
    FROM appointments a
    WHERE a.date >= ${seriesStart.toISOString()} AND a.date < ${seriesEnd.toISOString()}
      AND a.status != 'cancelled'
      AND a.payment_status = 'paid'
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
    GROUP BY ym
    ORDER BY ym ASC
  `)) as any[];

  const uniqueRows = (await (db as any).all(sql`
    SELECT strftime('%Y-%m', a.date) AS ym, COUNT(DISTINCT a.patient_id) AS count
    FROM appointments a
    WHERE a.date >= ${seriesStart.toISOString()} AND a.date < ${seriesEnd.toISOString()}
      AND a.status != 'cancelled'
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
    GROUP BY ym
    ORDER BY ym ASC
  `)) as any[];

  // New attended per month: appointment month == patient created month
  const newAttendedRows = (await (db as any).all(sql`
    SELECT strftime('%Y-%m', a.date) AS ym, COUNT(DISTINCT a.patient_id) AS count
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.date >= ${seriesStart.toISOString()} AND a.date < ${seriesEnd.toISOString()}
      AND a.status != 'cancelled'
      AND strftime('%Y-%m', p.created_at) = strftime('%Y-%m', a.date)
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
      AND (p.user_id = ${uid} OR (p.user_id IS NULL AND ${allowLegacyFlag}))
    GROUP BY ym
    ORDER BY ym ASC
  `)) as any[];

  // Returning attended per month: patient created month < appointment month
  const returningRows = (await (db as any).all(sql`
    SELECT strftime('%Y-%m', a.date) AS ym, COUNT(DISTINCT a.patient_id) AS count
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.date >= ${seriesStart.toISOString()} AND a.date < ${seriesEnd.toISOString()}
      AND a.status != 'cancelled'
      AND strftime('%Y-%m', p.created_at) < strftime('%Y-%m', a.date)
      AND (a.user_id = ${uid} OR (a.user_id IS NULL AND ${allowLegacyFlag}))
      AND (p.user_id = ${uid} OR (p.user_id IS NULL AND ${allowLegacyFlag}))
    GROUP BY ym
    ORDER BY ym ASC
  `)) as any[];

  const mapRev = new Map(revenueRows.map((r: any) => [String(r.ym), Number(r.cents || 0)]));
  const mapUnique = new Map(uniqueRows.map((r: any) => [String(r.ym), Number(r.count || 0)]));
  const mapNewAtt = new Map(newAttendedRows.map((r: any) => [String(r.ym), Number(r.count || 0)]));
  const mapRet = new Map(returningRows.map((r: any) => [String(r.ym), Number(r.count || 0)]));

  const monthlySeries = Array.from({ length: 12 }).map((_, i) => {
    const d = startOfMonth(addMonths(seriesStart, i));
    const ym = d.toISOString().slice(0, 7);
    return {
      ym,
      revenueCents: mapRev.get(ym) ?? 0,
      patientsUnique: mapUnique.get(ym) ?? 0,
      patientsNewAttended: mapNewAtt.get(ym) ?? 0,
      patientsReturningAttended: mapRet.get(ym) ?? 0,
    };
  });

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Centro de control</h1>
            <p className="text-slate-500 dark:text-slate-400">Métricas de pacientes, sesiones e ingresos</p>
            <div className="mt-2">
              <Link href="/" className="text-sm text-slate-600 dark:text-slate-300 hover:underline">
                ← Volver
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <HeaderToggles />
            <a
              href="/finance"
              className="hidden md:inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              💰 Finanzas
            </a>
            <NotificationsBell todayItems={todayAppointments as any} weekItems={weekAppointments as any} />
            <ClockAlerts todayCount={(todayAppointments as any)?.length ?? 0} appointments={todayAppointments as any} />
            {session?.email ? <UserMenu email={session.email} /> : null}
          </div>
        </header>

        <DashboardProClient
          monthStartIso={monthStart.toISOString()}
          kpis={monthKpis as any}
          monthlySeries={monthlySeries as any}
        />
      </div>
    </div>
  );
}
