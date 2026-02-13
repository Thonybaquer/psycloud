import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Usuarios de la app (seguridad básica)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'), // admin | psychologist | assistant
  createdAt: text('created_at').notNull(),
});

// Preferencias por usuario (tema, idioma, formato fecha, tz, etc.)
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id').primaryKey(),
  settingsJson: text('settings_json').notNull().default('{}'),
  updatedAt: text('updated_at').notNull(),
});

// Tokens de recuperación de contraseña (modo local/dev: el token se muestra en pantalla)
export const passwordResets = sqliteTable('password_resets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const patients = sqliteTable('patients', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  fullName: text('full_name').notNull(),
  // IMPORTANT: column names must match src/db/ensureSchema.ts
  // to avoid "no such column" errors when the DB already exists.
  documentId: text('id_number'), // Cédula
  // NOTE: keep DB column as `email` (older builds used contact_email and caused runtime errors)
  email: text('email'),
  phone: text('contact_phone'),
  // Prefer country/city for a cleaner professional profile. Keep `address` column in DB for backwards compatibility.
  country: text('country'),
  city: text('city'),
  // --- Campos de base de datos (solicitados) ---
  sex: text('sex').$type<'Masculino' | 'Femenino' | 'Otro'>(),
  status: text('status').$type<'activo' | 'cerrado' | 'inactivo'>().default('activo'),
  startDate: text('start_date'),
  closeDate: text('close_date'),
  howArrived: text('how_arrived'),
  detail: text('detail'),
  address: text('address'),
  birthDate: text('birth_date').notNull(), // ISO string YYYY-MM-DD
  photoUrl: text('photo_url'),
  type: text('specialty').$type<'PSY' | 'MED'>().default('PSY'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  tagsJson: text('tags_json').notNull().default('[]'),
  // Para métricas: distingue pacientes creados desde el botón "Nuevo paciente"
  // vs importaciones u otros orígenes.
  createdSource: text('created_source')
    .$type<'new_patient' | 'import' | 'other'>()
    .notNull()
    .default('new_patient'),
  createdAt: text('created_at').notNull(), // ISO
});

export const clinicalNotes = sqliteTable('clinical_notes', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  patientId: text('patient_id').notNull(),
  contentJson: text('content_json').notNull(),
  mood: text('mood').notNull().default('📝'),
  // Etiqueta/categoría clínica (ej: evaluación inicial, seguimiento, intervención, crisis)
  category: text('category').notNull().default('seguimiento'),
  attachmentsJson: text('attachments_json').notNull().default('[]'),
  // Hora real de la sesión (se fija cuando se abre el editor de nota)
  sessionAt: text('session_at').notNull(),
  createdAt: text('created_at').notNull(),
});


export const noteDrafts = sqliteTable('note_drafts', {
  id: text('id').primaryKey(), // `${patientId}` (1 draft per patient)
  userId: text('user_id'),
  patientId: text('patient_id').notNull(),
  contentJson: text('content_json').notNull().default('{}'),
  category: text('category').notNull().default('seguimiento'),
  attachmentsJson: text('attachments_json').notNull().default('[]'),
  updatedAt: text('updated_at').notNull(),
});


export const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  patientId: text('patient_id').notNull(),
  // Start datetime (legacy column name kept as `date`)
  date: text('date').notNull(), // ISO datetime
  // End datetime to support variable duration
  endAt: text('end_at'),
  status: text('status').notNull().default('pending'), // pending | done | cancelled
  notes: text('notes'),
  // --- Pagos (simple pero útil) ---
  feeCents: integer('fee_cents').notNull().default(0),
  paymentStatus: text('payment_status').notNull().default('pending'), // pending | paid
  paymentMethod: text('payment_method'), // cash | card | transfer | other
  createdAt: text('created_at').notNull(),
});


export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  // Fecha del gasto (YYYY-MM-DD o ISO)
  date: text('date').notNull(),
  // Texto libre: en qué fue el gasto (ej: arriendo, internet, publicidad, etc.)
  title: text('title').notNull(),
  // Categoría libre (opcional)
  category: text('category'),
  // Método (opcional)
  method: text('method'),
  // Valor en centavos
  amountCents: integer('amount_cents').notNull().default(0),
  // Notas opcionales
  notes: text('notes'),
  // Indica si es recurrente/fijo
  recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
  // Grupo de recurrencia (mismo gasto fijo a lo largo del tiempo)
  recurringGroup: text('recurring_group'),
  // Día del mes preferido (1-31)
  recurringDay: integer('recurring_day'),
  // Mes de inicio (YYYY-MM-DD)
  recurringStart: text('recurring_start'),
  // Marca si esta fila fue generada automáticamente
  autoGenerated: integer('auto_generated', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});


// Historia clínica estructurada (sesiones)

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  actorUserId: text('actor_user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  beforeJson: text('before_json').notNull().default('{}'),
  afterJson: text('after_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
});

export const clinicalSessions = sqliteTable('clinical_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  patientId: text('patient_id').notNull(),
  // Optional link to a calendar appointment
  appointmentId: text('appointment_id'),
  sessionAt: text('session_at').notNull(),
  sessionType: text('session_type').notNull().default('seguimiento'), // evaluacion | seguimiento | crisis | alta
  focus: text('focus').notNull().default(''),
  subjective: text('subjective').notNull().default(''),
  evaluation: text('evaluation').notNull().default(''),
  plan: text('plan').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

export type Patient = typeof patients.$inferSelect;
export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ClinicalSession = typeof clinicalSessions.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export type NoteDraft = typeof noteDrafts.$inferSelect;
