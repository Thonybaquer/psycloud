import { hasAnyUser } from './actions';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const any = await hasAnyUser();
  if (!any) redirect('/setup');

  const next = typeof searchParams?.next === 'string' ? searchParams.next : '/';

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md pc-card">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">PsyCloud</h1>
          <p className="text-sm" style={{ color: 'var(--pc-muted)' }}>Inicia sesión para acceder</p>
        </div>
        <LoginForm nextPath={next} />
      </div>
    </div>
  );
}
