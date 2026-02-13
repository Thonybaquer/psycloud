'use server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { signSession, setSessionCookie, verifyPassword } from '@/lib/auth';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const nextPath = String(formData.get('next') ?? '/');

  if (!email || !password) {
    return { success: false, error: 'Ingresa correo y contraseña.' } as const;
  }

  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    return { success: false, error: 'Usuario o contraseña inválidos.' } as const;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return { success: false, error: 'Usuario o contraseña inválidos.' } as const;
  }

  const token = await signSession({ uid: user.id, email: user.email, role: user.role });
  await setSessionCookie(token);
  redirect(nextPath.startsWith('/') ? nextPath : '/');
}

export async function hasAnyUser() {
  const row = await db.select({ count: sql<number>`count(*)` }).from(users).get();
  return (row?.count ?? 0) > 0;
}
