'use server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { hashPassword } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function setupAdminAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const password2 = String(formData.get('password2') ?? '');

  if (!email || !email.includes('@')) {
    return { success: false, error: 'Ingresa un correo válido.' } as const;
  }
  if (!password || password.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' } as const;
  }
  if (password !== password2) {
    return { success: false, error: 'Las contraseñas no coinciden.' } as const;
  }

  const row = await db.select({ count: sql<number>`count(*)` }).from(users).get();
  const any = (row?.count ?? 0) > 0;
  if (any) {
    redirect('/login');
  }

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({
    id: randomUUID(),
    email,
    passwordHash,
    role: 'admin',
    createdAt: new Date().toISOString(),
  });

  redirect('/login');
}
