import Link from 'next/link';
import { db } from '@/db';
import { patients } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { PatientsExcelGrid } from '@/components/PatientsExcelGrid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PatientsTablePage() {
  // Load a practical amount for an “Excel view”.
  // If you need 5k+ patients later, we can switch this to server-side paging.
  const rows = await db.select().from(patients).orderBy(desc(patients.createdAt)).limit(500).all();

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-slate-600 dark:text-slate-300 hover:underline">
              ← Volver al Dashboard
            </Link>
            <h1 className="text-2xl font-bold mt-2">Pacientes (tabla)</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">Vista tipo Excel · editable · con desplazamiento</p>
          </div>
        </div>

        <PatientsExcelGrid initialRows={rows as any} />
      </div>
    </div>
  );
}
