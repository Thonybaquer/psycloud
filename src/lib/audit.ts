import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { randomUUID } from 'crypto';
import type { SessionPayload } from '@/lib/auth';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'security';

export async function writeAuditLog(opts: {
  session: SessionPayload;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: any;
  after?: any;
}) {
  try {
    const now = new Date().toISOString();
    await db.insert(auditLogs).values({
      id: randomUUID(),
      userId: (opts.session as any).uid ?? null,
      actorUserId: (opts.session as any).uid ?? null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      beforeJson: JSON.stringify(opts.before ?? {}),
      afterJson: JSON.stringify(opts.after ?? {}),
      createdAt: now,
    } as any);
  } catch {
    // auditing must never break the app
  }
}
