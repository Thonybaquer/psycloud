import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ClientProviders } from '@/components/ClientProviders';

export const metadata: Metadata = {
  title: 'PsyCloud (local)',
  description: 'Bitácora clínica y agenda (demo local)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <ClientProviders>
          {children}
          <Toaster richColors position="top-right" />
        </ClientProviders>
      </body>
    </html>
  );
}
