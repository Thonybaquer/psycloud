
'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-extrabold mb-2">Ups…</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Ocurrió un error inesperado. Tus datos siguen en tu base local.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold"
          >
            Reintentar
          </button>
          <button
            onClick={() => location.reload()}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold"
          >
            Recargar
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-400">Digest: {error.digest ?? '—'}</p>
      </div>
    </div>
  );
}
