'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Loader2, Pencil, X } from 'lucide-react';

import { updatePatientProfile } from '@/app/actions';
import { useUpload } from '@/hooks/use-upload';

const Schema = z.object({
  fullName: z.string().min(2).max(100),
  documentId: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  country: z.string().max(80).optional().or(z.literal('')),
  city: z.string().max(80).optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  type: z.enum(['PSY', 'MED']).optional(),
  photoUrl: z.string().max(500).optional().or(z.literal('')),
});

export function EditPatientModal({
  patient,
}: {
  patient: {
    id: string;
    fullName: string;
    documentId?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    birthDate?: string | null;
    type?: 'PSY' | 'MED' | null;
    photoUrl?: string | null;
  };
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const { uploadFile, isUploading } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: patient.fullName ?? '',
    documentId: patient.documentId ?? '',
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    country: (patient as any).country ?? '',
    city: (patient as any).city ?? '',
    birthDate: (patient.birthDate ?? '').toString(),
    type: (patient.type ?? 'PSY') as 'PSY' | 'MED',
    photoUrl: patient.photoUrl ?? '',
  });

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await uploadFile(f);
    if (url) setForm((s) => ({ ...s, photoUrl: url }));
    if (fileRef.current) fileRef.current.value = '';
  }

  function onSave() {
    setError('');
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Datos inválidos');
      return;
    }

    startTransition(async () => {
      const res = await updatePatientProfile(patient.id, {
        fullName: parsed.data.fullName,
        documentId: parsed.data.documentId || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        birthDate: parsed.data.birthDate || undefined,
        type: parsed.data.type || undefined,
        photoUrl: parsed.data.photoUrl || null,
      });

      if (!res?.success) {
        setError(res?.error ?? 'No se pudo guardar');
        return;
      }

      router.refresh();
      setIsOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition flex items-center gap-2"
      >
        <Pencil className="w-4 h-4" /> Editar paciente
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Editar paciente</h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Documento</label>
                  <input
                    value={form.documentId}
                    onChange={(e) => setForm((s) => ({ ...s, documentId: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">País</label>
                  <input
                    value={form.country}
                    onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha nacimiento</label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm((s) => ({ ...s, birthDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((s) => ({ ...s, type: e.target.value as 'PSY' | 'MED' }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="PSY">Psicología</option>
                    <option value="MED">Medicina</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Foto (opcional)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50"
                  >
                    {isUploading ? 'Subiendo…' : 'Cambiar foto'}
                  </button>
                  {form.photoUrl ? (
                    <span className="text-xs text-slate-500 truncate max-w-[260px]">{form.photoUrl}</span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sin foto</span>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} />
              </div>

              {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isPending}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all shadow-md shadow-blue-100"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
