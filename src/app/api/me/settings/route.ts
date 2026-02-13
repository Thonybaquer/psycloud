import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/serverAuth';
import { db } from '@/db';
import { userSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireSession();
  const row = await db.select().from(userSettings).where(eq(userSettings.userId, session.uid)).get();
  const settings = row?.settingsJson ? JSON.parse(row.settingsJson) : {};
  // Derive flags (never expose hashes)
  const security = settings.security ?? {};
  return NextResponse.json({
    ok: true,
    settings: {
      ...settings,
      security: {
        ...security,
        hasPin: Boolean(security.pinHash),
      },
    },
  });
}
