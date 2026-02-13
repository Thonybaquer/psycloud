import { db } from '@/db';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { SetupForm } from '@/components/SetupForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function SetupPage() {
  const row = await db.select({ count: sql<number>`count(*)` }).from(users).get();
  if ((row?.count ?? 0) > 0) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md pc-card">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Configurar PsyCloud</h1>
          <p className="text-sm" style={{ color: 'var(--pc-muted)' }}>
            Crea el primer usuario administrador del consultorio.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
