import { getMySettings } from './actions';
import { SettingsForm } from '@/components/SettingsForm';
import { SettingsShell } from '@/components/SettingsShell';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function SettingsPage() {
  const res = await getMySettings();
  const initial = (res as any).settings ?? {};
  return (
    <SettingsShell>
      <SettingsForm initial={initial} />
    </SettingsShell>
  );
}
