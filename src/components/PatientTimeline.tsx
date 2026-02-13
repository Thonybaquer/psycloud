
'use client';

import DOMPurify from 'isomorphic-dompurify';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { FileText, Paperclip, ArrowUpRight, AudioLines, Filter, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Attachment } from '@/types';
import Link from 'next/link';

type Note = {
  id: string;
  createdAt: string;
  sessionAt: string;
  content: any;
  mood: string | null;
  category?: string | null;
  attachments: Attachment[];
};

// A note can be stored as:
// - TipTap JSON (object)
// - A JSON string containing TipTap JSON
// - Raw HTML string (legacy)
// We normalize to TipTap JSON when possible to avoid render errors.
function tryNormalizeTipTap(content: any): any | null {
  if (!content) return null;
  // Already TipTap-like
  if (typeof content === 'object' && content?.type === 'doc') return content;

  if (typeof content === 'string') {
    const s = content.trim();
    // JSON string
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === 'object' && parsed?.type === 'doc') return parsed;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function safeRenderNoteHTML(content: any): string {
  try {
    const tiptap = tryNormalizeTipTap(content);
    if (tiptap) {
      // IMPORTANT: Debe usar las mismas extensiones que el editor.
      // Si no, TipTap puede lanzar "Unknown node/mark" (p.ej. imagen, link, underline)
      const rawHtml = generateHTML(tiptap, [StarterKit, ImageExtension, Underline, LinkExtension]);
      return DOMPurify.sanitize(rawHtml);
    }

    // If it's a string but NOT tiptap json, treat as HTML (legacy)
    if (typeof content === 'string') {
      return DOMPurify.sanitize(content);
    }

    // Unknown/empty content
    return '';
  } catch {
    // No rompas la UI por un payload extraño: muestra fallback suave.
    return '<p class="text-red-500 text-xs">Error renderizando nota</p>';
  }
}

function formatSessionHeader(iso: string, lang: 'es' | 'en') {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';

  const locale = lang === 'en' ? 'en-US' : 'es-ES';

  const date = d.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  const time = d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${date} - ${time}`;
}

function formatSessionTime(iso: string, lang: 'es' | 'en') {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function PatientTimeline({ patientId, notes, lang = 'es' }: { patientId: string; notes: Note[]; lang?: 'es' | 'en' }) {
  const [filter, setFilter] = useState<string>('all');

  const CATEGORY_LABEL: Record<string, string> = {
    evaluacion_inicial: 'Evaluación inicial',
    seguimiento: 'Seguimiento',
    intervencion: 'Intervención',
    crisis: 'Crisis',
    otro: 'Otro',
  };

  const CATEGORY_ORDER = ['evaluacion_inicial', 'seguimiento', 'intervencion', 'crisis', 'otro'];

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    (notes ?? []).forEach((n) => {
      const c = (n.category ?? 'seguimiento').trim();
      m.set(c, (m.get(c) ?? 0) + 1);
    });
    return m;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (!notes) return [] as Note[];
    if (filter === 'all') return notes;
    return notes.filter((n) => (n.category ?? 'seguimiento') === filter);
  }, [notes, filter]);

  // Renderizamos HTML una sola vez por nota para evitar recalcular en cada re-render (mejora performance).
  const renderedById = useMemo(() => {
    const m = new Map<string, string>();
    (filteredNotes ?? []).forEach((n) => {
      // Si no hay contenido, evita render y deja que los adjuntos sean lo principal.
      const html = safeRenderNoteHTML(n.content);
      m.set(n.id, html);
    });
    return m;
  }, [filteredNotes]);

  if (!notes || notes.length === 0) {
    return <div className="p-10 text-center text-slate-400 dark:text-slate-500">Sin historial</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400">{filteredNotes.length} notas</div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          >
            <option value="all">{lang === 'en' ? 'All' : 'Todas'}</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {(CATEGORY_LABEL[c] ?? c.replace(/_/g, ' '))}
                {typeof categoryCounts.get(c) === 'number' ? ` (${categoryCounts.get(c)})` : ' (0)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:h-full before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
        {filteredNotes.map((note) => {
          const htmlContent = renderedById.get(note.id) ?? '';

          return (
            <div key={note.id} className="relative">
              <div className="absolute left-0 top-3 w-6 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-950" />
              </div>

              <div className="pc-card bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      📅 {formatSessionHeader(note.sessionAt || note.createdAt, lang)}
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-6">
                      ⏰ {lang === 'en' ? 'Session time' : 'Hora de sesión'}: {formatSessionTime(note.sessionAt || note.createdAt, lang)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {note.category && (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-200 font-semibold">
                        {CATEGORY_LABEL[note.category] ?? note.category.replace(/_/g, ' ')}
                      </span>
                    )}
                    {note.mood && <div className="text-sm">{note.mood}</div>}
                  </div>
                </div>

                <div className="flex items-center justify-end -mt-2 mb-2">
                  {/* link directo al editor para editar esta nota */}
                  <Link
                    href={`/patient/${patientId}?editSessionAt=${encodeURIComponent(note.sessionAt || note.createdAt)}#note-editor`}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2"
                    title="Editar esta nota"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Link>
                </div>

                <div
                  className="prose prose-sm prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-200"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />

                {note.attachments?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-50 dark:border-slate-800">
                    {note.attachments.map((att, idx) => (
                      <div key={`${att.url}-${idx}`} className="flex flex-col gap-2">
                        {att.type === 'audio' ? (
                          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 mb-2">
                              <AudioLines className="w-4 h-4 text-purple-500" />
                              <span className="max-w-[240px] truncate">{att.name}</span>
                              <a
                                href={att.url}
                                download
                                className="ml-auto text-slate-400 hover:text-blue-600"
                                title="Descargar"
                              >
                                <ArrowUpRight className="w-4 h-4" />
                              </a>
                            </div>
                            {/* audio inline (evita abrir nueva pestaña) */}
                            <audio controls preload="none" src={att.url} className="w-[320px] max-w-full" />
                          </div>
                        ) : (
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-xs font-medium text-slate-700 dark:text-slate-200 group"
                          >
                            {att.type === 'pdf' ? (
                              <FileText className="w-4 h-4 text-red-500" />
                            ) : (
                              <Paperclip className="w-4 h-4 text-blue-500" />
                            )}
                            <span className="max-w-[220px] truncate">{att.name}</span>
                            <ArrowUpRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-blue-500" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
