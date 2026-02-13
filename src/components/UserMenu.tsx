'use client';

import { logoutAction } from '@/app/auth/actions';

export function UserMenu({ email }: { email: string }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
        title={email}
      >
        👤 {email}
        <span className="opacity-60">· Salir</span>
      </button>
    </form>
  );
}
