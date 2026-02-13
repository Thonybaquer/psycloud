'use server';

import { db } from '@/db';
import { appointments, clinicalNotes, clinicalSessions, patients } from '@/db/schema';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Attachment, CreatePatientResult, SaveNoteResult } from '@/types';
import * as XLSX from 'xlsx';
import { requireSession, canSeeLegacy } from '@/lib/serverAuth';

async function getAuth() {
  const session = await requireSession();
  const allowLegacy = canSeeLegacy(session);
  return { session, allowLegacy };
}

function ownershipWhere(col: any, uid: string, allowLegacy: boolean) {
  return allowLegacy ? sql`(${col} = ${uid} OR ${col} IS NULL)` : sql`${col} = ${uid}`;
}

const CreatePatientSchema = z.object({
  // Único obligatorio real: nombre
  fullName: z.string().min(1, 'El nombre es obligatorio').max(100, 'Nombre demasiado largo'),
  documentId: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  country: z.string().max(80).optional().or(z.literal('')),
  city: z.string().max(80).optional().or(z.literal('')),
  photoUrl: z.string().max(500).optional().or(z.literal('')),
  birthDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((date) => !date || !Number.isNaN(new Date(date).getTime()), { message: 'Fecha inválida' })
    .refine((date) => !date || new Date(date) <= new Date(), { message: 'La fecha no puede ser futura' }),
  // Si no viene, por defecto Psicología
  type: z.enum(['PSY', 'MED']).optional().default('PSY'),
});

export async function createPatient(formData: FormData): Promise<CreatePatientResult> {
  const { session } = await getAuth();
  const rawData = {
    // Normaliza: FormData puede devolver null y Zod lo toma como inválido incluso en opcionales.
    fullName: String(formData.get('fullName') ?? '').trim(),
    documentId: String(formData.get('documentId') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    country: String(formData.get('country') ?? ''),
    city: String(formData.get('city') ?? ''),
    photoUrl: String(formData.get('photoUrl') ?? ''),
    birthDate: String(formData.get('birthDate') ?? ''),
    type: String(formData.get('type') ?? 'PSY') as any,
  };

  const result = CreatePatientSchema.safeParse(rawData);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message ?? 'Datos inválidos' };
  }

  try {
    const id = randomUUID();
    await db.insert(patients).values({
      id,
      userId: session.uid,
      fullName: result.data.fullName,
      documentId: result.data.documentId || null,
      email: result.data.email || null,
      phone: result.data.phone || null,
      country: result.data.country || null,
      city: result.data.city || null,
      birthDate: (result.data.birthDate && result.data.birthDate !== '') ? result.data.birthDate : '1900-01-01',
      type: result.data.type,
      active: 1,
      photoUrl: result.data.photoUrl || null,
      createdAt: new Date().toISOString(),
    });

    revalidatePath('/');
    return { success: true, newId: id };
  } catch (e) {
    console.error('Error creando paciente:', e);
    return { success: false, error: 'Error de base de datos' };
  }
}

export async function saveNote(
  patientId: string,
  contentJson: unknown,
  mood: string,
  attachments: Attachment[] = [],
  category: string = 'seguimiento',
  sessionAtIso?: string
): Promise<SaveNoteResult> {
  try {
    const { session, allowLegacy } = await getAuth();
    // Ownership check
    const p = await db.select({ id: patients.id }).from(patients)
      .where(and(eq(patients.id, patientId), ownershipWhere(patients.userId, session.uid, allowLegacy)))
      .get();
    if (!p) return { success: false, error: 'Sin permisos para este paciente' };

    const nowIso = new Date().toISOString();
    // Importante:
    // El usuario espera que cada "Guardar" cree una nota nueva (no que sobreescriba la anterior).
    // Por eso siempre insertamos un registro nuevo, incluso si pertenece a la misma cita/sesión.
    // `sessionAt` se usa como referencia clínica (orden por sesión), mientras `createdAt` distingue versiones.
    const sessionIso = sessionAtIso && !Number.isNaN(new Date(sessionAtIso).getTime()) ? sessionAtIso : nowIso;
    const id = randomUUID();
    await db.insert(clinicalNotes).values({
      id,
      userId: session.uid,
      patientId,
      contentJson: JSON.stringify(contentJson ?? null),
      mood,
      category,
      attachmentsJson: JSON.stringify(attachments ?? []),
      sessionAt: sessionIso,
      createdAt: nowIso,
    });

    revalidatePath(`/patient/${patientId}`);
    return { success: true };
  } catch (e) {
    console.error('Error guardando nota:', e);
    return { success: false, error: 'No se pudo guardar la nota' };
  }
}

// Actualiza datos del paciente (perfil)
export async function updatePatient(patientId: string, data: {
  fullName?: string;
  documentId?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  sex?: 'Masculino' | 'Femenino' | 'Otro' | null;
  status?: 'activo' | 'cerrado' | 'inactivo' | null;
  startDate?: string | null;
  closeDate?: string | null;
  howArrived?: string | null;
  detail?: string | null;
  // kept for backwards compatibility
  address?: string | null;
  birthDate?: string;
  type?: 'PSY' | 'MED';
  photoUrl?: string | null;
}) {
  try {
    const { session, allowLegacy } = await getAuth();
    const p = await db.select({ id: patients.id }).from(patients)
      .where(and(eq(patients.id, patientId), ownershipWhere(patients.userId, session.uid, allowLegacy)))
      .get();
    if (!p) return { success: false, error: 'Sin permisos para este paciente' } as const;

    await db.update(patients).set({
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.documentId !== undefined ? { documentId: data.documentId } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.country !== undefined ? { country: data.country } : {}),
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.sex !== undefined ? { sex: data.sex } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
      ...(data.closeDate !== undefined ? { closeDate: data.closeDate } : {}),
      ...(data.howArrived !== undefined ? { howArrived: data.howArrived } : {}),
      ...(data.detail !== undefined ? { detail: data.detail } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.birthDate !== undefined ? { birthDate: data.birthDate } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
    }).where(and(eq(patients.id, patientId), ownershipWhere(patients.userId, session.uid, allowLegacy)));

    revalidatePath(`/patient/${patientId}`);
    revalidatePath(`/`);
    return { success: true } as const;
  } catch (e) {
    console.error('Error actualizando paciente:', e);
    return { success: false, error: 'No se pudo actualizar el paciente' } as const;
  }
}

// Backwards-compatible name used by some UI components
export async function updatePatientProfile(
  patientId: string,
  data: {
    fullName?: string;
    documentId?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    birthDate?: string;
    type?: 'PSY' | 'MED';
    photoUrl?: string | null;
  }
) {
  // Reutiliza la misma lógica de actualización
  return updatePatient(patientId, data);
}

// --- CITAS ---
export async function createAppointment(input: {
  patientId: string;
  // Backwards compatible: older UI sends `dateIso` as the start time
  dateIso?: string; // ISO
  startIso?: string; // ISO
  endIso?: string; // ISO
  durationMinutes?: number;
  notes?: string;
}) {
  try {
    const { session, allowLegacy } = await getAuth();
    const p = await db.select({ id: patients.id }).from(patients)
      .where(and(eq(patients.id, input.patientId), ownershipWhere(patients.userId, session.uid, allowLegacy)))
      .get();
    if (!p) return { success: false, error: 'Sin permisos para este paciente' } as const;
    const id = randomUUID();
    const startStr = input.startIso ?? input.dateIso;
    const start = new Date(startStr ?? '');
    if (Number.isNaN(start.getTime())) {
      return { success: false, error: 'Fecha/hora inválida' } as const;
    }

    let end: Date | null = null;
    if (input.endIso) {
      const e = new Date(input.endIso);
      if (!Number.isNaN(e.getTime())) end = e;
    }
    if (!end) {
      const mins = typeof input.durationMinutes === 'number' && input.durationMinutes > 0 ? input.durationMinutes : 60;
      end = new Date(start.getTime() + mins * 60_000);
    }

    await db.insert(appointments).values({
      id,
      userId: session.uid,
      patientId: input.patientId,
      date: start.toISOString(),
      endAt: end.toISOString(),
      status: 'pending',
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
    });

    revalidatePath('/');
    return { success: true } as const;
  } catch (e) {
    console.error('Error creando cita:', e);
    return { success: false, error: 'No se pudo crear la cita' } as const;
  }
}

export async function getUpcomingAppointments(daysAhead = 7) {
  const { session, allowLegacy } = await getAuth();
  // Trae citas pendientes desde ahora hasta N días adelante
  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const rows = await db.select({
    id: appointments.id,
    patientId: appointments.patientId,
    date: appointments.date,
    endAt: appointments.endAt,
    status: appointments.status,
    notes: appointments.notes,
    feeCents: appointments.feeCents,
    paymentStatus: appointments.paymentStatus,
    paymentMethod: appointments.paymentMethod,
    patientName: patients.fullName,
  })
    .from(appointments)
    .leftJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(appointments.status, 'pending'), ownershipWhere(appointments.userId, session.uid, allowLegacy)))
    .all();

  const filtered = rows
    .map((r) => ({
      ...r,
      date: r.date,
      patientName: r.patientName ?? 'Paciente',
    }))
    .filter((r) => {
      const d = new Date(r.date);
      return d >= now && d <= end;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return filtered;
}

// Backwards-compatible name used by AppointmentManager
export async function listUpcomingAppointments() {
  return getUpcomingAppointments();
}

export async function listAppointmentsInRange(startIso: string, endIso: string) {
  const { session, allowLegacy } = await getAuth();
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  // Filtrado en DB (mejor rendimiento cuando hay muchas citas)
  const rows = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      date: appointments.date,
      endAt: appointments.endAt,
      status: appointments.status,
      notes: appointments.notes,
      feeCents: appointments.feeCents,
      paymentStatus: appointments.paymentStatus,
      paymentMethod: appointments.paymentMethod,
      patientName: patients.fullName,
    })
    .from(appointments)
    .leftJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(gte(appointments.date, start.toISOString()), lte(appointments.date, end.toISOString()), ownershipWhere(appointments.userId, session.uid, allowLegacy)))
    .all();

  return rows
    .map((r) => ({
      ...r,
      patientName: r.patientName ?? 'Paciente',
      endAt: r.endAt ?? null,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function updateAppointmentTime(input: { id: string; startIso: string; endIso: string; allowOverlap?: boolean }) {
  try {
    const { session, allowLegacy } = await getAuth();
    const s = new Date(input.startIso);
    const e = new Date(input.endIso);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return { success: false, error: 'Fecha/hora inválida' } as const;
    }

    if (!input.allowOverlap) {
      const ov = await hasOverlap(s.toISOString(), e.toISOString(), input.id);
      if (ov)
        return {
          success: false,
          error: 'Ya existe una cita registrada en ese horario. Elige otro espacio o reprograma la cita existente.',
        } as const;
    }

    await db
      .update(appointments)
      .set({ date: s.toISOString(), endAt: e.toISOString() })
      .where(and(eq(appointments.id, input.id), ownershipWhere(appointments.userId, session.uid, allowLegacy)));

    revalidatePath('/');
    return { success: true } as const;
  } catch (e) {
    console.error('Error actualizando cita:', e);
    return { success: false, error: 'No se pudo actualizar la cita' } as const;
  }
}

export async function deleteAppointment(id: string) {
  try {
    const { session, allowLegacy } = await getAuth();
    await db.delete(appointments).where(and(eq(appointments.id, id), ownershipWhere(appointments.userId, session.uid, allowLegacy)));
    revalidatePath('/');
    return { success: true } as const;
  } catch (e) {
    console.error('Error eliminando cita:', e);
    return { success: false, error: 'No se pudo eliminar la cita' } as const;
  }
}


// --- PACIENTES: búsqueda server-side con paginación (escalable 1000+) ---
export async function searchPatients(input: { q: string; page?: number; pageSize?: number }) {
  const { session, allowLegacy } = await getAuth();
  const q = (input.q ?? '').trim();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, input.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  // Sin query: lista reciente
  if (!q) {
    const rows = await db
      .select({
        id: patients.id,
        fullName: patients.fullName,
        documentId: patients.documentId,
        birthDate: patients.birthDate,
        photoUrl: patients.photoUrl,
        type: patients.type,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .where(ownershipWhere(patients.userId, session.uid, allowLegacy))
      .orderBy(desc(patients.createdAt))
      .limit(pageSize)
      .offset(offset)
      .all();

    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(patients)
      .where(ownershipWhere(patients.userId, session.uid, allowLegacy))
      .all();

    return { rows, total: countRow?.[0]?.count ?? 0, page, pageSize };
  }

  const qNorm = q.toLowerCase();
  const likeExpr = `%${qNorm.replace(/%/g, '')}%`;

  const whereExpr = sql`
    (lower(${patients.fullName}) like ${likeExpr})
    OR (lower(coalesce(${patients.documentId}, '')) like ${likeExpr})
  `;

  const rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      documentId: patients.documentId,
      birthDate: patients.birthDate,
      photoUrl: patients.photoUrl,
      type: patients.type,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(and(whereExpr, ownershipWhere(patients.userId, session.uid, allowLegacy)))
    .orderBy(desc(patients.createdAt))
    .limit(pageSize)
    .offset(offset)
    .all();

  const countRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(patients)
    .where(and(whereExpr, ownershipWhere(patients.userId, session.uid, allowLegacy)))
    .all();

  return { rows, total: countRow?.[0]?.count ?? 0, page, pageSize };
}

export async function autocompletePatients(input: { q: string; limit?: number }) {
  const { session, allowLegacy } = await getAuth();
  const q = (input.q ?? '').trim();
  const limit = Math.min(15, Math.max(5, input.limit ?? 10));
  if (!q) return [] as Array<{ id: string; fullName: string; documentId: string | null; photoUrl: string | null }>;

  const qNorm = q.toLowerCase();
  const likeExpr = `%${qNorm.replace(/%/g, '')}%`;

  const whereExpr = sql`
    (lower(${patients.fullName}) like ${likeExpr})
    OR (lower(coalesce(${patients.documentId}, '')) like ${likeExpr})
  `;

  const rows = await db
    .select({ id: patients.id, fullName: patients.fullName, documentId: patients.documentId, photoUrl: patients.photoUrl })
    .from(patients)
    .where(and(whereExpr, ownershipWhere(patients.userId, session.uid, allowLegacy)))
    .orderBy(desc(patients.createdAt))
    .limit(limit)
    .all();

  return rows;
}

// --- NOTE DRAFTS: autosave real en DB ---
export async function loadNoteDraft(patientId: string) {
  try {
    const { session, allowLegacy } = await getAuth();
    // Ownership check on patient
    const p = await db.select({ id: patients.id }).from(patients)
      .where(and(eq(patients.id, patientId), ownershipWhere(patients.userId, session.uid, allowLegacy)))
      .get();
    if (!p) return { success: false, error: 'Sin permisos para este paciente' } as const;

    const rows = await (db as any).all(sql`
      SELECT * FROM note_drafts
      WHERE patient_id = ${patientId}
        AND (user_id = ${session.uid} OR (user_id IS NULL AND ${allowLegacy ? 1 : 0}))
      LIMIT 1
    `) as any[];

    const row = rows?.[0];
    if (!row) return { success: true, draft: null } as const;

    return {
      success: true,
      draft: {
        content: row.content_json ? JSON.parse(row.content_json) : null,
        category: row.category ?? 'seguimiento',
        attachments: row.attachments_json ? JSON.parse(row.attachments_json) : [],
        updatedAt: row.updated_at,
      },
    } as const;
  } catch (e) {
    console.error('Error cargando draft:', e);
    return { success: false, error: 'No se pudo cargar el borrador' } as const;
  }
}

// Carga una nota por inicio de sesión (sessionAt)...
export async function loadNoteBySessionAt(patientId: string, sessionAtIso: string) {
  try {
    const { session, allowLegacy } = await getAuth();
    const d = new Date(sessionAtIso);
    const sessionIso = !Number.isNaN(d.getTime()) ? d.toISOString() : '';
    if (!sessionIso) return { success: false, error: 'Fecha inválida' } as const;

    const p = await db.select({ id: patients.id }).from(patients)
      .where(and(eq(patients.id, patientId), ownershipWhere(patients.userId, session.uid, allowLegacy)))
      .get();
    if (!p) return { success: false, error: 'Sin permisos para este paciente' } as const;

    const row = await db
      .select()
      .from(clinicalNotes)
      .where(and(
        eq(clinicalNotes.patientId, patientId),
        eq(clinicalNotes.sessionAt, sessionIso),
        ownershipWhere(clinicalNotes.userId, session.uid, allowLegacy)
      ))
      .orderBy(desc(clinicalNotes.createdAt))
      .limit(1)
      .all();

    const n = row?.[0];
    if (!n) return { success: true, note: null } as const;
    return {
      success: true,
      note: {
        id: n.id,
        content: (() => {
          try {
            return JSON.parse(n.contentJson);
          } catch {
            return null;
          }
        })(),
        category: n.category,
        mood: n.mood,
        attachments: (() => {
          try {
            return JSON.parse(n.attachmentsJson ?? '[]');
          } catch {
            return [];
          }
        })(),
      },
    } as const;
  } catch (e) {
    console.error('Error cargando nota por sesión:', e);
    return { success: false, error: 'No se pudo cargar la nota' } as const;
  }
}

export async function saveNoteDraft(patientId: string, contentJson: unknown, category: string, attachments: Attachment[] = []) {
  try {
    const { session, allowLegacy } = await getAuth();
    const p = await db.select({ id: patients.id }).from(patients)
      .where(and(eq(patients.id, patientId), ownershipWhere(patients.userId, session.uid, allowLegacy)))
      .get();
    if (!p) return { success: false, error: 'Sin permisos para este paciente' } as const;
    const nowIso = new Date().toISOString();
    // upsert manual (SQLite)
    await (db as any).run(sql`
      INSERT INTO note_drafts (id, user_id, patient_id, content_json, category, attachments_json, updated_at)
      VALUES (${patientId}, ${session.uid}, ${patientId}, ${JSON.stringify(contentJson ?? {})}, ${category ?? 'seguimiento'}, ${JSON.stringify(attachments ?? [])}, ${nowIso})
      ON CONFLICT(id) DO UPDATE SET
        user_id=excluded.user_id,
        content_json=excluded.content_json,
        category=excluded.category,
        attachments_json=excluded.attachments_json,
        updated_at=excluded.updated_at
    `);

    return { success: true } as const;
  } catch (e) {
    console.error('Error guardando draft:', e);
    return { success: false, error: 'No se pudo guardar el borrador' } as const;
  }
}

export async function clearNoteDraft(patientId: string) {
  try {
    const { session, allowLegacy } = await getAuth();
    await (db as any).run(sql`DELETE FROM note_drafts WHERE id = ${patientId} AND (${sql`user_id`} = ${session.uid} OR (${sql`user_id`} IS NULL AND ${allowLegacy ? 1 : 0}))`);
    return { success: true } as const;
  } catch (e) {
    console.error('Error limpiando draft:', e);
    return { success: false, error: 'No se pudo limpiar el borrador' } as const;
  }
}

// --- IMPORTACIÓN DESDE EXCEL (pacientes/base de datos) ---
type ImportReport = {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

function normalizeHeader(h: string) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Simple similarity score based on token overlap. Works well enough for "Nombre" vs "Nombres", etc.
function headerScore(a: string, b: string): number {
  const A = new Set(normalizeHeader(a).split(' ').filter(Boolean));
  const B = new Set(normalizeHeader(b).split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.max(A.size, B.size);
}

const EXPECTED_FIELDS: Array<{ key: string; labels: string[] }> = [
  { key: 'fullName', labels: ['nombre', 'nombres', 'paciente', 'nombre completo', 'full name'] },
  { key: 'documentId', labels: ['documento', 'cedula', 'cc', 'id', 'identificacion', 'id number'] },
  { key: 'phone', labels: ['telefono', 'celular', 'movil', 'contacto', 'contact phone'] },
  { key: 'email', labels: ['correo', 'correo electronico', 'email', 'e mail'] },
  { key: 'sex', labels: ['sexo', 'genero', 'sex', 'gender'] },
  { key: 'status', labels: ['estado', 'status'] },
  { key: 'startDate', labels: ['fecha de inicio', 'inicio', 'start date'] },
  { key: 'closeDate', labels: ['fecha de cierre', 'cierre', 'close date'] },
  { key: 'country', labels: ['pais', 'pais residencia', 'residencia pais', 'country'] },
  { key: 'city', labels: ['ciudad', 'ciudad residencia', 'residencia ciudad', 'city'] },
  { key: 'birthDate', labels: ['fecha de nacimiento', 'nacimiento', 'birth date', 'dob'] },
  { key: 'howArrived', labels: ['como llego', 'como llego?', 'referido', 'referencia', 'canal', 'source'] },
  { key: 'detail', labels: ['detalle', 'observaciones', 'nota', 'comentario', 'comments'] },
];

function mapHeaders(headers: string[]) {
  const mapped: Record<string, number | null> = {};
  for (const f of EXPECTED_FIELDS) {
    let bestIdx: number | null = null;
    let bestScore = 0;
    headers.forEach((h, idx) => {
      for (const label of f.labels) {
        const s = headerScore(h, label);
        if (s > bestScore) {
          bestScore = s;
          bestIdx = idx;
        }
      }
    });
    // require a minimum confidence
    mapped[f.key] = bestScore >= 0.45 ? bestIdx : null;
  }
  return mapped;
}

function parseExcelDate(v: any): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    // Excel date serial
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y && d.m && d.d) {
      const dd = new Date(Date.UTC(d.y, d.m - 1, d.d));
      return dd.toISOString().slice(0, 10);
    }
  }
  const asStr = String(v).trim();
  const d = new Date(asStr);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function normalizeSex(v: any): 'Masculino' | 'Femenino' | 'Otro' | null {
  const s = normalizeHeader(String(v ?? ''));
  if (!s) return null;
  if (s.includes('masc') || s === 'm' || s.includes('hombre')) return 'Masculino';
  if (s.includes('fem') || s === 'f' || s.includes('mujer')) return 'Femenino';
  return 'Otro';
}

function normalizeStatus(v: any): 'activo' | 'cerrado' | 'inactivo' | null {
  const s = normalizeHeader(String(v ?? ''));
  if (!s) return null;
  if (s.includes('cerr')) return 'cerrado';
  if (s.includes('inact')) return 'inactivo';
  if (s.includes('act')) return 'activo';
  return null;
}

// Server Actions are safest with FormData (File is not reliably serializable across client/server boundaries).
export async function importPatientsFromExcel(formData: FormData): Promise<ImportReport> {
  const report: ImportReport = { success: false, created: 0, updated: 0, skipped: 0, errors: [] };
  try {
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return { ...report, success: false, errors: [{ row: 0, message: 'No se recibió el archivo (campo "file")' }] };
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const wsName = wb.SheetNames?.[0];
    if (!wsName) return { ...report, success: false, errors: [{ row: 0, message: 'El archivo no tiene hojas' }] };
    const ws = wb.Sheets[wsName];

    // Read as array-of-arrays to control header mapping
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    const headers = (aoa?.[0] ?? []).map((h: any) => String(h ?? '').trim());
    if (!headers.length) return { ...report, success: false, errors: [{ row: 0, message: 'No se encontraron encabezados' }] };
    const map = mapHeaders(headers);

    // Iterate rows
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const get = (key: string) => {
        const idx = map[key];
        if (typeof idx !== 'number') return '';
        return row[idx];
      };

      const fullName = String(get('fullName') ?? '').trim();
      const documentId = String(get('documentId') ?? '').trim();
      const email = String(get('email') ?? '').trim();

      if (!fullName) {
        report.skipped++;
        continue;
      }

      try {
        // Find existing patient: prefer documentId, then email
        let existingId: string | null = null;
        if (documentId) {
          const ex = await db.select({ id: patients.id }).from(patients).where(eq(patients.documentId, documentId)).limit(1).all();
          existingId = ex?.[0]?.id ?? null;
        }
        if (!existingId && email) {
          const ex = await db.select({ id: patients.id }).from(patients).where(eq(patients.email, email)).limit(1).all();
          existingId = ex?.[0]?.id ?? null;
        }

        const patch = {
          fullName,
          documentId: documentId || null,
          phone: String(get('phone') ?? '').trim() || null,
          email: email || null,
          sex: normalizeSex(get('sex')),
          status: normalizeStatus(get('status')) ?? 'activo',
          startDate: parseExcelDate(get('startDate')),
          closeDate: parseExcelDate(get('closeDate')),
          country: String(get('country') ?? '').trim() || null,
          city: String(get('city') ?? '').trim() || null,
          birthDate: parseExcelDate(get('birthDate')) ?? '1900-01-01',
          howArrived: String(get('howArrived') ?? '').trim() || null,
          detail: String(get('detail') ?? '').trim() || null,
          // sync legacy active flag
          active: (normalizeStatus(get('status')) ?? 'activo') === 'activo',
        };

        if (existingId) {
          await db.update(patients).set({
            fullName: patch.fullName,
            documentId: patch.documentId,
            phone: patch.phone,
            email: patch.email,
            sex: patch.sex,
            status: patch.status,
            startDate: patch.startDate,
            closeDate: patch.closeDate,
            country: patch.country,
            city: patch.city,
            birthDate: patch.birthDate,
            howArrived: patch.howArrived,
            detail: patch.detail,
            active: patch.active as any,
          }).where(eq(patients.id, existingId));
          report.updated++;
        } else {
          const id = randomUUID();
          await db.insert(patients).values({
            id,
            fullName: patch.fullName,
            documentId: patch.documentId,
            phone: patch.phone,
            email: patch.email,
            sex: patch.sex,
            status: patch.status as any,
            startDate: patch.startDate,
            closeDate: patch.closeDate,
            country: patch.country,
            city: patch.city,
            birthDate: patch.birthDate,
            howArrived: patch.howArrived,
            detail: patch.detail,
            type: 'PSY' as any,
            active: patch.active as any,
            createdAt: new Date().toISOString(),
          });
          report.created++;
        }
      } catch (e: any) {
        report.errors.push({ row: r + 1, message: e?.message || 'Error en la fila' });
      }
    }

    report.success = true;
    revalidatePath('/patients');
    revalidatePath('/');
    return report;
  } catch (e: any) {
    console.error('Error importando Excel:', e);
    return { ...report, success: false, errors: [{ row: 0, message: e?.message || 'No se pudo importar' }] };
  }
}

// --- CITAS: edición + validación de solapamientos ---
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

async function hasOverlap(startIso: string, endIso: string, excludeId?: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  // Traer citas cercanas (misma semana) para comparar en memoria
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekEnd = new Date(end);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const rows = await db
    .select({ id: appointments.id, date: appointments.date, endAt: appointments.endAt, status: appointments.status })
    .from(appointments)
    .where(and(gte(appointments.date, weekStart.toISOString()), lte(appointments.date, weekEnd.toISOString())))
    .all();

  for (const r of rows) {
    if (excludeId && r.id === excludeId) continue;
    if (r.status === 'cancelled') continue;
    const s = new Date(r.date);
    const e = new Date(r.endAt ?? new Date(new Date(r.date).getTime() + 60_000 * 60).toISOString());
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      if (overlaps(start, end, s, e)) return true;
    }
  }
  return false;
}

// Extiende createAppointment para aceptar start/end y opcionalmente bloquear solapamientos
export async function createAppointmentPro(input: {
  patientId: string;
  startIso: string;
  endIso: string;
  notes?: string;
  status?: 'pending' | 'done' | 'cancelled';
  allowOverlap?: boolean;
  feeCents?: number;
  paymentStatus?: 'pending' | 'paid';
  paymentMethod?: string;
}) {
  try {
    const id = randomUUID();
    const start = new Date(input.startIso);
    const end = new Date(input.endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { success: false, error: 'Rango de tiempo inválido' } as const;
    }

    if (!input.allowOverlap) {
      const ov = await hasOverlap(start.toISOString(), end.toISOString());
      if (ov)
        return {
          success: false,
          error: 'Ya existe una cita registrada en ese horario. Elige otro espacio o reprograma la cita existente.',
        } as const;
    }

    await db.insert(appointments).values({
      id,
      patientId: input.patientId,
      date: start.toISOString(),
      endAt: end.toISOString(),
      status: input.status ?? 'pending',
      notes: input.notes ?? null,
      feeCents: typeof input.feeCents === 'number' && input.feeCents >= 0 ? Math.round(input.feeCents) : 0,
      paymentStatus: input.paymentStatus ?? 'pending',
      paymentMethod: input.paymentMethod ?? null,
      createdAt: new Date().toISOString(),
    });

    revalidatePath('/');
    return { success: true } as const;
  } catch (e) {
    console.error('Error creando cita:', e);
    return { success: false, error: 'No se pudo crear la cita' } as const;
  }
}

export async function updateAppointmentDetails(input: {
  id: string;
  patientId?: string;
  startIso?: string;
  endIso?: string;
  notes?: string | null;
  status?: 'pending' | 'done' | 'cancelled';
  allowOverlap?: boolean;
  feeCents?: number;
  paymentStatus?: 'pending' | 'paid';
  paymentMethod?: string | null;
}) {
  try {
    // Get existing
    const existing = await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1).all();
    const cur = existing?.[0];
    if (!cur) return { success: false, error: 'Cita no encontrada' } as const;

    const startIso = input.startIso ?? cur.date;
    const endIso = input.endIso ?? (cur.endAt ?? new Date(new Date(cur.date).getTime() + 60_000 * 60).toISOString());
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { success: false, error: 'Rango de tiempo inválido' } as const;
    }

    if (!input.allowOverlap) {
      const ov = await hasOverlap(start.toISOString(), end.toISOString(), input.id);
      if (ov) return { success: false, error: 'Esta hora ya está ocupada. Elige otro horario o reprograma la cita existente.' } as const;
    }

    await db
      .update(appointments)
      .set({
        ...(input.patientId ? { patientId: input.patientId } : {}),
        date: start.toISOString(),
        endAt: end.toISOString(),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.feeCents !== undefined ? { feeCents: Math.max(0, Math.round(input.feeCents)) } : {}),
        ...(input.paymentStatus !== undefined ? { paymentStatus: input.paymentStatus } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
      })
      .where(eq(appointments.id, input.id));

    revalidatePath('/');
    return { success: true } as const;
  } catch (e) {
    console.error('Error editando cita:', e);
    return { success: false, error: 'No se pudo editar la cita' } as const;
  }
}

// -------------------------
// HISTORIA CLÍNICA ESTRUCTURADA
// -------------------------

export async function createClinicalSession(input: {
  patientId: string;
  appointmentId?: string | null;
  sessionAtIso?: string;
  sessionType: 'evaluacion' | 'seguimiento' | 'crisis' | 'alta';
  focus: string;
  subjective: string;
  evaluation: string;
  plan: string;
}) {
  try {
    const id = randomUUID();
    const now = new Date().toISOString();
    const sessionAt = input.sessionAtIso && !Number.isNaN(new Date(input.sessionAtIso).getTime()) ? input.sessionAtIso : now;

    await db.insert(clinicalSessions).values({
      id,
      patientId: input.patientId,
      appointmentId: input.appointmentId ?? null,
      sessionAt,
      sessionType: input.sessionType,
      focus: input.focus ?? '',
      subjective: input.subjective ?? '',
      evaluation: input.evaluation ?? '',
      plan: input.plan ?? '',
      createdAt: now,
    });

    revalidatePath(`/patient/${input.patientId}`);
    revalidatePath('/');
    return { success: true } as const;
  } catch (e) {
    console.error('Error creando sesión clínica:', e);
    return { success: false, error: 'No se pudo guardar la sesión' } as const;
  }
}

export async function updateClinicalSession(input: {
  id: string;
  patientId: string;
  appointmentId?: string | null;
  sessionAtIso?: string;
  sessionType?: 'evaluacion' | 'seguimiento' | 'crisis' | 'alta';
  focus?: string;
  subjective?: string;
  evaluation?: string;
  plan?: string;
}) {
  try {
    await db
      .update(clinicalSessions)
      .set({
        ...(input.appointmentId !== undefined ? { appointmentId: input.appointmentId } : {}),
        ...(input.sessionAtIso !== undefined ? { sessionAt: input.sessionAtIso } : {}),
        ...(input.sessionType !== undefined ? { sessionType: input.sessionType } : {}),
        ...(input.focus !== undefined ? { focus: input.focus } : {}),
        ...(input.subjective !== undefined ? { subjective: input.subjective } : {}),
        ...(input.evaluation !== undefined ? { evaluation: input.evaluation } : {}),
        ...(input.plan !== undefined ? { plan: input.plan } : {}),
      })
      .where(eq(clinicalSessions.id, input.id));

    revalidatePath(`/patient/${input.patientId}`);
    revalidatePath('/');
    return { success: true } as const;
  } catch (e) {
    console.error('Error actualizando sesión clínica:', e);
    return { success: false, error: 'No se pudo actualizar la sesión' } as const;
  }
}

export async function deleteClinicalSession(input: { id: string; patientId: string }) {
  try {
    await (db as any).delete(clinicalSessions).where(eq(clinicalSessions.id, input.id));
    revalidatePath(`/patient/${input.patientId}`);
    revalidatePath('/');
    return { success: true } as const;
  } catch (e) {
    console.error('Error eliminando sesión clínica:', e);
    return { success: false, error: 'No se pudo eliminar la sesión' } as const;
  }
}

// -------------------------
// PAGOS
// -------------------------

export async function listPaymentsForPatient(patientId: string) {
  const rows = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      status: appointments.status,
      feeCents: appointments.feeCents,
      paymentStatus: appointments.paymentStatus,
      paymentMethod: appointments.paymentMethod,
      notes: appointments.notes,
    })
    .from(appointments)
    .where(eq(appointments.patientId, patientId))
    .orderBy(desc(appointments.date))
    .all();
  return rows;
}

export async function updateAppointmentPayment(input: {
  id: string;
  feeCents?: number;
  paymentStatus?: 'pending' | 'paid';
  paymentMethod?: string | null;
}) {
  try {
    await db
      .update(appointments)
      .set({
        ...(input.feeCents !== undefined ? { feeCents: Math.max(0, Math.round(input.feeCents)) } : {}),
        ...(input.paymentStatus !== undefined ? { paymentStatus: input.paymentStatus } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
      })
      .where(eq(appointments.id, input.id));

    revalidatePath('/');
    return { success: true } as const;
  } catch (e) {
    console.error('Error actualizando pago:', e);
    return { success: false, error: 'No se pudo actualizar el pago' } as const;
  }
}
