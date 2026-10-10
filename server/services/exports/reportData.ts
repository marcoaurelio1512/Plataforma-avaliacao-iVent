/**
 * Pacote único de dados para relatórios (PDF/Excel): garante que os números
 * exportados são exatamente os mesmos das telas.
 */
import { PHYSIO, RESIDENT } from "../../../shared/domain.ts";
import type { CloudTerm } from "../../../shared/text.ts";
import { query, queryOne } from "../../db.ts";
import {
  compareProfessions,
  overview,
  questionStats,
  textDocuments,
  type GroupComparisonResult,
  type Overview,
  type QuestionStats,
  type TextMeta,
} from "../analytics.ts";
import type { AiAnalysisResult } from "../ai.ts";
import type { Dataset } from "../dataset.ts";
import { computePriorities, keywordThemeAssignments, type PriorityItem } from "../priorities.ts";
import { getTextSettings } from "../textSettings.ts";
import { versionEvolution, type EvolutionResult } from "../versions.ts";
import { computeCloud } from "../wordcloud.ts";

export interface ResearchMeta {
  protocolNumber: string | null;
  institution: string | null;
  leadResearcher: string | null;
}

export interface ReportData {
  ds: Dataset;
  overview: Overview;
  stats: QuestionStats[];
  groups: GroupComparisonResult;
  cloud: CloudTerm<TextMeta>[];
  priorities: PriorityItem[];
  ai: { result: AiAnalysisResult; createdAt: string; model: string } | null;
  evolution: EvolutionResult;
  research: ResearchMeta;
  generatedAt: Date;
}

export async function professionLabels(): Promise<Map<string, string>> {
  const rows = await query<{ code: string; label: string }>(`SELECT code, label FROM professional_categories`);
  return new Map(rows.map((r) => [r.code, r.label]));
}

export async function latestAiAnalysis(versionId: string) {
  const row = await queryOne<{ result: AiAnalysisResult; created_at: Date; model: string }>(
    `SELECT result, created_at, model FROM text_analyses WHERE survey_version_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [versionId],
  );
  return row ? { result: row.result, createdAt: row.created_at.toISOString(), model: row.model } : null;
}

export async function buildReportData(ds: Dataset): Promise<ReportData> {
  const [labels, settings, ai, evolution, research] = await Promise.all([
    professionLabels(),
    getTextSettings(),
    latestAiAnalysis(ds.version.id),
    versionEvolution({ profession: ds.filters.profession }),
    queryOne<{ protocol_number: string | null; institution: string | null; lead_researcher: string | null }>(
      `SELECT protocol_number, institution, lead_researcher FROM surveys WHERE id = $1`,
      [ds.survey.id],
    ),
  ]);
  const docs = textDocuments(ds);
  const assignments = ai
    ? ai.result.themes.map((t) => ({ theme: t.category, docIds: t.docIds }))
    : keywordThemeAssignments(docs);
  return {
    ds,
    overview: overview(ds),
    stats: questionStats(ds.questions, ds.responses),
    groups: compareProfessions(ds, RESIDENT, PHYSIO, labels),
    cloud: computeCloud(ds, settings),
    priorities: computePriorities(ds, docs, assignments),
    ai,
    evolution,
    research: {
      protocolNumber: research?.protocol_number ?? null,
      institution: research?.institution ?? null,
      leadResearcher: research?.lead_researcher ?? null,
    },
    generatedAt: new Date(),
  };
}

export const METHODOLOGY_TEXT = [
  "Estatística descritiva por pergunta: média, mediana, desvio-padrão amostral (n−1), frequências absolutas e relativas.",
  "As escalas Likert vão de 1 (Discordo totalmente) a 5 (Concordo totalmente).",
  "As respostas \"Não utilizei este recurso\" e \"Não se aplica\" não entram em nenhum cálculo de tendência central e são contadas à parte; nunca são convertidas em zero.",
  "Cada estatística informa o número de respostas válidas (n) utilizado no cálculo. A média geral reúne todas as notas válidas das perguntas Likert 1–5.",
  "A comparação entre categorias profissionais é descritiva: diferenças entre médias, por si só, não indicam significância estatística.",
  "A nuvem de palavras utiliza respostas abertas e comentários por item, com normalização de maiúsculas, acentos, pontuação, stopwords e plurais, preservando termos técnicos. O texto original não é alterado.",
];

export const LIMITATIONS_TEXT = [
  "Amostra por conveniência e de tamanho reduzido; os resultados não devem ser generalizados.",
  "O questionário não foi submetido a processo formal de validação psicométrica.",
  "Este relatório não declara aprovação por Comitê de Ética em Pesquisa.",
  "Respostas autorrelatadas e anônimas, sujeitas a vieses de percepção e de desejabilidade social.",
  "A priorização de melhorias é uma ferramenta operacional para o desenvolvimento do iVent, não evidência científica.",
  "Análises por IA, quando presentes, são exploratórias e sempre vinculadas aos comentários originais que as fundamentam.",
];
