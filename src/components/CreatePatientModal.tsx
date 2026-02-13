'use client';

import { useRef, useState } from 'react';
import { createPatient } from '@/app/actions';
import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUpload } from '@/hooks/use-upload';

export function CreatePatientModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Fuerza remount del formulario para limpiar estado (inputs, warnings, etc.)
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();
  const { uploadFile, isUploading } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');

  function resetModalState() {
    setError('');
    setPhotoUrl('');
    setBirthDate('');
    if (fileRef.current) fileRef.current.value = '';
    // Remount del form para limpiar cualquier valor residual del navegador
    setFormKey((k) => k + 1);
  }

  function closeModal() {
    setIsOpen(false);
    resetModalState();
  }

  const fieldClass =
    'w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ' +
    'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 ' +
    // Evita que el texto se vea "translúcido" en modo oscuro por herencias de opacidad
    'placeholder:text-slate-400 dark:placeholder:text-slate-500 opacity-100 text-opacity-100';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    // Si usamos el date picker controlado, aseguramos que el valor vaya en el form.
    if (birthDate) formData.set('birthDate', birthDate);

    // Normaliza fecha si el usuario escribe dd/mm/aaaa (por compatibilidad)
    const birthRaw = String(formData.get('birthDate') ?? '').trim();
    const m = birthRaw.match(/^([0-3]?\d)[/\-.]([0-1]?\d)[/\-.](\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      const yyyy = m[3];
      formData.set('birthDate', `${yyyy}-${mm}-${dd}`);
    }

    // foto (opcional)
    if (photoUrl) formData.set('photoUrl', photoUrl);

    try {
      const res = await createPatient(formData);
      if (res.success) {
        closeModal();
        router.push(`/patient/${res.newId}`);
      } else {
        setError(res.error);
      }
    } catch {
      setError('Error crítico de red. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          // Al abrir, limpia cualquier rastro del intento anterior
          resetModalState();
          setIsOpen(true);
        }}
        className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-medium shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" /> Nuevo paciente
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Nuevo paciente</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form key={formKey} onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Nombre completo</label>
                <input name="fullName" required placeholder="Ej: Ana María Polo" className={fieldClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Documento</label>
                  <input name="documentId" placeholder="Cédula / ID" className={fieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Teléfono</label>
                  <input name="phone" placeholder="(+57) 300 000 0000" className={fieldClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Email</label>
                <input type="email" name="email" placeholder="correo@dominio.com" className={fieldClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">País</label>
                  <input name="country" placeholder="Ej: Colombia" className={fieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Ciudad</label>
                  <input name="city" placeholder="Ej: Bogotá" className={fieldClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Fecha nacimiento</label>
                  <input
                    type="date"
                    name="birthDate"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={fieldClass}
                  />
                  <BirthAgeHint birthDate={birthDate} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Tipo</label>
                  <select
                    name="type"
                    className={
                      'w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ' +
                      'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'
                    }
                  >
                    <option value="PSY">Psicología</option>
                    <option value="MED">Medicina</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Foto (opcional)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-medium disabled:opacity-50"
                  >
                    {isUploading ? 'Subiendo…' : 'Subir foto'}
                  </button>
                  {photoUrl ? (
                    <span className="text-xs text-slate-500 truncate max-w-[260px]">{photoUrl}</span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sin foto</span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await uploadFile(f);
                    if (url) setPhotoUrl(url);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                />
              </div>

              {error && (
                <div className="text-red-700 dark:text-red-200 text-sm bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
                  {error}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all shadow-md shadow-blue-100"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Guardando...' : 'Crear ficha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function BirthAgeHint({ birthDate }: { birthDate: string }) {
  if (!birthDate) return null;
  const d = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 130) return null;
  return (
    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
      Edad aproximada: <span className="font-semibold">{age}</span>
    </div>
  );
}
