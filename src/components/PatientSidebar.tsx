'use client';

import { useIsBirthday } from '@/hooks/use-birthday';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Cake, Phone } from 'lucide-react';
import { EditPatientModal } from '@/components/EditPatientModal';

export function PatientSidebar({ patient }: { patient: any }) {
  const birthIso = typeof patient.birthDate === 'string' ? patient.birthDate : new Date(patient.birthDate).toISOString();
  const isBirthday = useIsBirthday(birthIso);

  useEffect(() => {
    if (isBirthday) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }
  }, [isBirthday]);

  const isPsy = patient.type === 'PSY';
  const typeLabel = isPsy ? 'Psicología' : patient.type === 'MED' ? 'Medicina General' : 'Sin asignar';
  const typeColor = isPsy ? 'text-purple-600 bg-purple-50' : patient.type === 'MED' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 bg-slate-100';

  return (
    <aside className="w-80 h-screen bg-white border-r border-slate-100 p-6 flex flex-col gap-6 fixed left-0 top-0 overflow-y-auto z-10 hidden md:flex">
      <div>
        <Link href="/" className="text-sm text-slate-600 hover:text-blue-700">← Volver</Link>
      </div>

      <div className="text-center">
        <div className={`relative w-32 h-32 mx-auto rounded-full overflow-hidden border-4 ${isBirthday ? 'border-yellow-400' : 'border-slate-100'}`}>
          {patient.photoUrl ? (
            <Image src={patient.photoUrl} alt={patient.fullName} fill sizes="128px" className="object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-100" />
          )}
          {isBirthday && <div className="absolute bottom-0 w-full bg-yellow-400 text-xs font-bold py-1">¡CUMPLEAÑOS!</div>}
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-800">{patient.fullName}</h2>
        <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${typeColor}`}>
          {typeLabel}
        </span>

        <div className="mt-4 flex justify-center">
          <EditPatientModal patient={patient} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl">
          <Cake className="w-5 h-5 text-purple-500" />
          <div>
            <p className="text-xs text-slate-400 uppercase">Nacimiento</p>
            <p className="font-medium">{new Date(birthIso).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl">
          <Phone className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-xs text-slate-400 uppercase">Contacto</p>
            <p className="font-medium">{patient.phone || 'Sin datos'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
