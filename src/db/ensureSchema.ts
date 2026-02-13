import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getExistingColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map(r => r.name));
}

function ensureColumns(db: Database.Database, table: string, cols: Array<{ name: string; ddl: string }>) {
  const existing = getExistingColumns(db, table);
  for (const c of cols) {
    if (!existing.has(c.name)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${c.ddl}`).run();
    }
  }
}

export function ensureSchema() {
  // IMPORTANT: use the same DB path resolution as src/db/index.ts
  // Otherwise, schema migrations may run on a different file and the app will crash
  // with "no such column" errors.
  const dbPath = process.env.SQLITE_DB_PATH
    ? path.resolve(process.env.SQLITE_DB_PATH)
    : path.resolve(process.cwd(), 'data', 'psycloud.db');

  ensureDir(path.dirname(dbPath));
  const sqlite = new Database(dbPath);

  // -------------------------
  // USERS (AUTH)
  // -------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );
  `);

  // Unique email index (best-effort)
  try {
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);`);
  } catch {
    // ignore
  }

  // -------------------------
  // USER SETTINGS
  // -------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
  `);

  // -------------------------
  // PASSWORD RESETS (local/dev)
  // -------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // -------------------------
  // PATIENTS
  // -------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      specialty TEXT,
      birth_date TEXT,
      contact_phone TEXT,
      email TEXT,
      id_number TEXT,
      address TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      tags_json TEXT NOT NULL DEFAULT '[]',
      country TEXT,
      city TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      photo_url TEXT,
      created_at TEXT NOT NULL
    );
  `);

  ensureColumns(sqlite, 'patients', [
    // Multi-tenant ownership
    { name: 'user_id', ddl: 'user_id TEXT' },
    { name: 'specialty', ddl: 'specialty TEXT' },
    { name: 'birth_date', ddl: 'birth_date TEXT' },
    { name: 'contact_phone', ddl: 'contact_phone TEXT' },
    { name: 'email', ddl: 'email TEXT' },
    // Cédula / identificación
    { name: 'id_number', ddl: 'id_number TEXT' },
    // Backwards compatibility (older DBs may have used document_id)
    { name: 'document_id', ddl: 'document_id TEXT' },
    { name: 'address', ddl: 'address TEXT' },
    { name: 'country', ddl: 'country TEXT' },
    // Active flag used by the app (Drizzle schema expects it)
    { name: 'active', ddl: 'active INTEGER NOT NULL DEFAULT 1' },
    // Tags/memory JSON used by the app (Drizzle schema expects it)
    { name: 'tags_json', ddl: "tags_json TEXT NOT NULL DEFAULT '[]'" },
    { name: 'city', ddl: 'city TEXT' },
    { name: 'emergency_contact_name', ddl: 'emergency_contact_name TEXT' },
    { name: 'emergency_contact_phone', ddl: 'emergency_contact_phone TEXT' },
    { name: 'photo_url', ddl: 'photo_url TEXT' },
    // --- Campos solicitados para Base de datos ---
    { name: 'sex', ddl: "sex TEXT" },
    { name: 'status', ddl: "status TEXT NOT NULL DEFAULT 'activo'" },
    { name: 'start_date', ddl: 'start_date TEXT' },
    { name: 'close_date', ddl: 'close_date TEXT' },
    { name: 'how_arrived', ddl: 'how_arrived TEXT' },
    { name: 'detail', ddl: 'detail TEXT' },
    // Para KPIs: solo contar como "Nuevo" cuando se crea desde el botón "Nuevo paciente"
    { name: 'created_source', ddl: "created_source TEXT NOT NULL DEFAULT 'other'" },
    { name: 'created_at', ddl: "created_at TEXT NOT NULL DEFAULT (datetime('now'))" },
  ]);

  // Índices para búsqueda de pacientes
  try {
    sqlite.exec(`CREATE INDEX IF NOT EXISTS patients_name_idx ON patients(full_name);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS patients_document_idx ON patients(id_number);`);
  } catch {
    // ignore
  }

  // Normalización de `created_source`:
  // Si la columna se agregó a una BD existente, SQLite rellenará el DEFAULT.
  // Eso puede marcar TODOS los pacientes antiguos como 'new_patient', inflando el contador.
  // Heurística: si existen pacientes y no hay ningún 'import'/'other', asumimos que viene de migración
  // y marcamos como 'other' para que "Nuevos" cuente solo los creados desde el botón.
  try {
    const total = sqlite.prepare(`SELECT COUNT(*) as c FROM patients`).get() as any;
    const nonNew = sqlite
      .prepare(`SELECT COUNT(*) as c FROM patients WHERE created_source IN ('import','other')`)
      .get() as any;

    if ((Number(total?.c ?? 0) || 0) > 0 && (Number(nonNew?.c ?? 0) || 0) === 0) {
      sqlite.prepare(`UPDATE patients SET created_source='other' WHERE created_source='new_patient'`).run();
    }
  } catch {
    // ignore
  }


  // -------------------------
  // CLINICAL NOTES
  // -------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clinical_notes (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      content_json TEXT NOT NULL,
      mood TEXT NOT NULL DEFAULT '📝',
      category TEXT NOT NULL DEFAULT 'seguimiento',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      session_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );
  `);

  ensureColumns(sqlite, 'clinical_notes', [
    { name: 'user_id', ddl: 'user_id TEXT' },
    { name: 'mood', ddl: "mood TEXT NOT NULL DEFAULT '📝'" },
    { name: 'category', ddl: "category TEXT NOT NULL DEFAULT 'seguimiento'" },
    { name: 'attachments_json', ddl: 'attachments_json TEXT' },
    { name: 'session_at', ddl: "session_at TEXT NOT NULL DEFAULT (datetime('now'))" },
    { name: 'created_at', ddl: "created_at TEXT NOT NULL DEFAULT (datetime('now'))" },
  ]);

  
  // -------------------------
  // NOTE DRAFTS (autosave in DB)
  // -------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS note_drafts (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      content_json TEXT NOT NULL DEFAULT '{}',
      category TEXT NOT NULL DEFAULT 'seguimiento',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );
  `);

  ensureColumns(sqlite, 'note_drafts', [
    { name: 'user_id', ddl: 'user_id TEXT' },
    { name: 'content_json', ddl: "content_json TEXT NOT NULL DEFAULT '{}'" },
    { name: 'category', ddl: "category TEXT NOT NULL DEFAULT 'seguimiento'" },
    { name: 'attachments_json', ddl: "attachments_json TEXT NOT NULL DEFAULT '[]'" },
    { name: 'updated_at', ddl: "updated_at TEXT NOT NULL DEFAULT (datetime('now'))" },
  ]);


// -------------------------
  // APPOINTMENTS
  // -------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      date TEXT NOT NULL,
      end_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      fee_cents INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );
  `);

  ensureColumns(sqlite, 'appointments', [
    { name: 'user_id', ddl: 'user_id TEXT' },
    { name: 'end_at', ddl: 'end_at TEXT' },
    { name: 'status', ddl: "status TEXT NOT NULL DEFAULT 'pending'" },
    { name: 'notes', ddl: 'notes TEXT' },
    { name: 'fee_cents', ddl: 'fee_cents INTEGER NOT NULL DEFAULT 0' },
    { name: 'payment_status', ddl: "payment_status TEXT NOT NULL DEFAULT 'pending'" },
    { name: 'payment_method', ddl: 'payment_method TEXT' },
    { name: 'created_at', ddl: "created_at TEXT NOT NULL DEFAULT (datetime('now'))" },
  ]);

  // Índices para mejorar rendimiento (agenda/calendario)
  try {
    sqlite.exec(`CREATE INDEX IF NOT EXISTS appts_date_idx ON appointments(date);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS appts_patient_date_idx ON appointments(patient_id, date);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS appts_status_idx ON appointments(status);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS appts_pay_status_idx ON appointments(payment_status);`);
  } catch {
    // ignore
  }


  // -------------------------
  // EXPENSES (egresos)
  // -------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT,
      method TEXT,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      recurring INTEGER NOT NULL DEFAULT 0,
      recurring_group TEXT,
      recurring_day INTEGER,
      recurring_start TEXT,
      auto_generated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureColumns(sqlite, 'expenses', [
    { name: 'user_id', ddl: 'user_id TEXT' },
    { name: 'date', ddl: 'date TEXT NOT NULL' },
    { name: 'title', ddl: 'title TEXT NOT NULL' },
    { name: 'category', ddl: 'category TEXT' },
    { name: 'method', ddl: 'method TEXT' },
    { name: 'amount_cents', ddl: 'amount_cents INTEGER NOT NULL DEFAULT 0' },
    { name: 'notes', ddl: 'notes TEXT' },
    { name: 'recurring', ddl: 'recurring INTEGER NOT NULL DEFAULT 0' },
    { name: 'recurring_group', ddl: 'recurring_group TEXT' },
    { name: 'recurring_day', ddl: 'recurring_day INTEGER' },
    { name: 'recurring_start', ddl: 'recurring_start TEXT' },
    { name: 'auto_generated', ddl: 'auto_generated INTEGER NOT NULL DEFAULT 0' },
    { name: 'created_at', ddl: "created_at TEXT NOT NULL DEFAULT (datetime('now'))" },
    { name: 'updated_at', ddl: "updated_at TEXT NOT NULL DEFAULT (datetime('now'))" },
  ]);

  // Performance indexes (best-effort, safe to run repeatedly)
  try { sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_patients_user_fullname ON patients(user_id, full_name);`); } catch {}
  try { sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON appointments(user_id, date);`); } catch {}
  try { sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_notes_user_patient_session ON clinical_notes(user_id, patient_id, session_at);`); } catch {}
  try { sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_drafts_user_patient_updated ON note_drafts(user_id, patient_id, updated_at);`); } catch {}
  try { sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);`); } catch {}

  // -------------------------
  // CLINICAL SESSIONS (structured history)
  // -------------------------
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clinical_sessions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      appointment_id TEXT,
      session_at TEXT NOT NULL,
      session_type TEXT NOT NULL DEFAULT 'seguimiento',
      focus TEXT NOT NULL DEFAULT '',
      subjective TEXT NOT NULL DEFAULT '',
      evaluation TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );
  `);

  ensureColumns(sqlite, 'clinical_sessions', [
    { name: 'user_id', ddl: 'user_id TEXT' },
    { name: 'appointment_id', ddl: 'appointment_id TEXT' },
    { name: 'session_at', ddl: "session_at TEXT NOT NULL DEFAULT (datetime('now'))" },
    { name: 'session_type', ddl: "session_type TEXT NOT NULL DEFAULT 'seguimiento'" },
    { name: 'focus', ddl: "focus TEXT NOT NULL DEFAULT ''" },
    { name: 'subjective', ddl: "subjective TEXT NOT NULL DEFAULT ''" },
    { name: 'evaluation', ddl: "evaluation TEXT NOT NULL DEFAULT ''" },
    { name: 'plan', ddl: "plan TEXT NOT NULL DEFAULT ''" },
    { name: 'created_at', ddl: "created_at TEXT NOT NULL DEFAULT (datetime('now'))" },
  ]);


  // Audit logs (security & change log)
  sqlite.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    actor_user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    before_json TEXT NOT NULL DEFAULT '{}',
    after_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs(user_id, created_at);`);

  // Indexes
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_patients_user_created ON patients(user_id, created_at);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_notes_patient_created ON clinical_notes(patient_id, created_at);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_notes_user_session ON clinical_notes(user_id, session_at);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_appt_patient_date ON appointments(patient_id, date);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_appt_user_date ON appointments(user_id, date);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_draft_patient_updated ON note_drafts(patient_id, updated_at);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_patient_sessionat ON clinical_sessions(patient_id, session_at);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_sessionat ON clinical_sessions(user_id, session_at);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_appt ON clinical_sessions(appointment_id);`);

  sqlite.close();
}
