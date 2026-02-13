import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/serverAuth';
import { db } from '@/db';
import { userSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { writeAuditLog } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST() {
  const session = await requireSession();
  const row = await db.select().from(userSettings).where(eq(userSettings.userId, session.uid)).get();
  const settings = row?.settingsJson ? JSON.parse(row.settingsJson) : {};
  const next = {
    ...settings,
    security: { ...(settings.security ?? {}), pinHash: null, appLockEnabled: false },
  };
  const now = new Date().toISOString();
  await (db as any).run(
    `INSERT INTO user_settings (user_id, settings_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json, updated_at=excluded.updated_at`,
    [session.uid, JSON.stringify(next), now]
  );
  await writeAuditLog({ session, action: 'security', entityType: 'appLock', entityId: session.uid, after: { event: 'clearPin' } });
  return NextResponse.json({ ok: true });
}
