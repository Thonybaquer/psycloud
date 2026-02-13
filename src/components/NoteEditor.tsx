
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clearNoteDraft, loadNoteBySessionAt, loadNoteDraft, saveNote, saveNoteDraft } from '@/app/actions';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Send,
  Paperclip,
  FileText,
  X,
  Mic,
  MicOff,
  Heading1,
  List,
  ListOrdered,
  Tag,
  Quote,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { useUpload } from '@/hooks/use-upload';
import type { Attachment } from '@/types';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

function templateSOAP() {
  return `
<h3>Subjective</h3>
<ul><li></li></ul>
<h3>Objective</h3>
<ul><li></li></ul>
<h3>Assessment</h3>
<ul><li></li></ul>
<h3>Plan</h3>
<ul><li></li></ul>
`.trim();
}

function templateProgress() {
  return `
<h3>Evolución</h3>
<ul>
  <li><strong>Objetivo de la sesión:</strong> </li>
  <li><strong>Intervenciones:</strong> </li>
  <li><strong>Respuesta del paciente:</strong> </li>
  <li><strong>Tareas / plan:</strong> </li>
</ul>
`.trim();
}

function templateInitial() {
  return `
<h3>Evaluación inicial</h3>
<ul>
  <li><strong>Motivo de consulta:</strong> </li>
  <li><strong>Historia relevante:</strong> </li>
  <li><strong>Hipótesis clínica:</strong> </li>
  <li><strong>Plan de tratamiento:</strong> </li>
</ul>
`.trim();
}

export type NoteApptOption = {
  id: string;
  date: string;
  endAt?: string | null;
  status?: string | null;
};

export function NoteEditor({
  patientId,
  appointments = [],
  initialSessionAt,
}: {
  patientId: string;
  appointments?: NoteApptOption[];
  initialSessionAt?: string;
}) {
  const { t, lang } = useI18n();
  const [isSaving, setIsSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [category, setCategory] = useState<string>('seguimiento');
  const { uploadFile, isUploading } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastDraftSigRef = useRef<string>('');
  const router = useRouter();

  // Hora de sesión: se fija al inicio REAL de la cita seleccionada.
  // Si no hay cita seleccionada, usamos la hora actual (solo como fallback).
  const [selectedApptId, setSelectedApptId] = useState<string>('');
  // Cuando editas una nota desde el historial, fijamos el "sessionAt" de esa nota.
  const [manualSessionAt, setManualSessionAt] = useState<string>('');

  // Si llegamos desde "Editar" (query param en la página), intentamos:
  // 1) asociarlo a una cita existente (si coincide),
  // 2) si no, usarlo como sessionAt manual.
  useEffect(() => {
    if (!initialSessionAt) return;
    const d = new Date(initialSessionAt);
    if (Number.isNaN(d.getTime())) return;
    const iso = d.toISOString();

    // Match por timestamp (no por string) para evitar problemas de zona horaria / normalización
    const targetT = d.getTime();
    const match = (appointments ?? []).find((a) => {
      if (!a?.date) return false;
      const t = new Date(a.date).getTime();
      return !Number.isNaN(t) && Math.abs(t - targetT) < 60_000; // 1 min de tolerancia
    });
    if (match?.id) {
      setSelectedApptId(match.id);
      setManualSessionAt('');
    } else {
      setManualSessionAt(iso);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionAt]);

  // Si hay una cita en curso o la próxima cita, la preseleccionamos para mantener orden por horario.
  useEffect(() => {
    if (selectedApptId) return;
    if (!appointments?.length) return;
    const now = new Date().getTime();
    const sorted = [...appointments]
      .filter((a) => a?.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const inProgress = sorted.find((a) => {
      const start = new Date(a.date).getTime();
      const end = a.endAt ? new Date(a.endAt).getTime() : start + 60 * 60 * 1000;
      return now >= start && now <= end;
    });
    const upcoming = sorted.find((a) => new Date(a.date).getTime() >= now);
    const pick = inProgress ?? upcoming;
    if (pick?.id) setSelectedApptId(pick.id);
  }, [appointments, selectedApptId, manualSessionAt]);

  const sessionAtIso = useMemo(() => {
    if (selectedApptId) {
      const a = appointments.find((x) => x.id === selectedApptId);
      if (a?.date) return a.date;
    }
    if (manualSessionAt) return manualSessionAt;
    return new Date().toISOString();
  }, [appointments, selectedApptId, manualSessionAt]);

  const hasExplicitTarget = Boolean(selectedApptId || manualSessionAt || initialSessionAt);

  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageExtension,
      Underline,
      Link.configure({ openOnClick: true, autolink: true, linkOnPaste: true }),
      Placeholder.configure({ placeholder: t('notes.placeholder') }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm focus:outline-none min-h-[140px] max-h-[320px] overflow-y-auto outline-none p-2 bg-transparent',
        spellcheck: 'true',
      },
    },
  });

  // --- Autosave ---
  const draftKey = useMemo(() => `psycloud:draft:${patientId}`, [patientId]);

  // Load draft / existing note: DB first (note for selected session), then draft, then local (fallback)
  useEffect(() => {
    if (!editor) return;

    (async () => {
      // 1) Si hay objetivo explícito (editar una nota o una cita específica),
      // intenta cargar la nota de esa sesión (si existe).
      if (hasExplicitTarget) {
        try {
          const res = await loadNoteBySessionAt(patientId, sessionAtIso);
          if (res?.success && res.note?.content) {
            editor.commands.setContent(res.note.content);
            if (Array.isArray(res.note.attachments)) setAttachments(res.note.attachments);
            if (typeof res.note.category === 'string' && res.note.category) setCategory(res.note.category);
            return;
          }
        } catch {
          // ignore
        }
      }

      try {
        const dbDraft = await loadNoteDraft(patientId);
        if (dbDraft.success && dbDraft.draft?.content) {
          editor.commands.setContent(dbDraft.draft.content);
          if (Array.isArray(dbDraft.draft.attachments)) setAttachments(dbDraft.draft.attachments);
          if (typeof dbDraft.draft.category === 'string' && dbDraft.draft.category) setCategory(dbDraft.draft.category);
          return;
        }
      } catch {}

      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.content) editor.commands.setContent(parsed.content);
          if (Array.isArray(parsed?.attachments)) setAttachments(parsed.attachments);
          if (typeof parsed?.category === 'string' && parsed.category) setCategory(parsed.category);
        }
      } catch {
        // ignore
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, draftKey, patientId, selectedApptId, sessionAtIso, hasExplicitTarget]);

  // Local autosave (fast)
  useEffect(() => {
    if (!editor) return;
    const tmr = setInterval(() => {
      try {
        const payload = { content: editor.getJSON(), attachments, category };
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {}
    }, 3000);
    return () => clearInterval(tmr);
  }, [editor, attachments, draftKey, category]);

  // DB autosave (reliable)
  useEffect(() => {
    if (!editor) return;

    const tmr = setInterval(async () => {
      try {
        const payload = { content: editor.getJSON(), attachments, category };
        // Evita escrituras innecesarias en DB (mejora rendimiento y "memoria")
        const sig = JSON.stringify(payload);
        if (sig === lastDraftSigRef.current) return;
        lastDraftSigRef.current = sig;
        await saveNoteDraft(patientId, payload.content, category, attachments);
      } catch {
        // ignore
      }
    }, 10000);

    return () => clearInterval(tmr);
  }, [editor, attachments, category, patientId]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await uploadFile(f);
    if (url) {
      const isImage = f.type.startsWith('image/');
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      const isAudio = f.type.startsWith('audio/');
      const att: Attachment = { url, type: isImage ? 'img' : isPdf ? 'pdf' : isAudio ? 'audio' : 'file', name: f.name };
      setAttachments((prev) => [...prev, att]);

      // Insert into content (not only list)
      if (editor) {
        editor.chain().focus();
        if (isImage) {
          editor.chain().setImage({ src: url }).run();
        } else {
          editor
            .chain()
            .insertContent(`<p><a href="${url}" target="_blank" rel="noopener noreferrer">${f.name}</a></p>`)
            .run();
        }
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSave = async () => {
    if (!editor) return;
    if (editor.isEmpty && attachments.length === 0) return;

    setIsSaving(true);
    try {
      const res = await saveNote(patientId, editor.getJSON(), '📝', attachments, category, sessionAtIso);
      if (!res.success) {
        toast.error(res.error || 'No se pudo guardar');
        return;
      }

      // ✅ UX: después de guardar, limpia el editor para que quede "en blanco".
      // Esto también evita que el historial intente renderizar un draft inválido ("{}").
      try {
        await clearNoteDraft(patientId);
      } catch {
        // ignore
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }

      // Reinicia firma del draft para que el autosave no re-escriba inmediatamente.
      lastDraftSigRef.current = '';

      editor.commands.clearContent(true);
      setAttachments([]);
      setCategory('seguimiento');
      setManualSessionAt('');

      toast.success(t('notes.saved'));
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRecord = async () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      setIsRecording(false);
      mediaRef.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
        const url = await uploadFile(file);
        if (url) {
          setAttachments((prev) => [...prev, { url, type: 'audio', name: file.name }]);
          if (editor) {
            editor.chain().focus().insertContent(`<p><a href="${url}" target="_blank">${file.name}</a></p>`).run();
          }
        }
        chunksRef.current = [];
      };
      mediaRef.current = mr;
      setIsRecording(true);
      mr.start();
    } catch {
      toast.error('No se pudo acceder al micrófono');
    }
  };

  const applyTemplate = (html: string, nextCategory?: string) => {
    if (!editor) return;
    editor.commands.setContent(html, false);
    if (nextCategory) setCategory(nextCategory);
    toast.success(t('notes.draftSaved'));
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,audio/*,.doc,.docx,.txt,.rtf"
        onChange={onPick}
      />

      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          type="button"
          title="Heading"
        >
          <Heading1 className="w-3 h-3" />
        </button>

        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className="px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          type="button"
        >
          B
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className="px-2 py-1 text-xs italic text-slate-600 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          type="button"
        >
          I
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className="px-2 py-1 text-xs underline text-slate-600 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          type="button"
          title="Underline"
        >
          U
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className="px-2 py-1 text-xs text-slate-600 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          type="button"
          title="Quote"
        >
          <Quote className="w-3 h-3" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className="px-2 py-1 text-xs text-slate-600 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          type="button"
          title="Bullets"
        >
          <List className="w-3 h-3" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className="px-2 py-1 text-xs text-slate-600 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          type="button"
          title="Numbered list"
        >
          <ListOrdered className="w-3 h-3" />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          onClick={() => editor?.chain().focus().setLink({ href: window.prompt('URL') || '' }).run()}
          className="px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          type="button"
          title="Link"
        >
          <LinkIcon className="w-3 h-3" />
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1"
          type="button"
        >
          {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
          {t('notes.attach')}
        </button>

        <button
          onClick={toggleRecord}
          className="px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          type="button"
        >
          {isRecording ? (
            <>
              <MicOff className="w-3 h-3" /> {t('notes.stop')}
            </>
          ) : (
            <>
              <Mic className="w-3 h-3" /> {t('notes.voice')}
            </>
          )}
        </button>

        <div className="w-full md:w-auto md:ml-auto flex flex-wrap items-center gap-2 justify-start md:justify-end">
          <span className="text-xs text-slate-500 dark:text-slate-400">Cita</span>
          <select
            value={selectedApptId}
            onChange={(e) => {
              setSelectedApptId(e.target.value);
              setManualSessionAt('');
            }}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 max-w-[220px] md:max-w-[260px]"
            title="Vincular nota a cita (orden por horario)"
          >
            <option value="">Sin cita</option>
            {[...appointments]
              .filter((a) => a?.date)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((a) => {
                const d = new Date(a.date);
                const label = `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                return (
                  <option key={a.id} value={a.id}>
                    {label}
                  </option>
                );
              })}
          </select>

          {manualSessionAt && !selectedApptId && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold">
              Editando nota guardada
              <button
                type="button"
                onClick={() => setManualSessionAt('')}
                className="ml-1 underline hover:opacity-80"
                title="Volver a nota nueva"
              >
                salir
              </button>
            </div>
          )}

          <Sparkles className="w-4 h-4 text-slate-400" />
          <select
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'soap') applyTemplate(templateSOAP(), 'seguimiento');
              if (v === 'progress') applyTemplate(templateProgress(), 'seguimiento');
              if (v === 'initial') applyTemplate(templateInitial(), 'evaluacion_inicial');
              e.currentTarget.selectedIndex = 0;
            }}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
            title={t('notes.templates')}
            defaultValue=""
          >
            <option value="" disabled>
              {t('notes.templates')}
            </option>
            <option value="soap">{t('notes.soap')}</option>
            <option value="progress">{t('notes.progress')}</option>
            <option value="initial">{t('notes.initial')}</option>
          </select>

          <Tag className="w-4 h-4 text-slate-400" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
            title={t('notes.category')}
          >
            <option value="evaluacion_inicial">Evaluación inicial</option>
            <option value="seguimiento">Seguimiento</option>
            <option value="intervencion">Intervención</option>
            <option value="crisis">Crisis</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>

      <EditorContent editor={editor} className="bg-transparent" />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50 dark:border-slate-800">
          {attachments.map((att, idx) => (
            <div
              key={`${att.url}-${idx}`}
              className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-xs"
            >
              {att.type === 'pdf' ? (
                <FileText className="w-3 h-3 text-red-500" />
              ) : att.type === 'audio' ? (
                <Mic className="w-3 h-3 text-purple-500" />
              ) : (
                <Paperclip className="w-3 h-3 text-blue-500" />
              )}
              <span className="max-w-[180px] truncate">{att.name}</span>
              {att.type === 'audio' && (
                <audio controls preload="none" src={att.url} className="h-7 max-w-[220px]" />
              )}
              <button type="button" onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving || isUploading || (editor?.isEmpty && attachments.length === 0)}
          className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          type="button"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
