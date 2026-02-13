'use server';

import { db } from '@/db';
import { userSettings, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { hashPassword, signSession, setSessionCookie } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function registerAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const nextPath = String(formData.get('next') ?? '/');

  if (!email || !password) {
    return { success: false, error: 'Ingresa correo y contraseña.' } as const;
  }
  if (password.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' } as const;
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (existing) {
    return { success: false, error: 'Ese correo ya está registrado.' } as const;
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await db.insert(users).values({
    id,
    email,
    passwordHash,
    role: 'psychologist',
    createdAt: now,
  });

  await db.insert(userSettings).values({
    userId: id,
    settingsJson: JSON.stringify({ lang: 'es', theme: 'system' }),
    updatedAt: now,
  }).onConflictDoUpdate({
    target: userSettings.userId,
    set: { updatedAt: now },
  } as any);

  const token = await signSession({ uid: id, email, role: 'psychologist' });
  await setSessionCookie(token);
  redirect(nextPath.startsWith('/') ? nextPath : '/');
}
