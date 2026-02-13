import { db } from '@/db';
import { appointments, clinicalNotes, clinicalSessions, patients } from '@/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { PatientSidebar } from '@/components/PatientSidebar';
import { NoteEditor } from '@/components/NoteEditor';
import { PatientTimeline } from '@/components/PatientTimeline';
import { ClinicalHistory } from '@/components/ClinicalHistory';
import { PatientPayments } from '@/components/PatientPayments';
import type { Attachment } from '@/types';
import { requireSession, canSeeLegacy } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const session = await requireSession();
  const allowLegacy = canSeeLegacy(session);
  const patient = await db.select().from(patients).where(eq(patients.id, params.id)).get();

  if (patient && !(patient.userId === session.uid || (patient.userId == null && allowLegacy))) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-3xl mx-auto pc-card bg-white dark:bg-slate-900">
          <p className="text-slate-700">Sin permisos para ver este paciente.</p>
          <Link href="/" className="text-blue-600 underline">Volver</Link>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-3xl mx-auto pc-card bg-white dark:bg-slate-900">
          <p className="text-slate-700">Paciente no encontrado.</p>
          <Link href="/" className="text-blue-600 underline">Volver</Link>
        </div>
      </div>
    );
  }

  const notesRaw = await db
    .select()
    .from(clinicalNotes)
    .where(and(eq(clinicalNotes.patientId, params.id), sql`(${clinicalNotes.userId} = ${session.uid} OR (${clinicalNotes.userId} IS NULL AND ${allowLegacy ? 1 : 0}))`))
    .orderBy(desc(clinicalNotes.createdAt));

  const notes = notesRaw.map((n) => ({
    id: n.id,
    createdAt: n.createdAt,
    sessionAt: n.sessionAt,
    mood: n.mood,
    category: n.category,
    content: safeJsonParse<any>(n.contentJson, null),
    attachments: safeJsonParse<Attachment[]>(n.attachmentsJson, []),
  }));

  const sessionsRaw = await db
    .select()
    .from(clinicalSessions)
    .where(and(eq(clinicalSessions.patientId, params.id), sql`(${clinicalSessions.userId} = ${session.uid} OR (${clinicalSessions.userId} IS NULL AND ${allowLegacy ? 1 : 0}))`))
    .orderBy(desc(clinicalSessions.sessionAt));

  const apptsRaw = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.patientId, params.id), sql`(${appointments.userId} = ${session.uid} OR (${appointments.userId} IS NULL AND ${allowLegacy ? 1 : 0}))`))
    .orderBy(desc(appointments.date));

  const payments = apptsRaw.map((a) => ({
    id: a.id,
    date: a.date,
    status: a.status,
    feeCents: a.feeCents ?? 0,
    paymentStatus: (a.paymentStatus as any) ?? 'pending',
    paymentMethod: a.paymentMethod ?? null,
    notes: a.notes ?? null,
  }));

  const appointmentOpts = apptsRaw.slice(0, 30).map((a) => ({
    id: a.id,
    date: a.date,
    status: a.status,
    notes: a.notes ?? null,
  }));

  const editSessionAtParam = searchParams?.editSessionAt;
  const editSessionAt = Array.isArray(editSessionAtParam) ? editSessionAtParam[0] : editSessionAtParam;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/*
          Header MUY liviano:
          - En desktop, la navegación y acciones viven en el sidebar (no cargamos el top bar).
          - En móvil, mostramos una barra simple con "Volver".
        */}
        <div className="mb-4 md:hidden">
          <Link href="/" className="text-sm text-slate-600 hover:text-blue-700">← Volver</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <PatientSidebar patient={patient} />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="pc-card bg-white dark:bg-slate-900">
              <ClinicalHistory
                patientId={patient.id}
                initialSessions={sessionsRaw as any}
                appointmentOpts={appointmentOpts as any}
              />
            </div>

            <div className="pc-card bg-white dark:bg-slate-900">
              <PatientPayments initial={payments as any} />
            </div>

            <div className="pc-card bg-white dark:bg-slate-900" id="note-editor">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Notas (libre)</h2>
              <NoteEditor
                patientId={patient.id}
                appointments={apptsRaw.map((a) => ({ id: a.id, date: a.date, endAt: a.endAt ?? null, status: a.status })) as any}
                initialSessionAt={typeof editSessionAt === 'string' ? editSessionAt : undefined}
              />
            </div>

            <div className="pc-card bg-white dark:bg-slate-900">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Historial de notas</h2>
              <PatientTimeline patientId={patient.id} notes={notes as any} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
