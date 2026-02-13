import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/serverAuth';
import { db } from '@/db';
import { appointments, clinicalNotes, noteDrafts, patients } from '@/db/schema';
import { randomUUID } from 'crypto';

// Import is intentionally conservative:
// - Keeps existing logic intact
// - Forces user_id = current user
// - Skips invalid rows rather than breaking

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const pts = Array.isArray(body.patients) ? body.patients : [];
  const appts = Array.isArray(body.appointments) ? body.appointments : [];
  const notes = Array.isArray(body.clinicalNotes) ? body.clinicalNotes : [];
  const drafts = Array.isArray(body.noteDrafts) ? body.noteDrafts : [];

  // We remap patient IDs to avoid collisions.
  const idMap = new Map();
  for (const p of pts) {
    const newId = randomUUID();
    idMap.set(String(p.id), newId);
    try {
      await db.insert(patients).values({
        ...p,
        id: newId,
        userId: session.uid,
      });
    } catch {
      // skip
    }
  }

  for (const a of appts) {
    try {
      const pid = idMap.get(String(a.patientId));
      if (!pid) continue;
      await db.insert(appointments).values({
        ...a,
        id: randomUUID(),
        patientId: pid,
        userId: session.uid,
      });
    } catch {
      // skip
    }
  }

  for (const n of notes) {
    try {
      const pid = idMap.get(String(n.patientId));
      if (!pid) continue;
      await db.insert(clinicalNotes).values({
        ...n,
        id: randomUUID(),
        patientId: pid,
        userId: session.uid,
      });
    } catch {
      // skip
    }
  }

  for (const d of drafts) {
    try {
      const pid = idMap.get(String(d.patientId));
      if (!pid) continue;
      await db.insert(noteDrafts).values({
        ...d,
        id: randomUUID(),
        patientId: pid,
        userId: session.uid,
      });
    } catch {
      // skip
    }
  }

  return NextResponse.json({ success: true });
}
