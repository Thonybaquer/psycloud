import { RegisterForm } from '@/components/RegisterForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<{ next?: string | string[] }> | { next?: string | string[] } }) {
  const sp = await Promise.resolve(searchParams as any);
  const next = typeof sp?.next === 'string' ? sp.next : '/';
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md pc-card">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">PsyCloud</h1>
          <p className="text-sm" style={{ color: 'var(--pc-muted)' }}>Crea tu cuenta</p>
        </div>
        <RegisterForm nextPath={next} />
        <div className="mt-4 text-sm" style={{ color: 'var(--pc-muted)' }}>
          ¿Ya tienes cuenta? <a className="text-blue-600 underline" href="/login">Inicia sesión</a>
        </div>
      </div>
    </div>
  );
}