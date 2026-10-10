/**
 * Escopo de análise compartilhado entre as telas: pesquisa selecionada e
 * filtros, guardados na URL (compartilhável e sobrevive ao recarregar).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.ts";
import { useAsync } from "../lib/useAsync.ts";
import type { IventVersion, Profession, SurveySummary } from "./types.ts";

export const FILTER_KEYS = ["versionId", "profession", "from", "to", "iventVersionId", "questionKey", "search"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;

interface ScopeValue {
  surveys: SurveySummary[];
  surveysLoading: boolean;
  reloadSurveys: () => void;
  surveyId: string | null;
  survey: SurveySummary | null;
  setSurveyId: (id: string) => void;
  filters: Filters;
  setFilter: (key: FilterKey, value: string | undefined) => void;
  clearFilters: () => void;
  /** Parâmetros prontos para a API (pesquisa + filtros). */
  query: Record<string, string>;
  professions: Profession[];
  iventVersions: IventVersion[];
  reloadReference: () => void;
}

const ScopeContext = createContext<ScopeValue | null>(null);
const LAST_SURVEY = "iva-last-survey";

function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_SURVEY);
  } catch {
    return null;
  }
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const surveysState = useAsync((signal) => api<SurveySummary[]>("/api/admin/surveys", { signal }), []);
  const reference = useAsync(
    async (signal) => {
      const [professions, iventVersions] = await Promise.all([
        api<Profession[]>("/api/admin/professions", { signal }),
        api<IventVersion[]>("/api/admin/ivent-versions", { signal }),
      ]);
      return { professions, iventVersions };
    },
    [],
  );
  const surveys = useMemo(() => surveysState.data ?? [], [surveysState.data]);
  const requested = params.get("survey");

  // Pesquisa padrão: a da URL; senão a última usada; senão a mais recente com respostas.
  const surveyId = useMemo(() => {
    if (requested && surveys.some((s) => s.id === requested)) return requested;
    const last = readLast();
    if (last && surveys.some((s) => s.id === last)) return last;
    return [...surveys].sort((a, b) => b.responseCount - a.responseCount)[0]?.id ?? null;
  }, [requested, surveys]);

  useEffect(() => {
    if (!surveyId) return;
    try {
      localStorage.setItem(LAST_SURVEY, surveyId);
    } catch {
      // ignore
    }
  }, [surveyId]);

  const setSurveyId = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.set("survey", id);
      next.delete("versionId");
      next.delete("questionKey");
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const filters = useMemo(() => {
    const f: Filters = {};
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (v) f[k] = v;
    }
    return f;
  }, [params]);

  const setFilter = useCallback(
    (key: FilterKey, value: string | undefined) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams();
    if (params.get("survey")) next.set("survey", params.get("survey")!);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const query = useMemo(() => {
    const q: Record<string, string> = {};
    if (surveyId) q.surveyId = surveyId;
    for (const [k, v] of Object.entries(filters)) if (v) q[k] = v;
    return q;
  }, [surveyId, filters]);

  const value: ScopeValue = {
    surveys,
    surveysLoading: surveysState.loading,
    reloadSurveys: surveysState.reload,
    surveyId,
    survey: surveys.find((s) => s.id === surveyId) ?? null,
    setSurveyId,
    filters,
    setFilter,
    clearFilters,
    query,
    professions: reference.data?.professions ?? [],
    iventVersions: reference.data?.iventVersions ?? [],
    reloadReference: reference.reload,
  };
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeValue {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope fora do ScopeProvider");
  return ctx;
}

/** Mantém o parâmetro ?survey= ao navegar entre telas. */
export function useScopedLink() {
  const [params] = useSearchParams();
  return (path: string) => {
    const survey = params.get("survey");
    return survey ? `${path}?survey=${survey}` : path;
  };
}
