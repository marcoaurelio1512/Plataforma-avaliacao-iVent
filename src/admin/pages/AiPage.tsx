import { Bot, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorState, Loading } from "../../components/States.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { dateTime } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { FilterBar } from "../components/FilterBar.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { SourceList } from "../components/SourceList.tsx";
import { useScope } from "../scope.tsx";
import type { TextDoc } from "../types.ts";

interface Status { configured: boolean; provider?: string; model?: string }
interface Theme { category: string; title: string; summary: string; kinds: string[]; docIds: string[]; count: number; byProfession: { code: string; label: string; count: number }[] }
interface Analysis { id: string; createdAt: string; provider: string; model: string; sourceCount: number; result: { overallSummary: string; groupComparison: string; themes: Theme[]; discardedIds: number }; sources: Record<string, TextDoc> }
interface AnalysisSummary { id: string; createdAt: string; model: string; sourceCount: number; versionNumber: number | null; filters: Record<string, string> }

const KIND_LABELS: Record<string, string> = { elogio: "Elogio", critica: "Crítica", dificuldade: "Dificuldade", problema_interface: "Problema de interface", sugestao: "Sugestão" };

export default function AiPage() {
  const { query, surveyId } = useScope();
  const status = useAsync((signal) => api<Status>("/api/admin/ai/status", { signal }), []);
  const list = useAsync((signal) => (surveyId ? api<AnalysisSummary[]>("/api/admin/ai/analyses", { query: { surveyId }, signal }) : Promise.resolve([])), [surveyId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && list.data?.length) setSelectedId(list.data[0]!.id);
  }, [list.data, selectedId]);

  const analysis = useAsync((signal) => (selectedId ? api<Analysis>(`/api/admin/ai/analyses/${selectedId}`, { signal }) : Promise.resolve(null)), [selectedId]);

  const run = async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await api<{ id: string }>("/api/admin/ai/analyze", { method: "POST", body: query });
      list.reload();
      setSelectedId(res.id);
    } catch (e) {
      setRunError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  const configured = status.data?.configured;
  return (
    <>
      <PageHeader
        eyebrow="Módulo opcional"
        title="Análise Inteligente de Feedback"
        description="A IA agrupa comentários em temas, identifica elogios, críticas, dificuldades e sugestões e compara os grupos. Ela só pode citar comentários existentes: cada tema leva aos textos originais, e as contagens são recalculadas pelo servidor."
        actions={
          configured && (
            <button type="button" className="btn btn-primary" onClick={run} disabled={running || !surveyId}>
              <Sparkles /> {running ? "Analisando… (pode levar 1–2 min)" : "Executar nova análise"}
            </button>
          )
        }
      />
      {status.loading && <Loading />}
      {status.data && !configured && (
        <div className="alert alert-info">
          <Bot />
          <div className="stack-sm">
            <strong>Análise por IA não configurada.</strong>
            <span>Todo o restante do sistema funciona normalmente. Para ativar, defina no servidor <code>ANTHROPIC_API_KEY</code> (padrão) ou <code>AI_PROVIDER=openai</code> + <code>AI_API_KEY</code> + <code>AI_MODEL</code>. A chave nunca é enviada ao navegador.</span>
          </div>
        </div>
      )}
      {configured && (
        <>
          <p className="panel-note">Provedor: {status.data!.provider} · modelo {status.data!.model}. A análise usa os filtros abaixo.</p>
          <FilterBar show={["versionId", "profession", "questionKey", "from", "to"]} />
        </>
      )}
      {runError && <div className="alert alert-error" role="alert">{runError}</div>}
      {list.data && list.data.length > 0 && (
        <div className="row">
          <label htmlFor="ai-history" className="field-label">Análises anteriores</label>
          <select id="ai-history" className="select history-select" value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
            {list.data.map((a) => (
              <option key={a.id} value={a.id}>{dateTime(a.createdAt)} · v{a.versionNumber ?? "?"} · {a.sourceCount} comentários · {a.model}</option>
            ))}
          </select>
        </div>
      )}
      {analysis.loading && selectedId && <Loading />}
      {analysis.error != null && <ErrorState error={analysis.error} />}
      {analysis.data && <AnalysisView a={analysis.data} />}
    </>
  );
}

function AnalysisView({ a }: { a: Analysis }) {
  return (
    <div className="stack-lg">
      <div className="split">
        <section className="panel">
          <h2 className="panel-title">Resumo geral</h2>
          <p>{a.result.overallSummary}</p>
        </section>
        <section className="panel">
          <h2 className="panel-title">Residentes × Fisioterapeutas</h2>
          <p>{a.result.groupComparison}</p>
          <p className="panel-note">Leitura descritiva; não indica significância estatística.</p>
        </section>
      </div>
      <p className="panel-note">
        {a.sourceCount} comentário(s) analisado(s) em {dateTime(a.createdAt)}.{a.result.discardedIds > 0 && ` ${a.result.discardedIds} referência(s) inexistente(s) foram descartadas pelo servidor.`}
      </p>
      <div className="theme-list">
        {a.result.themes.map((t, i) => (
          <ThemeCard key={i} theme={t} sources={t.docIds.map((id) => a.sources[id]).filter((s): s is TextDoc => Boolean(s))} />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({ theme, sources }: { theme: Theme; sources: TextDoc[] }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="theme-card">
      <div className="row-between">
        <div className="stack-sm">
          <p className="eyebrow">Tema: {theme.category}</p>
          <h3 className="theme-title">{theme.title}</h3>
        </div>
        <span className="theme-count"><b className="num">{theme.count}</b> comentários relacionados</span>
      </div>
      <p className="theme-summary">“{theme.summary}”</p>
      <div className="row">
        {theme.kinds.map((k) => <span key={k} className="badge">{KIND_LABELS[k] ?? k}</span>)}
        {theme.byProfession.map((p) => <span key={p.code} className="badge badge-accent">{p.label}: {p.count}</span>)}
      </div>
      <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? <ChevronUp /> : <ChevronDown />} {open ? "Ocultar" : "Ver"} comentários originais ({sources.length})
      </button>
      {open && <SourceList docs={sources} />}
    </article>
  );
}
