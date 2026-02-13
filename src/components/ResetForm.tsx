'use client';

import { useState, useTransition } from 'react';
import { resetPasswordAction } from '@/app/reset/actions';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';

export function ResetForm({ nextPath, initialToken }: { nextPath: string; initialToken?: string }) {
  const { t, lang } = useI18n();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState(initialToken ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');

  return (
    <form
      action={(formData) => {
        setMsg('');
        startTransition(async () => {
          const res = await resetPasswordAction(formData);
          if (!res.success) {
            setMsg(res.error ?? (lang === 'en' ? 'Could not reset password' : 'No se pudo restablecer'));
            return;
          }
          setMsg(t('auth.passwordUpdated'));
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="next" value={nextPath} />

      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {lang === 'en' ? 'Code' : 'Código'}
        </label>
        <input
          name="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-mono"
          placeholder={lang === 'en' ? 'Paste the code here' : 'Pega el código aquí'}
          required
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('auth.newPassword')}</label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          required
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('auth.confirmPassword')}</label>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          required
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
      >
        {pending ? t('common.loading') : t('auth.resetPassword')}
      </button>

      {msg ? <p className="text-sm" style={{ color: 'var(--pc-muted)' }}>{msg}</p> : null}

      {msg === t('auth.passwordUpdated') ? (
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="text-sm text-blue-700 dark:text-blue-400 hover:underline">
          {t('auth.backToLogin')}
        </Link>
      ) : null}
    </form>
  );
}
