import Link from 'next/link';
import { ForgotForm } from '@/components/ForgotForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function ForgotPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const nextPath = typeof searchParams?.next === 'string' ? searchParams!.next : '/';

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md pc-card bg-white dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recuperación de contraseña</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--pc-muted)' }}>
          Ingresa tu correo y generaremos un código de restablecimiento seguro.
        </p>

        <div className="mt-4">
          <ForgotForm nextPath={nextPath} />
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
