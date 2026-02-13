
'use client';

import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import { UiProvider } from '@/components/UiProvider';
import { AppLockProvider } from '@/components/AppLockProvider';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <UiProvider>
        <I18nProvider><AppLockProvider>{children}</AppLockProvider></I18nProvider>
      </UiProvider>
    </ThemeProvider>
  );
}
