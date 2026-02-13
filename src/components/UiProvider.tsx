
'use client';

import { useEffect } from 'react';

type UiSize = 'compact' | 'normal' | 'large';

function applyUi(size: UiSize, zoom: number) {
  const html = document.documentElement;
  html.classList.remove('pc-ui-compact', 'pc-ui-normal', 'pc-ui-large');
  html.classList.add(size === 'compact' ? 'pc-ui-compact' : size === 'large' ? 'pc-ui-large' : 'pc-ui-normal');

  const z = Number.isFinite(zoom) ? zoom : 100;
  const clamped = Math.max(80, Math.min(140, Math.round(z)));
  // Chromium supports CSS zoom.
  (document.documentElement.style as any).zoom = String(clamped / 100);
}

export function UiProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const size = (localStorage.getItem('psycloud:uiSize') as UiSize) || 'normal';
      const zoom = Number(localStorage.getItem('psycloud:uiZoom') || '100');
      applyUi(size, zoom);
    } catch {
      applyUi('normal', 100);
    }
  }, []);

  return children as any;
}
