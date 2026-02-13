
'use client';

import { Moon, Sun, Languages } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export function HeaderToggles() {
  const { theme, toggle } = useTheme();
  const { lang, setLang } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2"
        title="Language"
      >
        <Languages className="w-4 h-4" />
        {lang.toUpperCase()}
      </button>

      <button
        type="button"
        onClick={toggle}
        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200"
        title="Theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </div>
  );
}
