'use server';

import { db } from '@/db';
import { passwordResets, users } from '@/db/schema';
import { desc, eq, gt } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (!token) return { success: false, error: 'Ingresa el código.' } as const;
  if (!password || password.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' } as const;
  }
  if (password !== confirm) return { success: false, error: 'Las contraseñas no coinciden.' } as const;

  const now = new Date().toISOString();

  // Find all non-expired tokens (small table in local mode).
  const rows = await db
    .select()
    .from(passwordResets)
    .where(gt(passwordResets.expiresAt, now))
    .orderBy(desc(passwordResets.createdAt))
    .all();

  let match: (typeof rows)[number] | null = null;
  for (const r of rows) {
    const ok = await bcrypt.compare(token, r.tokenHash);
    if (ok) {
      match = r;
      break;
    }
  }

  if (!match) return { success: false, error: 'El código es inválido o expiró.' } as const;

  const newHash = await hashPassword(password);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, match.userId));

  // Invalidate all reset tokens for that user (safer).
  await (db as any).run(`DELETE FROM password_resets WHERE user_id = ?`, [match.userId]);

  return { success: true } as const;
}
