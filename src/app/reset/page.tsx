import Link from 'next/link';
import { ResetForm } from '@/components/ResetForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ResetPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> }) {
  const sp = await Promise.resolve(searchParams as any);
  const nextPath = typeof sp?.next === 'string' ? sp!.next : '/';
  const token = typeof sp?.token === 'string' ? sp!.token : '';

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md pc-card bg-white dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Restablecer contraseña</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--pc-muted)' }}>
          Ingresa el código y define una contraseña nueva.
        </p>

        <div className="mt-4">
          <ResetForm nextPath={nextPath} initialToken={token} />
        </div>

        <div className="mt-4 text-sm">
          <Link href="/login" className="text-blue-700 dark:text-blue-400 hover:underline">
            ← Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}