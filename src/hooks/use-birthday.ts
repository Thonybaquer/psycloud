'use client';

import { useMemo } from 'react';

export function useIsBirthday(birthDateIso: string) {
  return useMemo(() => {
    const d = new Date(birthDateIso);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
  }, [birthDateIso]);
}
