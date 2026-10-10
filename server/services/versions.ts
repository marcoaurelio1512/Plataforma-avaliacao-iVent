/**
 * Evolução entre versões do iVent.
 *
 * Só são comparadas perguntas metodologicamente compatíveis: mesma chave
 * estável, mesmo tipo e mesma escala (mínimo e máximo). Se o texto da pergunta
 * mudou entre versões, a linha é sinalizada para o leitor julgar.
 */
import { mean, median, sampleStdDev } from "../../shared/stats.ts";
import { query } from "../db.ts";

export interface VersionColumn {
  id: string;
  label: string;
  releasedAt: string | null;
}

export interface VersionCell {
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
}

export interface EvolutionRow {
  key: string;
  text: string;
  category: string | null;
  type: string;
  scaleMin: number;
  scaleMax: number;
  compatible: boolean;
  incompatibilityReason: string | null;
  textVaries: boolean;
  byVersion: Record<string, VersionCell>;
}

export interface CategoryEvolution {
  category: string;
  byVersion: Record<string, { n: number; mean: number | null }>;
}

export interface EvolutionResult {
  versions: VersionColumn[];
  rows: EvolutionRow[];
  categories: CategoryEvolution[];
  unassignedResponses: number;
}

interface AnswerRow {
  question_key: string;
  type: string;
  scale_min: number;
  scale_max: number;
  text: string;
  category: string | null;
  ivent_version_id: string | null;
  numeric_value: number | null;
  special: string | null;
}

const validFor = (rows: readonly AnswerRow[], versionId: string) =>
  rows.filter((r) => r.ivent_version_id === versionId && !r.special && r.numeric_value !== null).map((r) => r.numeric_value as number);

export async function versionEvolution(opts: { profession?: string } = {}): Promise<EvolutionResult> {
  const versions = await query<{ id: string; label: string; released_at: Date | null }>(
    `SELECT id, label, released_at FROM ivent_versions ORDER BY COALESCE(released_at, created_at::date), created_at`,
  );
  const params: unknown[] = [];
  let professionSql = "";
  if (opts.profession) {
    params.push(opts.profession);
    professionSql = "AND p.profession_code = $1";
  }
  const rows = await query<AnswerRow>(
    `SELECT q.question_key, q.type, q.scale_min, q.scale_max, q.text, q.category, r.ivent_version_id, a.numeric_value, a.special
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       JOIN survey_responses r ON r.id = a.response_id AND r.status = 'submitted'
       JOIN participants p ON p.id = r.participant_id
      WHERE q.type IN ('likert', 'numeric_scale') ${professionSql}
      ORDER BY r.submitted_at DESC`,
    params,
  );
  const unassigned = await query<{ n: number }>(
    `SELECT count(*) AS n FROM survey_responses WHERE status = 'submitted' AND ivent_version_id IS NULL`,
  );

  const byKey = new Map<string, AnswerRow[]>();
  for (const r of rows) byKey.set(r.question_key, [...(byKey.get(r.question_key) ?? []), r]);

  const evolution: EvolutionRow[] = [...byKey.entries()].map(([key, list]) => {
    const signatures = new Set(list.map((r) => `${r.type}|${r.scale_min}|${r.scale_max}`));
    // Linhas vêm da mais recente para a mais antiga: texto/categoria exibidos são os atuais.
    const first = list[0]!;
    const byVersion: Record<string, VersionCell> = {};
    for (const v of versions) {
      const values = validFor(list, v.id);
      byVersion[v.id] = { n: values.length, mean: mean(values), median: median(values), sd: sampleStdDev(values) };
    }
    return {
      key,
      text: first.text,
      category: first.category,
      type: first.type,
      scaleMin: first.scale_min,
      scaleMax: first.scale_max,
      compatible: signatures.size === 1,
      incompatibilityReason: signatures.size === 1 ? null : "Tipo ou escala da pergunta mudou entre versões.",
      textVaries: new Set(list.map((r) => r.text.trim())).size > 1,
      byVersion,
    };
  });

  // Médias por categoria: apenas perguntas Likert 1–5 compatíveis (escala comum).
  const likertCompatible = evolution.filter((r) => r.compatible && r.type === "likert" && r.category);
  const categoryNames = [...new Set(likertCompatible.map((r) => r.category!))];
  const categories = categoryNames.map((category) => {
    const keys = new Set(likertCompatible.filter((r) => r.category === category).map((r) => r.key));
    const inCategory = rows.filter((r) => keys.has(r.question_key));
    const byVersion: CategoryEvolution["byVersion"] = {};
    for (const v of versions) {
      const values = validFor(inCategory, v.id);
      byVersion[v.id] = { n: values.length, mean: mean(values) };
    }
    return { category, byVersion };
  });

  return {
    versions: versions.map((v) => ({ id: v.id, label: v.label, releasedAt: v.released_at ? v.released_at.toISOString().slice(0, 10) : null })),
    rows: evolution.sort((a, b) => a.key.localeCompare(b.key)),
    categories,
    unassignedResponses: unassigned[0]?.n ?? 0,
  };
}
