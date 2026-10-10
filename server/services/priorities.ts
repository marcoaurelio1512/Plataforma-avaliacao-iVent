/**
 * "Principais oportunidades de melhoria": combina, de forma transparente, a nota
 * média das perguntas relacionadas ao tema com a proporção de participantes que
 * o mencionaram. Ferramenta operacional — não é evidência científica.
 */
import { mean } from "../../shared/stats.ts";
import type { TextDocument } from "../../shared/text.ts";
import { THEMES, THEME_QUESTION_CATEGORIES, classifyThemes, computePriority, type PriorityLevel } from "../../shared/themes.ts";
import type { TextMeta } from "./analytics.ts";
import type { Dataset } from "./dataset.ts";

export interface ThemeAssignment {
  theme: string;
  docIds: string[];
}

export interface PriorityItem {
  theme: string;
  mean: number | null;
  meanN: number;
  scaleMin: number;
  scaleMax: number;
  relatedQuestions: { key: string; text: string }[];
  comments: number;
  participants: number;
  score: number;
  level: PriorityLevel;
  deficit: number | null;
  volume: number;
  docIds: string[];
}

/** Classificação determinística por palavras-chave (não depende de IA). */
export function keywordThemeAssignments(docs: readonly TextDocument<TextMeta>[]): ThemeAssignment[] {
  const byTheme = new Map<string, string[]>();
  for (const doc of docs) {
    for (const theme of classifyThemes(doc.text)) byTheme.set(theme, [...(byTheme.get(theme) ?? []), doc.id]);
  }
  return [...byTheme.entries()].map(([theme, docIds]) => ({ theme, docIds }));
}

export function computePriorities(ds: Dataset, docs: readonly TextDocument<TextMeta>[], assignments: readonly ThemeAssignment[]): PriorityItem[] {
  const docById = new Map(docs.map((d) => [d.id, d]));
  const participantsWithText = new Set(docs.map((d) => d.participantId)).size;
  const themes = new Set<string>([...THEMES.filter((t) => t !== "Outros"), ...assignments.map((a) => a.theme)]);
  const items: PriorityItem[] = [];
  for (const theme of themes) {
    const docIds = [...new Set(assignments.filter((a) => a.theme === theme).flatMap((a) => a.docIds))].filter((id) => docById.has(id));
    const categories = THEME_QUESTION_CATEGORIES[theme as keyof typeof THEME_QUESTION_CATEGORIES] ?? [];
    const related = ds.questions.filter((q) => q.type === "likert" && q.category && categories.includes(q.category));
    const values = ds.responses.flatMap((r) =>
      related.map((q) => r.answers.get(q.id!)).filter((a) => a && !a.special && a.numeric !== null).map((a) => a!.numeric as number),
    );
    if (!docIds.length && !values.length) continue;
    const participants = new Set(docIds.map((id) => docById.get(id)!.participantId)).size;
    const m = mean(values);
    const p = computePriority({ theme, mean: m, scaleMin: 1, scaleMax: 5, participantsMentioning: participants, participantsWithText });
    items.push({
      theme,
      mean: m,
      meanN: values.length,
      scaleMin: 1,
      scaleMax: 5,
      relatedQuestions: related.map((q) => ({ key: q.key, text: q.text })),
      comments: docIds.length,
      participants,
      ...p,
      docIds,
    });
  }
  return items.sort((a, b) => b.score - a.score || b.comments - a.comments);
}
