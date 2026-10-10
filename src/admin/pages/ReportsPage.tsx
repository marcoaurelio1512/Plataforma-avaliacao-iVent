import { FileSpreadsheet, FileText, FileType } from "lucide-react";
import { useState } from "react";
import { download, errorMessage } from "../../lib/api.ts";
import { FilterBar } from "../components/FilterBar.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { useScope } from "../scope.tsx";

const PDF_CONTENTS = ["Identificação da pesquisa, versão avaliada e período", "Participantes por categoria profissional", "Médias, medianas, desvio-padrão e n válido", "Gráficos de média e distribuição das respostas", "Comparação entre grupos", "Nuvem de palavras e termos mais frequentes", "Principais comentários e análise qualitativa", "Oportunidades de melhoria, metodologia e limitações"];
const XLSX_SHEETS = ["Participantes", "Respostas quantitativas", "Comentários", "Perguntas abertas", "Estatísticas", "Frequência de palavras", "Residentes × Fisioterapeutas", "Versões do iVent"];

export default function ReportsPage() {
  const { query, surveyId } = useScope();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const get = async (id: string, path: string, extra: Record<string, string> = {}) => {
    setBusy(id);
    setError(null);
    try {
      await download(path, { ...query, ...extra });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <PageHeader eyebrow="Exportação" title="Relatórios" description="Os arquivos usam exatamente os filtros abaixo e os mesmos cálculos das telas. Campos de texto livre são protegidos contra injeção de fórmulas nas planilhas." />
      <FilterBar show={["versionId", "profession", "from", "to", "iventVersionId"]} />
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="report-grid">
        <section className="panel report-card">
          <FileText className="report-icon" aria-hidden="true" />
          <h2 className="panel-title">Relatório PDF</h2>
          <ul className="report-list">{PDF_CONTENTS.map((c) => <li key={c}>{c}</li>)}</ul>
          <button type="button" className="btn btn-primary" disabled={!surveyId || busy !== null} onClick={() => get("pdf", "/api/admin/reports/pdf")}>{busy === "pdf" ? "Gerando…" : "Baixar PDF"}</button>
        </section>
        <section className="panel report-card">
          <FileSpreadsheet className="report-icon" aria-hidden="true" />
          <h2 className="panel-title">Planilha Excel</h2>
          <ul className="report-list">{XLSX_SHEETS.map((c, i) => <li key={c}>{i + 1}. {c}</li>)}</ul>
          <button type="button" className="btn btn-primary" disabled={!surveyId || busy !== null} onClick={() => get("xlsx", "/api/admin/reports/xlsx")}>{busy === "xlsx" ? "Gerando…" : "Baixar Excel"}</button>
        </section>
        <section className="panel report-card">
          <FileType className="report-icon" aria-hidden="true" />
          <h2 className="panel-title">CSV</h2>
          <p className="muted">UTF-8 com BOM (abre com acentos no Excel).</p>
          <div className="stack-sm">
            <button type="button" className="btn" disabled={!surveyId || busy !== null} onClick={() => get("c1", "/api/admin/reports/csv", { kind: "respostas" })}>Respostas (formato longo)</button>
            <button type="button" className="btn" disabled={!surveyId || busy !== null} onClick={() => get("c2", "/api/admin/reports/csv", { kind: "comentarios" })}>Comentários e respostas abertas</button>
            <button type="button" className="btn" disabled={!surveyId || busy !== null} onClick={() => get("c3", "/api/admin/reports/csv", { kind: "estatisticas" })}>Estatísticas por pergunta</button>
          </div>
        </section>
      </div>
    </>
  );
}
