import { FileImage, FileText } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PHYSIO, RESIDENT } from "../../../shared/domain.ts";
import { WordCloud, type WordCloudHandle } from "../../components/WordCloud.tsx";
import { Empty, ErrorState, Loading } from "../../components/States.tsx";
import { api, errorMessage, saveBlob } from "../../lib/api.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { Drawer } from "../components/Drawer.tsx";
import { FilterBar } from "../components/FilterBar.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { SourceList } from "../components/SourceList.tsx";
import { useScope } from "../scope.tsx";
import type { TextDoc } from "../types.ts";

interface Term { key: string; label: string; occurrences: number; participants: number; byProfession: { label: string; docs: number }[] }
interface CloudData { cacheKey: string; documents: number; questions: { key: string; text: string }[]; terms: Term[] }
interface TermDetail { key: string; label: string; occurrences: number; participants: number; sources: TextDoc[] }

export default function WordCloudPage() {
  const { query, surveyId, filters, setFilter, survey } = useScope();
  const [metric, setMetric] = useState<"occurrences" | "participants">("occurrences");
  const [selected, setSelected] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const cloudRef = useRef<WordCloudHandle>(null);
  const state = useAsync((signal) => (surveyId ? api<CloudData>("/api/admin/wordcloud", { query: { ...query, limit: 120 }, signal }) : Promise.resolve(null)), [JSON.stringify(query)]);
  const detail = useAsync(
    (signal) => (selected ? api<TermDetail>("/api/admin/wordcloud/term", { query: { ...query, key: selected }, signal }) : Promise.resolve(null)),
    [selected, JSON.stringify(query)],
  );
  const d = state.data;
  const words = useMemo(() => (d?.terms ?? []).map((t) => ({ key: t.key, label: t.label, value: t[metric] })), [d, metric]);

  const filterLabel = [
    filters.profession === RESIDENT ? "Residentes" : filters.profession === PHYSIO ? "Fisioterapeutas" : filters.profession ? filters.profession : "Todos",
    filters.questionKey && `pergunta ${filters.questionKey}`,
    filters.from && `de ${filters.from}`,
    filters.to && `até ${filters.to}`,
  ].filter(Boolean).join(" · ");
  const exportTitle = `Nuvem de palavras — ${survey?.title ?? ""} (${filterLabel})`;

  const exportPng = async () => {
    setExportError(null);
    try {
      saveBlob(await cloudRef.current!.toPng(exportTitle), `nuvem-de-palavras-${new Date().toISOString().slice(0, 10)}.png`);
    } catch (e) {
      setExportError(errorMessage(e));
    }
  };

  const exportPdf = async () => {
    setExportError(null);
    try {
      const [{ jsPDF }, png] = await Promise.all([import("jspdf"), cloudRef.current!.toPng(exportTitle)]);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(png);
      });
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const w = pageW - 60;
      const h = (img.height / img.width) * w;
      pdf.addImage(dataUrl, "PNG", 30, 30, w, Math.min(h, 400));
      pdf.addPage();
      pdf.setFontSize(13);
      pdf.text("Termos mais frequentes", 30, 40);
      pdf.setFontSize(9);
      pdf.text("Termo", 30, 62);
      pdf.text("Ocorrências", 330, 62);
      pdf.text("Participantes", 430, 62);
      (d?.terms ?? []).slice(0, 30).forEach((t, i) => {
        const y = 80 + i * 15;
        pdf.text(t.label.replace(/₂/g, "2"), 30, y);
        pdf.text(String(t.occurrences), 330, y);
        pdf.text(String(t.participants), 430, y);
      });
      pdf.save(`nuvem-de-palavras-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      setExportError(errorMessage(e));
    }
  };

  const t = detail.data;
  return (
    <>
      <PageHeader
        eyebrow="Análise textual"
        title="Nuvem de Palavras — Feedback dos Participantes"
        description="Respostas abertas e comentários por item. Maiúsculas, acentos, pontuação, stopwords e plurais são normalizados; termos técnicos (PEEP, FiO₂, EIT…) e expressões compostas são preservados. Clique em uma palavra para ver os comentários originais."
        actions={
          <>
            <button type="button" className="btn" onClick={exportPng} disabled={!words.length}><FileImage /> PNG</button>
            <button type="button" className="btn" onClick={exportPdf} disabled={!words.length}><FileText /> PDF</button>
          </>
        }
      />
      <div className="tabs" role="tablist" aria-label="Grupo">
        {[{ v: undefined, l: "Todos" }, { v: RESIDENT, l: "Residentes" }, { v: PHYSIO, l: "Fisioterapeutas" }].map((o) => (
          <button key={o.l} type="button" role="tab" className="tab" aria-selected={(filters.profession ?? undefined) === o.v} onClick={() => setFilter("profession", o.v)}>{o.l}</button>
        ))}
      </div>
      <FilterBar show={["versionId", "questionKey", "from", "to", "iventVersionId"]} questions={d?.questions} />
      {exportError && <div className="alert alert-error">{exportError}</div>}
      {state.loading && <Loading label="Calculando a nuvem…" />}
      {state.error != null && <ErrorState error={state.error} onRetry={state.reload} />}
      {d && d.terms.length === 0 && <Empty title="Sem textos para os filtros atuais" />}
      {d && d.terms.length > 0 && (
        <div className="panel-grid">
          <section className="panel panel-8" aria-labelledby="cloud-title">
            <div className="panel-head">
              <div className="stack-sm">
                <h2 id="cloud-title" className="panel-title">{filterLabel}</h2>
                <p className="panel-note">{d.documents} texto(s) analisado(s) · tamanho proporcional ao número de {metric === "occurrences" ? "ocorrências" : "participantes que mencionaram"}</p>
              </div>
              <div className="tabs" role="tablist" aria-label="Tamanho pela métrica">
                <button type="button" role="tab" className="tab" aria-selected={metric === "occurrences"} onClick={() => setMetric("occurrences")}>Ocorrências</button>
                <button type="button" role="tab" className="tab" aria-selected={metric === "participants"} onClick={() => setMetric("participants")}>Participantes</button>
              </div>
            </div>
            <WordCloud ref={cloudRef} words={words} selected={selected} onSelect={setSelected} />
          </section>
          <section className="panel panel-4" aria-labelledby="terms-title">
            <h2 id="terms-title" className="panel-title">Termos</h2>
            <div className="table-wrap terms-table">
              <table className="table table-compact">
                <thead><tr><th>Termo</th><th className="num">Ocorr.</th><th className="num">Partic.</th></tr></thead>
                <tbody>
                  {d.terms.slice(0, 60).map((term) => (
                    <tr key={term.key} className="clickable" tabIndex={0} onClick={() => setSelected(term.key)} onKeyDown={(e) => e.key === "Enter" && setSelected(term.key)}>
                      <td>{term.label}</td><td className="num">{term.occurrences}</td><td className="num">{term.participants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      <Drawer
        open={Boolean(selected)}
        title={t ? `${t.label.toUpperCase()} — mencionada por ${t.participants} participante${t.participants === 1 ? "" : "s"}` : "Carregando…"}
        onClose={() => setSelected(null)}
      >
        {detail.loading && <Loading />}
        {detail.error != null && <ErrorState error={detail.error} />}
        {t && (
          <>
            <div className="stat-strip">
              <div><strong>{t.occurrences}</strong><span>ocorrências (vezes que o termo aparece)</span></div>
              <div><strong>{t.participants}</strong><span>participantes que mencionaram</span></div>
              <div><strong>{t.sources.length}</strong><span>textos</span></div>
            </div>
            <div className="row">
              {Object.entries(t.sources.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.professionLabel]: (acc[s.professionLabel] ?? 0) + 1 }), {})).map(([label, n]) => (
                <span key={label} className="badge">{label}: {n} texto(s)</span>
              ))}
            </div>
            <SourceList docs={t.sources} />
          </>
        )}
      </Drawer>
    </>
  );
}
