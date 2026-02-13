import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/serverAuth';
import { db } from '@/db';
import { userSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? '');

  const row = await db.select().from(userSettings).where(eq(userSettings.userId, session.uid)).get();
  const settings = row?.settingsJson ? JSON.parse(row.settingsJson) : {};
  const pinHash = settings.security?.pinHash ? String(settings.security.pinHash) : '';

  if (!pinHash) return NextResponse.json({ ok: false, error: 'PIN no configurado.' }, { status: 400 });

  const ok = await verifyPassword(pin, pinHash);
  if (ok) {
    await writeAuditLog({ session, action: 'security', entityType: 'appLock', entityId: session.uid, after: { event: 'unlock' } });
  }
  return NextResponse.json({ ok });
}
