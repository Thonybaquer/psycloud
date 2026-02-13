'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { saveMySettings, changeMyPassword } from '@/app/settings/actions';
import { useI18n } from '@/lib/i18n';
import { useTheme, type Theme } from '@/lib/theme';

type Settings = {
  lang?: 'es' | 'en';
  theme?: Theme;
  timezone?: string;
  dateFormat?: string;
  notifications?: {
    email?: boolean;
    upcomingAppointments?: boolean;
  };
  ui?: {
    size?: 'compact' | 'normal' | 'large';
    zoom?: number;
  };
  money?: {
    decimals?: number; // 0-2
  };
  security?: {
    appLockEnabled?: boolean;
    autoLockMinutes?: number;
    rememberMinutes?: number;
    hasPin?: boolean; // derived
    dbEncrypted?: boolean; // desktop only
  };
};

function getTimezones(): string[] {
  try {
    // Some runtimes support this; fallback keeps things working.
    // @ts-ignore
    const list = Intl.supportedValuesOf?.('timeZone');
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  return [
    'UTC',
    'America/Bogota',
    'America/Mexico_City',
    'America/Lima',
    'America/New_York',
    'Europe/Madrid',
    'Europe/Rome',
  ];
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const { t, lang: activeLang, setLang } = useI18n();
  const { theme: activeTheme, setTheme } = useTheme();

  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const [lang, setLangLocal] = useState<'es' | 'en'>(initial.lang ?? activeLang ?? 'es');
  const [theme, setThemeLocal] = useState<Theme>((initial.theme as Theme) ?? activeTheme ?? 'system');
  const [timezone, setTimezone] = useState(initial.timezone ?? '');
  const [dateFormat, setDateFormat] = useState(initial.dateFormat ?? 'YYYY-MM-DD');
  const [notifyEmail, setNotifyEmail] = useState(Boolean(initial.notifications?.email));
  const [notifyUpcoming, setNotifyUpcoming] = useState(Boolean(initial.notifications?.upcomingAppointments));
  const [uiSize, setUiSize] = useState<'compact' | 'normal' | 'large'>((initial.ui?.size as any) ?? 'normal');
  const [uiZoom, setUiZoom] = useState<number>(Number(initial.ui?.zoom ?? 100));
  const [moneyDecimals, setMoneyDecimals] = useState<number>(Number(initial.money?.decimals ?? 0));

  // App lock (PIN)
  const [appLockEnabled, setAppLockEnabled] = useState<boolean>(Boolean(initial.security?.appLockEnabled));
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(Number(initial.security?.autoLockMinutes ?? 10));
  const [rememberMinutes, setRememberMinutes] = useState<number>(Number(initial.security?.rememberMinutes ?? 15));
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [dbEncrypted, setDbEncrypted] = useState<boolean>(Boolean(initial.security?.dbEncrypted));

  // Password change
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const timezones = useMemo(() => getTimezones(), []);

  useEffect(() => {
    // Keep UI language/theme coherent immediately (no mixed strings).
    setLang(lang);
    setTheme(theme);
    try {
      localStorage.setItem('psycloud:lang', lang);
      localStorage.setItem('psycloud:theme', theme);
      localStorage.setItem('psycloud:uiSize', uiSize);
      localStorage.setItem('psycloud:uiZoom', String(uiZoom));
      localStorage.setItem('psycloud:moneyDecimals', String(moneyDecimals));
      localStorage.setItem('psycloud:appLockEnabled', appLockEnabled ? '1' : '0');
      localStorage.setItem('psycloud:autoLockMinutes', String(autoLockMinutes));
      localStorage.setItem('psycloud:rememberMinutes', String(rememberMinutes));
    } catch {}

    // Apply UI sizing immediately
    try {
      const html = document.documentElement;
      html.classList.remove('pc-ui-compact', 'pc-ui-normal', 'pc-ui-large');
      html.classList.add(uiSize === 'compact' ? 'pc-ui-compact' : uiSize === 'large' ? 'pc-ui-large' : 'pc-ui-normal');
      const z = Math.max(80, Math.min(140, Math.round(Number(uiZoom) || 100)));
      (document.documentElement.style as any).zoom = String(z / 100);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, theme, uiSize, uiZoom, moneyDecimals, appLockEnabled, autoLockMinutes, rememberMinutes]);
  useEffect(() => {
    (async () => {
      try {
        const api = (window as any).psycloudDesktop;
        if (!api?.encryptionStatus) return;
        const res = await api.encryptionStatus();
        if (typeof res?.enabled === 'boolean') setDbEncrypted(res.enabled);
      } catch {}
    })();
  }, []);

  return (
    <div className="space-y-8">
      {/* GENERAL */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('settings.general')}</h2>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('settings.language')}</label>
            <select
              name="lang"
              value={lang}
              onChange={(e) => setLangLocal(e.target.value as any)}
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('settings.theme')}</label>
            <select
              name="theme"
              value={theme}
              onChange={(e) => setThemeLocal(e.target.value as Theme)}
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="system">{activeLang === 'en' ? 'System' : 'Sistema'}</option>
              <option value="light">{activeLang === 'en' ? 'Light' : 'Claro'}</option>
              <option value="dark">{activeLang === 'en' ? 'Dark' : 'Oscuro'}</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('settings.timezone')}</label>
            <select
              name="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="">{activeLang === 'en' ? 'Auto (system)' : 'Automática (sistema)'}</option>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('settings.dateFormat')}</label>
            <select
              name="dateFormat"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </div>
        </div>

        <form
          action={(formData) => {
            setDone('');
            setError('');
            startTransition(async () => {
              const res = await saveMySettings(formData);
              if (!res.success) {
                setError((res as any).error ?? (activeLang === 'en' ? 'Could not save' : 'No se pudo guardar'));
                return;
              }
              setDone(activeLang === 'en' ? t('settings.saved') : t('settings.saved'));
            });
          }}
          className="mt-4"
        >
          {/* Ensure values are submitted even if user didn't touch the field */}
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="theme" value={theme} />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="dateFormat" value={dateFormat} />
          <input type="hidden" name="uiSize" value={uiSize} />
          <input type="hidden" name="uiZoom" value={String(uiZoom)} />
          <input type="hidden" name="moneyDecimals" value={String(moneyDecimals)} />
          <input type="hidden" name="appLockEnabled" value={appLockEnabled ? "on" : "off"} />
          <input type="hidden" name="autoLockMinutes" value={String(autoLockMinutes)} />
          <input type="hidden" name="rememberMinutes" value={String(rememberMinutes)} />
          <input type="hidden" name="moneyDecimals" value={String(moneyDecimals)} />
          <input type="hidden" name="appLockEnabled" value={appLockEnabled ? "on" : "off"} />
          <input type="hidden" name="autoLockMinutes" value={String(autoLockMinutes)} />
          <input type="hidden" name="rememberMinutes" value={String(rememberMinutes)} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {pending ? t('common.loading') : t('settings.saveChanges')}
            </button>
            {done ? <span className="text-sm" style={{ color: 'var(--pc-muted)' }}>{done}</span> : null}
            {error ? <span className="text-sm text-red-600 dark:text-red-400">{error}</span> : null}
          </div>
        </form>
      </section>



{/* APPEARANCE */}
<section>
  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{activeLang === 'en' ? 'Appearance' : 'Interfaz'}</h2>
  <p className="text-sm mt-1" style={{ color: 'var(--pc-muted)' }}>
    {activeLang === 'en'
      ? 'Adjust text size and zoom to fit your screen.'
      : 'Ajusta tamaño de letra y zoom para tu pantalla.'}
  </p>

  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{activeLang === 'en' ? 'Text size' : 'Tamaño de letra'}</label>
      <select
        name="uiSize"
        value={uiSize}
        onChange={(e) => setUiSize(e.target.value as any)}
        className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
      >
        <option value="compact">{activeLang === 'en' ? 'Compact' : 'Compacto'}</option>
        <option value="normal">{activeLang === 'en' ? 'Normal' : 'Normal'}</option>
        <option value="large">{activeLang === 'en' ? 'Large' : 'Grande'}</option>
      </select>
    </div>

    <div>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{activeLang === 'en' ? 'Zoom' : 'Zoom'}</label>
      <div className="mt-1 flex items-center gap-3">
        <input
          name="uiZoom"
          type="range"
          min={80}
          max={140}
          value={uiZoom}
          onChange={(e) => setUiZoom(Number(e.target.value))}
          className="w-full"
        />
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-[56px] text-right">{Math.round(uiZoom)}%</div>
      </div>
    
  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{activeLang === 'en' ? 'Money decimals' : 'Decimales de dinero'}</label>
      <select
        name="moneyDecimals"
        value={String(moneyDecimals)}
        onChange={(e) => setMoneyDecimals(Number(e.target.value))}
        className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
      >
        <option value="0">{activeLang === 'en' ? '0 (e.g. 120000)' : '0 (ej: 120000)'}</option>
        <option value="1">{activeLang === 'en' ? '1 (e.g. 120000.5)' : '1 (ej: 120000.5)'}</option>
        <option value="2">{activeLang === 'en' ? '2 (e.g. 120000.50)' : '2 (ej: 120000.50)'}</option>
      </select>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
        {activeLang === 'en' ? 'All values are saved as cents internally.' : 'Internamente todo se guarda en centavos.'}
      </div>
    </div>
  </div>
</div>
  </div>

  <div className="mt-4 pc-card bg-white dark:bg-slate-950">
    <h3 className="font-bold text-slate-800 dark:text-slate-100">{activeLang === 'en' ? 'Backups' : 'Respaldo'}</h3>
    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
      {activeLang === 'en'
        ? 'Export a backup of your local database or restore one. (Desktop app only)'
        : 'Exporta un respaldo de la base de datos local o restaura uno. (Solo app de escritorio)'}
    </p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            const api = (window as any).psycloudDesktop;
            if (!api?.exportBackup) {
              setError(activeLang === 'en' ? 'Backup is only available in the Desktop app.' : 'El respaldo solo está disponible en la app de escritorio.');
              return;
            }
            const res = await api.exportBackup();
            if (res?.ok) setDone(activeLang === 'en' ? 'Backup exported.' : 'Respaldo exportado.');
          } catch (e: any) {
            setError(e?.message ?? (activeLang === 'en' ? 'Could not export backup' : 'No se pudo exportar el respaldo'));
          }
        }}
        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-semibold"
      >
        {activeLang === 'en' ? 'Export backup' : 'Exportar respaldo'}
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            const api = (window as any).psycloudDesktop;
            if (!api?.importBackup) {
              setError(activeLang === 'en' ? 'Restore is only available in the Desktop app.' : 'La restauración solo está disponible en la app de escritorio.');
              return;
            }
            setDone(activeLang === 'en' ? 'Restoring… the app will restart.' : 'Restaurando… la app se reiniciará.');
            await api.importBackup();
          } catch (e: any) {
            setError(e?.message ?? (activeLang === 'en' ? 'Could not restore backup' : 'No se pudo restaurar el respaldo'));
          }
        }}
        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
      >
        {activeLang === 'en' ? 'Restore backup' : 'Restaurar respaldo'}
      </button>
    </div>
    <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">
      {activeLang === 'en'
        ? 'Restoring replaces your local database and restarts the app.'
        : 'Restaurar reemplaza tu base de datos local y reinicia la app.'}
    </div>
  </div>
</section>

      {/* SECURITY */}
      <section>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('settings.security')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--pc-muted)' }}>{t('settings.changePasswordHelp')}</p>

        <div className="mt-4 pc-card bg-white dark:bg-slate-950">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{activeLang === 'en' ? 'App lock (PIN)' : 'Bloqueo con PIN'}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            {activeLang === 'en'
              ? 'Require a PIN to open the app on this device. Includes auto-lock when inactive.'
              : 'Pide un PIN al abrir la app en este equipo. Incluye auto-bloqueo por inactividad.'}
          </p>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 md:col-span-3">
              <input type="checkbox" checked={appLockEnabled} onChange={(e) => setAppLockEnabled(e.target.checked)} />
              {activeLang === 'en' ? 'Enable app lock' : 'Activar bloqueo'}
            </label>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{activeLang === 'en' ? 'Auto-lock (minutes)' : 'Auto-bloqueo (minutos)'}</label>
              <select
                value={String(autoLockMinutes)}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
              >
                <option value="0">{activeLang === 'en' ? 'Off' : 'Apagado'}</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="30">30</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{activeLang === 'en' ? 'Remember unlock' : 'Recordar desbloqueo'}</label>
              <select
                value={String(rememberMinutes)}
                onChange={(e) => setRememberMinutes(Number(e.target.value))}
                className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
              >
                <option value="0">{activeLang === 'en' ? 'Ask every time' : 'Pedir siempre'}</option>
                <option value="5">5 min</option>
                <option value="15">15 min</option>
                <option value="60">60 min</option>
                <option value="240">4 h</option>
              </select>
            </div>

            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{activeLang === 'en' ? 'New PIN' : 'Nuevo PIN'}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinNew}
                  onChange={(e) => setPinNew(e.target.value)}
                  className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
                  placeholder={activeLang === 'en' ? '4-10 digits' : '4-10 dígitos'}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{activeLang === 'en' ? 'Confirm PIN' : 'Confirmar PIN'}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                  className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setPinMsg('');
                    try {
                      if (!pinNew || pinNew.length < 4) {
                        setPinMsg(activeLang === 'en' ? 'PIN too short.' : 'PIN muy corto.');
                        return;
                      }
                      if (pinNew !== pinConfirm) {
                        setPinMsg(activeLang === 'en' ? 'PINs do not match.' : 'Los PIN no coinciden.');
                        return;
                      }
                      const res = await fetch('/api/security/set-pin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pin: pinNew, appLockEnabled, autoLockMinutes, rememberMinutes }),
                      });
                      if (!res.ok) throw new Error('bad');
                      setPinNew('');
                      setPinConfirm('');
                      setPinMsg(activeLang === 'en' ? 'PIN saved.' : 'PIN guardado.');
                    } catch (e: any) {
                      setPinMsg(e?.message ?? (activeLang === 'en' ? 'Could not save PIN.' : 'No se pudo guardar el PIN.'));
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold"
                >
                  {activeLang === 'en' ? 'Save PIN' : 'Guardar PIN'}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setPinMsg('');
                    try {
                      const res = await fetch('/api/security/clear-pin', { method: 'POST' });
                      if (!res.ok) throw new Error('bad');
                      setPinMsg(activeLang === 'en' ? 'PIN removed.' : 'PIN eliminado.');
                    } catch {
                      setPinMsg(activeLang === 'en' ? 'Could not remove PIN.' : 'No se pudo eliminar el PIN.');
                    }
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold"
                >
                  {activeLang === 'en' ? 'Remove PIN' : 'Quitar PIN'}
                </button>
              </div>
            </div>

            <div className="md:col-span-3 flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{activeLang === 'en' ? 'Encrypt local database' : 'Encriptar base de datos local'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-300">
                  {activeLang === 'en'
                    ? 'Desktop only. Uses your PIN as the key (stored in OS keychain).'
                    : 'Solo escritorio. Usa tu PIN como clave (guardada en el llavero del sistema).'}
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setPinMsg('');
                  try {
                    const api = (window as any).psycloudDesktop;
                    if (!api?.enableDbEncryption) {
                      setPinMsg(activeLang === 'en' ? 'Encryption is only available in the Desktop app.' : 'La encriptación solo está disponible en la app de escritorio.');
                      return;
                    }
                    if (!pinNew) {
                      setPinMsg(activeLang === 'en' ? 'Enter your PIN in "New PIN" to enable encryption.' : 'Escribe tu PIN en "Nuevo PIN" para activar la encriptación.');
                      return;
                    }
                    if (!dbEncrypted) {
                      await api.enableDbEncryption({ pin: pinNew });
                      setDbEncrypted(true);
                      setPinMsg(activeLang === 'en' ? 'Encryption enabled.' : 'Encriptación activada.');
                    } else {
                      await api.disableDbEncryption();
                      setDbEncrypted(false);
                      setPinMsg(activeLang === 'en' ? 'Encryption disabled.' : 'Encriptación desactivada.');
                    }
                  } catch (e: any) {
                    setPinMsg(e?.message ?? (activeLang === 'en' ? 'Encryption failed.' : 'Falló la encriptación.'));
                  }
                }}
                className={dbEncrypted ? "px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold" : "px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"}
              >
                {dbEncrypted ? (activeLang === 'en' ? 'Disable' : 'Desactivar') : (activeLang === 'en' ? 'Enable' : 'Activar')}
              </button>
            </div>

            {pinMsg ? <div className="md:col-span-3 text-sm" style={{ color: 'var(--pc-muted)' }}>{pinMsg}</div> : null}
          </div>
        </div>


        <form
          action={(formData) => {
            setPwMsg('');
            startTransition(async () => {
              const res = await changeMyPassword(formData);
              if (!res.success) {
                setPwMsg((res as any).error ?? (activeLang === 'en' ? 'Could not update password' : 'No se pudo actualizar'));
                return;
              }
              setPwCurrent('');
              setPwNew('');
              setPwConfirm('');
              setPwMsg(t('auth.passwordUpdated'));
            });
          }}
          className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('auth.currentPassword')}</label>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('auth.newPassword')}</label>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('auth.confirmPassword')}</label>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950"
              required
            />
          </div>

          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {pending ? t('common.loading') : t('auth.changePassword')}
            </button>
            {pwMsg ? <span className="text-sm" style={{ color: pwMsg === t('auth.passwordUpdated') ? 'var(--pc-success)' : 'var(--pc-muted)' }}>{pwMsg}</span> : null}
          </div>
        </form>
      </section>

      {/* NOTIFICATIONS */}
      <section>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('settings.notifications')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--pc-muted)' }}>{t('settings.notificationsHelp')}</p>

        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            {activeLang === 'en' ? 'Email notifications' : 'Notificaciones por correo'}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={notifyUpcoming} onChange={(e) => setNotifyUpcoming(e.target.checked)} />
            {activeLang === 'en' ? 'Upcoming appointment reminders' : 'Recordatorios de citas próximas'}
          </label>

          <form
            action={(formData) => {
              setDone('');
              setError('');
              startTransition(async () => {
                const res = await saveMySettings(formData);
                if (!res.success) {
                  setError((res as any).error ?? (activeLang === 'en' ? 'Could not save' : 'No se pudo guardar'));
                  return;
                }
                setDone(t('settings.saved'));
              });
            }}
            className="pt-2"
          >
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="theme" value={theme} />
            <input type="hidden" name="timezone" value={timezone} />
            <input type="hidden" name="dateFormat" value={dateFormat} />
          <input type="hidden" name="uiSize" value={uiSize} />
          <input type="hidden" name="uiZoom" value={String(uiZoom)} />
          <input type="hidden" name="moneyDecimals" value={String(moneyDecimals)} />
          <input type="hidden" name="appLockEnabled" value={appLockEnabled ? "on" : "off"} />
          <input type="hidden" name="autoLockMinutes" value={String(autoLockMinutes)} />
          <input type="hidden" name="rememberMinutes" value={String(rememberMinutes)} />
            <input type="hidden" name="notifyEmail" value={notifyEmail ? 'on' : 'off'} />
            <input type="hidden" name="notifyUpcoming" value={notifyUpcoming ? 'on' : 'off'} />

            <button
              type="submit"
              disabled={pending}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {pending ? t('common.loading') : t('settings.saveChanges')}
            </button>
          </form>
        </div>
      </section>

      {/* DATA */}
      <section>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('settings.data')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--pc-muted)' }}>
          {activeLang === 'en'
            ? 'Export or import your data (per account).'
            : 'Exporta o importa tu información (por cuenta).'}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href="/api/export"
            className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold"
          >
            {t('settings.export')}
          </a>

          <label className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold cursor-pointer">
            {t('settings.import')}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                try {
                  const res = await fetch('/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: text,
                  });
                  if (!res.ok) throw new Error('bad');
                  setDone(activeLang === 'en' ? 'Imported' : 'Importado');
                } catch {
                  setError(activeLang === 'en' ? 'Import failed' : 'Error importando');
                } finally {
                  e.currentTarget.value = '';
                }
              }}
            />
          </label>

          {done ? <span className="text-sm" style={{ color: 'var(--pc-muted)' }}>{done}</span> : null}
          {error ? <span className="text-sm text-red-600 dark:text-red-400">{error}</span> : null}
        </div>
      </section>
    </div>
  );
}
