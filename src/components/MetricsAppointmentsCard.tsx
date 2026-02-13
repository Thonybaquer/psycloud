'use client';

import { useState } from 'react';
import { AppointmentsModal, type ApptItem } from '@/components/AppointmentsModal';

export function MetricsAppointmentsCard({
  title,
  value,
  modalTitle,
  items,
}: {
  title: string;
  value: number;
  modalTitle: string;
  items: ApptItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pc-card text-left hover:shadow-md transition-shadow"
        title="Ver tabla"
      >
        <div className="text-[13px] font-medium" style={{ color: 'var(--pc-muted)' }}>
          {title}
        </div>
        <div className="text-[28px] font-semibold mt-2 leading-none">{value}</div>
      </button>

      <AppointmentsModal isOpen={open} onClose={() => setOpen(false)} title={modalTitle} items={items} />
    </>
  );
}
