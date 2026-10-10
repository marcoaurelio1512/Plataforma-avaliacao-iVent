/**
 * Análises descritivas sobre um Dataset (funções puras, testáveis sem banco).
 */
import { isQuantitative, isTextType, scaleBounds, type QuestionDef } from "../../shared/domain.ts";
import {
  compareGroups,
  describeCategorical,
  describeScale,
  mean,
  type CategoricalRow,
  type GroupComparison,
  type ScaleSummary,
} from "../../shared/stats.ts";
import type { TextDocument } from "../../shared/text.ts";
import type { Dataset, DatasetResponse } from "./dataset.ts";

export interface QuestionStats {
  questionId: string;
  key: string;
  position: number;
  text: string;
  category: string | null;
  type: QuestionDef["type"];
  section: QuestionDef["section"];
  scaleMin: number | null;
  scaleMax: number | null;
  scale: ScaleSummary | null;
  categorical: { respondents: number; rows: CategoricalRow[] } | null;
  textAnswers: number;
  comments: number;
}

const YES_NO_OPTIONS = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
];

export function questionStats(questions: readonly QuestionDef[], responses: readonly DatasetResponse[]): QuestionStats[] {
  return questions.map((q, position) => {
    const records = responses.map((r) => r.answers.get(q.id!)).filter((a) => a !== undefined);
    const comments = records.filter((a) => a.comment && a.comment.trim()).length;
    const base = {
      questionId: q.id!,
      key: q.key,
      position,
      text: q.text,
      category: q.category ?? null,
      type: q.type,
      section: q.section,
      scaleMin: null as number | null,
      scaleMax: null as number | null,
      scale: null as ScaleSummary | null,
      categorical: null as QuestionStats["categorical"],
      textAnswers: 0,
      comments,
    };
    if (isQuantitative(q.type)) {
      const { min, max } = scaleBounds(q);
      const scale = describeScale(
        records.map((a) => ({ value: a.numeric, special: a.special })),
        { min, max, totalResponses: responses.length },
      );
      return { ...base, scaleMin: min, scaleMax: max, scale };
    }
    if (isTextType(q.type)) {
      return { ...base, textAnswers: records.filter((a) => a.text && a.text.trim()).length };
    }
    const options = q.type === "yes_no" ? YES_NO_OPTIONS : q.options.map((o) => ({ value: o.value, label: o.label }));
    return { ...base, categorical: describeCategorical(records.map((a) => a.choices ?? []), options) };
  });
}

/** Média geral: todas as notas válidas das perguntas Likert 1–5 (escala comum). */
export function pooledLikert(questions: readonly QuestionDef[], responses: readonly DatasetResponse[]): { mean: number | null; n: number } {
  const likertIds = questions.filter((q) => q.type === "likert").map((q) => q.id!);
  const values: number[] = [];
  for (const r of responses) {
    for (const id of likertIds) {
      const a = r.answers.get(id);
      if (a && !a.special && a.numeric !== null) values.push(a.numeric);
    }
  }
  return { mean: mean(values), n: values.length };
}

export interface Overview {
  totalParticipants: number;
  completedResponses: number;
  byProfession: { code: string; label: string; count: number }[];
  generalMean: { mean: number | null; n: number };
  commentCount: number;
  openAnswerCount: number;
  firstSubmission: string | null;
  lastSubmission: string | null;
}

export function overview(ds: Dataset): Overview {
  const byProfession = new Map<string, { code: string; label: string; count: number }>();
  for (const r of ds.responses) {
    const entry = byProfession.get(r.profession) ?? { code: r.profession, label: r.professionLabel, count: 0 };
    byProfession.set(r.profession, { ...entry, count: entry.count + 1 });
  }
  const openIds = new Set(ds.questions.filter((q) => isTextType(q.type)).map((q) => q.id!));
  let commentCount = 0;
  let openAnswerCount = 0;
  for (const r of ds.responses) {
    for (const [qid, a] of r.answers) {
      if (a.comment?.trim()) commentCount += 1;
      if (openIds.has(qid) && a.text?.trim()) openAnswerCount += 1;
    }
  }
  const times = ds.responses.map((r) => r.submittedAt.getTime());
  return {
    totalParticipants: new Set(ds.responses.map((r) => r.participantId)).size,
    completedResponses: ds.responses.length,
    byProfession: [...byProfession.values()],
    generalMean: pooledLikert(ds.questions, ds.responses),
    commentCount,
    openAnswerCount,
    firstSubmission: times.length ? new Date(Math.min(...times)).toISOString() : null,
    lastSubmission: times.length ? new Date(Math.max(...times)).toISOString() : null,
  };
}

const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export interface TimelinePoint {
  date: string;
  responses: number;
  cumulativeResponses: number;
  dayMean: number | null;
  cumulativeMean: number | null;
}

/** Evolução das avaliações ao longo da coleta (média diária e acumulada). */
export function timeline(ds: Dataset): TimelinePoint[] {
  const likertIds = ds.questions.filter((q) => q.type === "likert").map((q) => q.id!);
  const days = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const r of ds.responses) {
    const key = dayKey(r.submittedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const values = days.get(key) ?? [];
    for (const id of likertIds) {
      const a = r.answers.get(id);
      if (a && !a.special && a.numeric !== null) values.push(a.numeric);
    }
    days.set(key, values);
  }
  const ordered = [...counts.keys()].sort();
  let cumulative: number[] = [];
  let cumulativeCount = 0;
  return ordered.map((date) => {
    const values = days.get(date) ?? [];
    cumulative = [...cumulative, ...values];
    cumulativeCount += counts.get(date) ?? 0;
    return { date, responses: counts.get(date) ?? 0, cumulativeResponses: cumulativeCount, dayMean: mean(values), cumulativeMean: mean(cumulative) };
  });
}

export interface GroupQuestionComparison {
  questionId: string;
  key: string;
  text: string;
  category: string | null;
  scaleMin: number;
  scaleMax: number;
  comparison: GroupComparison;
  distributionA: { value: number; count: number; relative: number }[];
  distributionB: { value: number; count: number; relative: number }[];
  notUsedA: number;
  notUsedB: number;
}

export interface GroupComparisonResult {
  groupA: { code: string; label: string; n: number };
  groupB: { code: string; label: string; n: number };
  overall: GroupComparison;
  questions: GroupQuestionComparison[];
}

export function compareProfessions(ds: Dataset, codeA: string, codeB: string, labels: Map<string, string>): GroupComparisonResult {
  const ra = ds.responses.filter((r) => r.profession === codeA);
  const rb = ds.responses.filter((r) => r.profession === codeB);
  const valuesOf = (rs: readonly DatasetResponse[], q: QuestionDef) =>
    rs.map((r) => r.answers.get(q.id!)).filter((a) => a && !a.special && a.numeric !== null).map((a) => a!.numeric as number);
  const scaleQs = ds.questions.filter((q) => isQuantitative(q.type));
  const questions = scaleQs.map((q) => {
    const { min, max } = scaleBounds(q);
    const sa = describeScale(ra.map((r) => r.answers.get(q.id!)).filter(Boolean).map((a) => ({ value: a!.numeric, special: a!.special })), {
      min, max, totalResponses: ra.length,
    });
    const sb = describeScale(rb.map((r) => r.answers.get(q.id!)).filter(Boolean).map((a) => ({ value: a!.numeric, special: a!.special })), {
      min, max, totalResponses: rb.length,
    });
    return {
      questionId: q.id!,
      key: q.key,
      text: q.text,
      category: q.category ?? null,
      scaleMin: min,
      scaleMax: max,
      comparison: compareGroups(valuesOf(ra, q), valuesOf(rb, q)),
      distributionA: sa.frequencies,
      distributionB: sb.frequencies,
      notUsedA: sa.notUsed,
      notUsedB: sb.notUsed,
    };
  });
  const likert = ds.questions.filter((q) => q.type === "likert");
  const pooled = (rs: readonly DatasetResponse[]) => likert.flatMap((q) => valuesOf(rs, q));
  return {
    groupA: { code: codeA, label: labels.get(codeA) ?? codeA, n: ra.length },
    groupB: { code: codeB, label: labels.get(codeB) ?? codeB, n: rb.length },
    overall: compareGroups(pooled(ra), pooled(rb)),
    questions,
  };
}

export interface TextMeta {
  kind: "open" | "comment";
  answerId: string;
  responseId: string;
  questionId: string;
  questionKey: string;
  questionText: string;
  questionCategory: string | null;
  profession: string;
  professionLabel: string;
  participantCode: string;
  submittedAt: string;
  iventVersionLabel: string | null;
}

/** Textos livres (perguntas abertas + comentários por item) como documentos de análise. */
export function textDocuments(ds: Dataset, opts: { questionKey?: string; search?: string } = {}): TextDocument<TextMeta>[] {
  const docs: TextDocument<TextMeta>[] = [];
  const needle = opts.search?.trim().toLocaleLowerCase("pt-BR");
  for (const r of ds.responses) {
    for (const q of ds.questions) {
      if (opts.questionKey && q.key !== opts.questionKey) continue;
      const a = r.answers.get(q.id!);
      if (!a) continue;
      const meta = (kind: TextMeta["kind"]): TextMeta => ({
        kind,
        answerId: a.answerId,
        responseId: r.id,
        questionId: q.id!,
        questionKey: q.key,
        questionText: q.text,
        questionCategory: q.category ?? null,
        profession: r.profession,
        professionLabel: r.professionLabel,
        participantCode: r.participantCode,
        submittedAt: r.submittedAt.toISOString(),
        iventVersionLabel: r.iventVersionLabel,
      });
      if (isTextType(q.type) && a.text?.trim()) docs.push({ id: `${a.answerId}:open`, participantId: r.participantId, text: a.text, meta: meta("open") });
      if (a.comment?.trim()) docs.push({ id: `${a.answerId}:comment`, participantId: r.participantId, text: a.comment, meta: meta("comment") });
    }
  }
  return needle ? docs.filter((d) => d.text.toLocaleLowerCase("pt-BR").includes(needle)) : docs;
}
