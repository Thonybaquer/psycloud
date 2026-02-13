'use client';

import { useState, useTransition } from 'react';
import { setupAdminAction } from '@/app/setup/actions';

export function SetupForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  return (
    <form
      action={(formData) => {
        setError('');
        startTransition(async () => {
          const res = await setupAdminAction(formData) as any;
          if (res?.success === false) {
            setError(res.error || 'No se pudo crear el usuario.');
          }
        });
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Correo admin</label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          placeholder="admin@consultorio.com"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          placeholder="mínimo 8 caracteres"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Confirmar contraseña</label>
        <input
          name="password2"
          type="password"
          required
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
        />
      </div>

      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        {pending ? 'Creando…' : 'Crear usuario y continuar'}
      </button>
    </form>
  );
}
