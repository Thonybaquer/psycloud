'use server';

import { db } from '@/db';
import { passwordResets, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

function safeNowIso() {
  return new Date().toISOString();
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) {
    return { success: false, error: 'Ingresa tu correo.' } as const;
  }

  const user = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  // Privacy: always return ok, even if the email doesn't exist.
  if (!user) {
    return { success: true, token: null } as const;
  }

  // Token: local/dev flow (no email). We display it once in UI.
  const token = `${randomUUID()}-${randomBytes(16).toString('hex')}`;
  const tokenHash = await bcrypt.hash(token, 12);

  const now = safeNowIso();
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString(); // 30 min
  const id = randomUUID();

  await db.insert(passwordResets).values({
    id,
    userId: user.id,
    tokenHash,
    expiresAt,
    createdAt: now,
  });

  return { success: true, token } as const;
}
