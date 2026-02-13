import { NextResponse } from 'next/server';
import { requireSession, canSeeLegacy } from '@/lib/serverAuth';
import { db } from '@/db';
import { appointments, clinicalNotes, noteDrafts, patients, userSettings } from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

function ownershipWhere(col: any, uid: string, allowLegacy: boolean) {
  return allowLegacy ? sql`(${col} = ${uid} OR ${col} IS NULL)` : sql`${col} = ${uid}`;
}

export async function GET() {
  const session = await requireSession();
  const allowLegacy = canSeeLegacy(session);

  const pts = await db.select().from(patients).where(ownershipWhere(patients.userId, session.uid, allowLegacy)).all();
  const ids = pts.map((p) => p.id);

  const appts = ids.length
    ? await db.select().from(appointments).where(and(ownershipWhere(appointments.userId, session.uid, allowLegacy), inArray(appointments.patientId, ids))).all()
    : [];

  const notes = ids.length
    ? await db.select().from(clinicalNotes).where(and(ownershipWhere(clinicalNotes.userId, session.uid, allowLegacy), inArray(clinicalNotes.patientId, ids))).all()
    : [];

  const drafts = ids.length
    ? await db.select().from(noteDrafts).where(and(ownershipWhere(noteDrafts.userId, session.uid, allowLegacy), inArray(noteDrafts.patientId, ids))).all()
    : [];

  const settingsRow = await db.select().from(userSettings).where(eq(userSettings.userId, session.uid)).get();

  const payload = {
    version: 'PsyCloud-v3.4.1-pro-fixed5',
    exportedAt: new Date().toISOString(),
    userId: session.uid,
    settings: settingsRow?.settingsJson ? JSON.parse(settingsRow.settingsJson) : {},
    patients: pts,
    appointments: appts,
    clinicalNotes: notes,
    noteDrafts: drafts,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="psycloud-export-${new Date().toISOString().slice(0,10)}.json"`,
    },
  });
}
