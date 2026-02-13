
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, User, ChevronRight, Loader2 } from 'lucide-react';
import { autocompletePatients, searchPatients } from '@/app/actions';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export type PatientDTO = {
  id: string;
  fullName: string;
  documentId: string | null;
  birthDate: string | null;
  photoUrl: string | null;
  type: 'PSY' | 'MED' | null;
  createdAt: string | null;
};

export function PatientSearch() {
  const { t } = useI18n();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<Pick<PatientDTO, 'id' | 'fullName' | 'documentId' | 'photoUrl'>>>([]);
  const [openSuggest, setOpenSuggest] = useState(false);

  const [results, setResults] = useState<PatientDTO[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  const debounceRef = useRef<any>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function loadResults(nextPage = 1) {
    setLoadingResults(true);
    try {
      const res = await searchPatients({ q: query.trim(), page: nextPage, pageSize });
      setResults(res.rows as any);
      setTotal(res.total ?? 0);
      setPage(res.page ?? nextPage);
    } catch (e) {
      toast.error(t('errors.loadPatients'));
    } finally {
      setLoadingResults(false);
    }
  }

  // Initial load (recent patients)
  useEffect(() => {
    loadResults(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!q) {
        setSuggestions([]);
        setOpenSuggest(false);
        // Show recent again
        loadResults(1);
        return;
      }

      setLoadingSuggest(true);
      try {
        const rows = await autocompletePatients({ q, limit: 10 });
        setSuggestions(rows as any);
        setOpenSuggest(true);
      } catch {
        // ignore
      } finally {
        setLoadingSuggest(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="pc-card bg-white dark:bg-slate-900">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/patients" className="text-sm font-bold text-slate-800 dark:text-slate-100 hover:underline">
            {t('patients.title')}
          </Link>
          <Link
            href="/patients"
            className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            Ver tabla
          </Link>
        </div>
        <p className="text-[13px]" style={{ color: 'var(--pc-muted)' }}>{t('patients.subtitle')}</p>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpenSuggest(true)}
          placeholder={t('patients.searchPlaceholder')}
          className="block w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all border border-slate-200/70 dark:border-slate-700"
        />

        {loadingSuggest && (
          <div className="absolute right-2 top-2.5 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}

        {openSuggest && suggestions.length > 0 && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-lg overflow-hidden">
            {suggestions.map((p) => (
              <button
                key={`s-${p.id}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  router.push(`/patient/${p.id}`);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-left"
              >
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-shrink-0">
                  {p.photoUrl ? (
                    <Image src={p.photoUrl} alt={p.fullName} fill sizes="32px" className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{p.fullName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-300 truncate">{p.documentId || t('patients.noDocument')}</div>
                </div>
                <ChevronRight className="ml-auto w-4 h-4 text-slate-300" />
              </button>
            ))}

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setOpenSuggest(false);
                loadResults(1);
              }}
              className="w-full px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-900 text-left"
            >
              {t('patients.viewMore')}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-slate-500 dark:text-slate-300">
            {loadingResults ? t('common.loading') : t('patients.resultsCount', { shown: results.length, total })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loadingResults}
              onClick={() => loadResults(page - 1)}
              className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              {t('common.prev')}
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loadingResults}
              onClick={() => loadResults(page + 1)}
              className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              {t('common.next')}
            </button>
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto rounded-xl bg-white dark:bg-slate-950 divide-y divide-slate-100/70 dark:divide-slate-800/80">
          {results.length === 0 && !loadingResults ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">{t('patients.empty')}</div>
          ) : null}

          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => router.push(`/patient/${p.id}`)}
              className="w-full flex items-center gap-3 p-3 hover:bg-[#EFF6FF] dark:hover:bg-slate-900 text-left"
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden bg-[#DBEAFE] dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 flex-shrink-0">
                {p.photoUrl ? (
                  <Image src={p.photoUrl} alt={p.fullName} fill sizes="36px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{p.fullName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-300 truncate">
                  {p.documentId || t('patients.noDocument')}
                </div>
              </div>
              <ChevronRight className="ml-auto w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
