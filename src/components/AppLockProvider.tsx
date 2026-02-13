'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type SecuritySettings = {
  appLockEnabled?: boolean;
  autoLockMinutes?: number;
  rememberMinutes?: number;
  hasPin?: boolean;
};

function nowMs() {
  return Date.now();
}

function getUnlockUntil(): number {
  try {
    return Number(localStorage.getItem('psycloud:unlockUntil') || '0') || 0;
  } catch {
    return 0;
  }
}

function setUnlockUntil(ts: number) {
  try {
    localStorage.setItem('psycloud:unlockUntil', String(ts));
  } catch {}
}

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [locked, setLocked] = useState<boolean>(false);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<string>('');
  const lastActiveRef = useRef<number>(nowMs());

  const enabled = Boolean(security?.appLockEnabled) && Boolean(security?.hasPin);

  const autoLockMs = useMemo(() => {
    const mins = Number(security?.autoLockMinutes ?? 10);
    if (!Number.isFinite(mins) || mins <= 0) return 0;
    return Math.max(1, mins) * 60_000;
  }, [security?.autoLockMinutes]);

  const rememberMs = useMemo(() => {
    const mins = Number(security?.rememberMinutes ?? 15);
    if (!Number.isFinite(mins) || mins <= 0) return 0;
    return Math.max(0, mins) * 60_000;
  }, [security?.rememberMinutes]);

  // Load settings once after login
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me/settings', { cache: 'no-store' });
        const j = await res.json();
        if (cancelled) return;
        setSecurity(j?.settings?.security ?? {});
      } catch {
        if (!cancelled) setSecurity({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply money decimals to localStorage if server has it (so all components can read it)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/me/settings', { cache: 'no-store' });
        const j = await res.json();
        const d = Number(j?.settings?.money?.decimals ?? 0);
        if (Number.isFinite(d)) localStorage.setItem('psycloud:moneyDecimals', String(Math.max(0, Math.min(2, Math.round(d)))));
      } catch {}
    })();
  }, []);

  // Determine initial locked state
  useEffect(() => {
    if (!security) return;
    if (!enabled) {
      setLocked(false);
      return;
    }
    const until = getUnlockUntil();
    setLocked(!(until > nowMs()));
  }, [security, enabled]);

  // Inactivity lock
  useEffect(() => {
    if (!enabled) return;

    const bump = () => {
      lastActiveRef.current = nowMs();
    };

    const onVis = () => {
      // If tab/window becomes visible, re-evaluate
      bump();
    };

    window.addEventListener('mousemove', bump);
    window.addEventListener('keydown', bump);
    window.addEventListener('mousedown', bump);
    window.addEventListener('touchstart', bump);
    document.addEventListener('visibilitychange', onVis);

    const t = window.setInterval(() => {
      if (!enabled) return;
      const until = getUnlockUntil();
      const unlocked = until > nowMs();
      if (!unlocked) {
        setLocked(true);
        return;
      }
      if (autoLockMs > 0 && nowMs() - lastActiveRef.current > autoLockMs) {
        setLocked(true);
        setUnlockUntil(0);
      }
    }, 1000);

    return () => {
      window.clearInterval(t);
      window.removeEventListener('mousemove', bump);
      window.removeEventListener('keydown', bump);
      window.removeEventListener('mousedown', bump);
      window.removeEventListener('touchstart', bump);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, autoLockMs]);

  async function tryUnlock() {
    setMsg('');
    const p = pin.trim();
    if (p.length < 4) {
      setMsg('PIN inválido.');
      return;
    }
    try {
      const res = await fetch('/api/security/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: p }),
      });
      const j = await res.json();
      if (!j?.ok) {
        setMsg('PIN incorrecto.');
        return;
      }
      const until = rememberMs > 0 ? nowMs() + rememberMs : nowMs() + 60_000; // at least 1 min
      setUnlockUntil(until);
      setLocked(false);
      setPin('');
      lastActiveRef.current = nowMs();
    } catch {
      setMsg('No se pudo verificar el PIN.');
    }
  }

  if (!enabled || !locked) return children as any;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80">
      <div className="w-[92vw] max-w-md rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 shadow-xl">
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">PsyCloud</div>
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Bloqueado — ingresa tu PIN para continuar.</div>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') tryUnlock();
          }}
          className="mt-4 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          placeholder="PIN"
        />

        {msg ? <div className="mt-2 text-sm text-rose-600">{msg}</div> : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={tryUnlock}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold"
          >
            Desbloquear
          </button>
          <button
            type="button"
            onClick={() => {
              setUnlockUntil(0);
              setLocked(true);
              setPin('');
              setMsg('');
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
