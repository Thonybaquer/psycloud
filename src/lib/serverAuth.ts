import { getSessionFromCookies, type SessionPayload } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Server-only helper: enforce authenticated session.
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSessionFromCookies();
  if (!session) redirect('/login');
  return session;
}

// Legacy compatibility:
// - admin can see records with user_id NULL (data created before multiuser)
export function canSeeLegacy(session: SessionPayload) {
  return session.role === 'admin';
}
