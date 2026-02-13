'use client';

import { useState, useTransition } from 'react';
import { registerAction } from '@/app/register/actions';

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>('');

  return (
    <form
      action={(formData) => {
        setError('');
        startTransition(async () => {
          const res = await registerAction(formData);
          if ((res as any)?.success === false) {
            setError((res as any)?.error || 'No se pudo crear la cuenta.');
          }
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="next" value={nextPath} />

      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Correo</label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          placeholder="correo@consultorio.com"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        {pending ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
