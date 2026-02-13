'use server';

import { db } from '@/db';
import { userSettings, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/serverAuth';
import { revalidatePath } from 'next/cache';
import { hashPassword, verifyPassword } from '@/lib/auth';

export async function getMySettings() {
  const session = await requireSession();
  const row = await db.select().from(userSettings).where(eq(userSettings.userId, session.uid)).get();
  const settings = row?.settingsJson ? JSON.parse(row.settingsJson) : {};
  return { success: true, settings } as const;
}

export async function saveMySettings(formData: FormData) {
  const session = await requireSession();
  const now = new Date().toISOString();
  const lang = String(formData.get('lang') ?? 'es');
  const theme = String(formData.get('theme') ?? 'system');
  const timezone = String(formData.get('timezone') ?? '');
  const dateFormat = String(formData.get('dateFormat') ?? '');
  const notifyEmail = String(formData.get('notifyEmail') ?? 'off') === 'on';
  const notifyUpcoming = String(formData.get('notifyUpcoming') ?? 'off') === 'on';
  const uiSize = String(formData.get('uiSize') ?? 'normal');
  const uiZoom = Number(formData.get('uiZoom') ?? '100');
  const moneyDecimals = Number(formData.get('moneyDecimals') ?? '0');
  const appLockEnabled = String(formData.get('appLockEnabled') ?? 'off') === 'on';
  const autoLockMinutes = Number(formData.get('autoLockMinutes') ?? '10');
  const rememberMinutes = Number(formData.get('rememberMinutes') ?? '15');

  const existingRow = await db.select().from(userSettings).where(eq(userSettings.userId, session.uid)).get();
  const existing = existingRow?.settingsJson ? JSON.parse(existingRow.settingsJson) : {};

  const payload = {
    lang,
    theme,
    timezone,
    dateFormat,
    notifications: {
      email: notifyEmail,
      upcomingAppointments: notifyUpcoming,
    },
    ui: {
      size: uiSize,
      zoom: Number.isFinite(uiZoom) ? uiZoom : 100,
    },
    money: {
      decimals: Number.isFinite(moneyDecimals) ? Math.max(0, Math.min(2, Math.round(moneyDecimals))) : 0,
    },
    security: {
      ...(existing.security ?? {}),
      appLockEnabled,
      autoLockMinutes: Number.isFinite(autoLockMinutes) ? Math.max(0, Math.round(autoLockMinutes)) : 10,
      rememberMinutes: Number.isFinite(rememberMinutes) ? Math.max(0, Math.round(rememberMinutes)) : 15,
    },
  };

  const finalSettings = {
    ...existing,
    ...payload,
    notifications: { ...(existing.notifications ?? {}), ...(payload as any).notifications },
    ui: { ...(existing.ui ?? {}), ...(payload as any).ui },
    money: { ...(existing.money ?? {}), ...(payload as any).money },
    security: { ...(existing.security ?? {}), ...(payload as any).security },
  };

  await (db as any).run(`
    INSERT INTO user_settings (user_id, settings_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      settings_json=excluded.settings_json,
      updated_at=excluded.updated_at
  `, [session.uid, JSON.stringify(finalSettings), now]);

  revalidatePath('/settings');
  revalidatePath('/');
  return { success: true } as const;
}

export async function changeMyPassword(formData: FormData) {
  const session = await requireSession();
  const current = String(formData.get('currentPassword') ?? '');
  const password = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (!current) return { success: false, error: 'Ingresa tu contraseña actual.' } as const;
  if (!password || password.length < 8) return { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' } as const;
  if (password !== confirm) return { success: false, error: 'Las contraseñas no coinciden.' } as const;

  const user = await db.select().from(users).where(eq(users.id, session.uid)).get();
  if (!user) return { success: false, error: 'Cuenta no encontrada.' } as const;
  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) return { success: false, error: 'La contraseña actual no es correcta.' } as const;

  const newHash = await hashPassword(password);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, session.uid));

  revalidatePath('/settings');
  return { success: true } as const;
}
