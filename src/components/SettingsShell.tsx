'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const { t, lang } = useI18n();
  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400">
          ← {lang === 'en' ? 'Back' : 'Volver'}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{t('settings.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--pc-muted)' }}>
          {lang === 'en'
            ? 'Account preferences (language, theme, time zone, date format, backups, export/import, and session management).'
            : 'Preferencias de la cuenta (idioma, tema, zona horaria, formato de fecha, copias de seguridad, exportación/importación y gestión de sesión).'}
        </p>
        <div className="pc-card bg-white dark:bg-slate-900 mt-6">
          {children}
        </div>
      </div>
    </div>
  );
}
