'use client';

import { useState, useTransition } from 'react';
import { requestPasswordReset } from '@/app/forgot/actions';
import { useI18n } from '@/lib/i18n';

export function ForgotForm({ nextPath }: { nextPath: string }) {
  const { t, lang } = useI18n();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>('');

  return (
    <form
      action={(formData) => {
        setMsg('');
        setToken(null);
        startTransition(async () => {
          const res = await requestPasswordReset(formData);
          if (!res.success) {
            setMsg(res.error ?? (lang === 'en' ? 'Could not process' : 'No se pudo procesar'));
            return;
          }
          // Privacy: we always show the same confirmation message.
          setMsg(lang === 'en' ? 'If the email exists, a reset code has been generated.' : 'Si el correo existe, se generó un código de restablecimiento.');
          // Local/dev flow: show token once (if available).
          if (res.token) setToken(res.token);
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="next" value={nextPath} />

      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Email</label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          placeholder={lang === 'en' ? 'you@example.com' : 'tu@correo.com'}
          required
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
      >
        {pending ? t('common.loading') : t('auth.sendResetLink')}
      </button>

      {msg ? <p className="text-sm" style={{ color: 'var(--pc-muted)' }}>{msg}</p> : null}

      {token ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {lang === 'en' ? 'Reset code (local mode)' : 'Código de restablecimiento (modo local)'}
          </div>
          <div className="mt-1 font-mono text-sm break-all text-slate-900 dark:text-slate-100">{token}</div>
          <div className="mt-2 text-xs" style={{ color: 'var(--pc-muted)' }}>
            {lang === 'en'
              ? 'Go to Reset and paste this code. It expires in 30 minutes.'
              : 'Ve a Restablecer y pega este código. Expira en 30 minutos.'}
          </div>
        </div>
      ) : null}

      <div className="text-xs" style={{ color: 'var(--pc-muted)' }}>
        {lang === 'en'
          ? 'Security note: to protect privacy, we do not confirm whether an email is registered.'
          : 'Nota de seguridad: para proteger tu privacidad, no confirmamos si un correo está registrado.'}
      </div>
    </form>
  );
}
