import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/serverAuth';
import { db } from '@/db';
import { userSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? '');
  const appLockEnabled = Boolean(body.appLockEnabled);
  const autoLockMinutes = Number(body.autoLockMinutes ?? 10);
  const rememberMinutes = Number(body.rememberMinutes ?? 15);

  if (!pin || pin.length < 4 || pin.length > 20) {
    return NextResponse.json({ ok: false, error: 'PIN inválido.' }, { status: 400 });
  }

  const row = await db.select().from(userSettings).where(eq(userSettings.userId, session.uid)).get();
  const settings = row?.settingsJson ? JSON.parse(row.settingsJson) : {};

  const pinHash = await hashPassword(pin);
  const next = {
    ...settings,
    security: {
      ...(settings.security ?? {}),
      pinHash,
      appLockEnabled,
      autoLockMinutes: Number.isFinite(autoLockMinutes) ? Math.max(0, Math.round(autoLockMinutes)) : 10,
      rememberMinutes: Number.isFinite(rememberMinutes) ? Math.max(0, Math.round(rememberMinutes)) : 15,
    },
  };

  const now = new Date().toISOString();
  await (db as any).run(
    `INSERT INTO user_settings (user_id, settings_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json, updated_at=excluded.updated_at`,
    [session.uid, JSON.stringify(next), now]
  );

  await writeAuditLog({ session, action: 'security', entityType: 'appLock', entityId: session.uid, after: { event: 'setPin' } });
  return NextResponse.json({ ok: true });
}
