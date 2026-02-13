
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Lang = 'es' | 'en';

type Dict = Record<string, string>;

const ES: Dict = {
  'common.loading': 'Cargando…',
  'common.prev': 'Anterior',
  'common.next': 'Siguiente',
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  'common.delete': 'Eliminar',
  'common.edit': 'Editar',

  'patients.title': 'Pacientes',
  'patients.subtitle': 'Búsqueda rápida + paginación (server-side)',
  'patients.searchPlaceholder': 'Buscar por nombre o documento…',
  'patients.noDocument': 'Sin documento',
  'patients.viewMore': 'Ver más resultados',
  'patients.empty': 'No hay pacientes para mostrar',
  'patients.resultsCount': '{shown} mostrados · {total} total',

  'dashboard.title': 'PsyCloud',
  'dashboard.subtitle': 'Organizador clínico (local)',
  'dashboard.metrics.today': 'Citas hoy',
  'dashboard.metrics.week': 'Citas esta semana',
  'dashboard.metrics.patients': 'Pacientes registrados',
  'dashboard.metrics.noFuture': 'Sin cita futura',

  'calendar.title': 'Calendario',
  'calendar.subtitle': 'Selecciona un rango para crear · clic para ver/editar · arrastra/estira para reprogramar',
  'calendar.settings': 'Ajustes',
  'calendar.workHours': 'Horario laboral',
  'calendar.allowOverlap': 'Permitir solapamientos',
  'calendar.warnOverlap': 'Se detectó un solapamiento',
  'calendar.created': 'Cita creada',
  'calendar.updated': 'Cita actualizada',
  'calendar.deleted': 'Cita eliminada',

  'calendar.today': 'Hoy',
  'calendar.month': 'Mes',
  'calendar.week': 'Semana',
  'calendar.day': 'Día',
  'calendar.paid': 'Pagado',
  'calendar.pending': 'Pendiente',
  'calendar.settingsSaved': 'Ajustes guardados',

  'auth.forgotPassword': '¿Olvidaste tu contraseña?',
  'auth.resetPassword': 'Restablecer contraseña',
  'auth.sendResetLink': 'Enviar código',
  'auth.backToLogin': 'Volver a iniciar sesión',
  'auth.newPassword': 'Nueva contraseña',
  'auth.confirmPassword': 'Confirmar contraseña',
  'auth.currentPassword': 'Contraseña actual',
  'auth.changePassword': 'Cambiar contraseña',
  'auth.passwordUpdated': 'Contraseña actualizada',
  'auth.invalidResetToken': 'El código es inválido o expiró',

  'settings.title': 'Ajustes',
  'settings.general': 'General',
  'settings.account': 'Cuenta',
  'settings.security': 'Seguridad',
  'settings.data': 'Datos',
  'settings.notifications': 'Notificaciones',
  'settings.language': 'Idioma',
  'settings.theme': 'Tema',
  'settings.timezone': 'Zona horaria',
  'settings.dateFormat': 'Formato de fecha',
  'settings.backup': 'Copias de seguridad',
  'settings.export': 'Exportar datos',
  'settings.import': 'Importar datos',
  'settings.session': 'Gestión de sesión',
  'settings.logout': 'Cerrar sesión',
  'settings.saved': 'Guardado',
  'settings.saveChanges': 'Guardar cambios',

  'notes.placeholder': 'Escribe tu nota clínica aquí…',
  'notes.autocomplete': 'Sugerencias',

  'notes.templates': 'Plantillas',
  'notes.soap': 'SOAP',
  'notes.progress': 'Evolución',
  'notes.initial': 'Evaluación inicial',
  'notes.category': 'Categoría',
  'notes.attach': 'Adjuntar',
  'notes.voice': 'Voz',
  'notes.stop': 'Detener',
  'notes.saved': 'Nota guardada',
  'notes.draftSaved': 'Borrador guardado',

  'errors.loadPatients': 'No se pudieron cargar pacientes',
};

const EN: Dict = {
  'common.loading': 'Loading…',
  'common.prev': 'Prev',
  'common.next': 'Next',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',

  'patients.title': 'Patients',
  'patients.subtitle': 'Fast search + server-side pagination',
  'patients.searchPlaceholder': 'Search by name or document…',
  'patients.noDocument': 'No document',
  'patients.viewMore': 'View more results',
  'patients.empty': 'No patients to display',
  'patients.resultsCount': '{shown} shown · {total} total',

  'dashboard.title': 'PsyCloud',
  'dashboard.subtitle': 'Clinical organizer (local)',
  'dashboard.metrics.today': "Today's appointments",
  'dashboard.metrics.week': 'This week',
  'dashboard.metrics.patients': 'Registered patients',
  'dashboard.metrics.noFuture': 'No future appointment',

  'calendar.title': 'Calendar',
  'calendar.subtitle': 'Select a time range to create · click to view/edit · drag/resize to reschedule',
  'calendar.settings': 'Settings',
  'calendar.workHours': 'Work hours',
  'calendar.allowOverlap': 'Allow overlaps',
  'calendar.warnOverlap': 'Overlap detected',
  'calendar.created': 'Appointment created',
  'calendar.updated': 'Appointment updated',
  'calendar.deleted': 'Appointment deleted',

  'calendar.today': 'Today',
  'calendar.month': 'Month',
  'calendar.week': 'Week',
  'calendar.day': 'Day',
  'calendar.paid': 'Paid',
  'calendar.pending': 'Pending',
  'calendar.settingsSaved': 'Settings saved',

  'auth.forgotPassword': 'Forgot your password?',
  'auth.resetPassword': 'Reset password',
  'auth.sendResetLink': 'Send code',
  'auth.backToLogin': 'Back to login',
  'auth.newPassword': 'New password',
  'auth.confirmPassword': 'Confirm password',
  'auth.currentPassword': 'Current password',
  'auth.changePassword': 'Change password',
  'auth.passwordUpdated': 'Password updated',
  'auth.invalidResetToken': 'The code is invalid or expired',

  'settings.title': 'Settings',
  'settings.general': 'General',
  'settings.account': 'Account',
  'settings.security': 'Security',
  'settings.data': 'Data',
  'settings.notifications': 'Notifications',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.timezone': 'Time zone',
  'settings.dateFormat': 'Date format',
  'settings.session': 'Session',
  'settings.logout': 'Log out',
  'settings.export': 'Export data',
  'settings.import': 'Import data',
  'settings.backup': 'Backups',
  'settings.restore': 'Restore',
  'settings.confirmAction': 'Confirm action',
  'settings.saveChanges': 'Save changes',
  'settings.saved': 'Saved',
  'settings.changePasswordHelp': 'Update your password securely',
  'settings.notificationsHelp': 'Control reminders and alerts',

  'notes.templates': 'Templates',
  'notes.soap': 'SOAP',
  'notes.progress': 'Progress note',
  'notes.initial': 'Initial eval',
  'notes.category': 'Category',
  'notes.attach': 'Attach',
  'notes.voice': 'Voice',
  'notes.stop': 'Stop',
  'notes.placeholder': 'Write your clinical note here…',
  'notes.saved': 'Note saved',
  'notes.draftSaved': 'Draft saved',

  'errors.loadPatients': 'Could not load patients',
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, any>) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('psycloud:lang') as Lang | null;
      if (saved === 'es' || saved === 'en') setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('psycloud:lang', l); } catch {}
    try { document.documentElement.lang = l; } catch {}
  };

  const dict = lang === 'en' ? EN : ES;

  const t = (key: string, vars?: Record<string, any>) => {
    let s = dict[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replaceAll(`{${k}}`, String(v));
      }
    }
    return s;
  };

  const value = useMemo(() => ({ lang, setLang, t }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return { lang: 'es' as Lang, setLang: (_: Lang) => {}, t: (k: string) => k };
  }
  return ctx;
}
