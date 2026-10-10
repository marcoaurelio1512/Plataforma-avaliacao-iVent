/**
 * Estatística descritiva das escalas.
 *
 * Regra metodológica central: "Não utilizei este recurso" e "Não se aplica"
 * NUNCA entram em média, mediana, desvio-padrão ou frequência relativa — são
 * contados à parte. Toda saída carrega o n válido usado no cálculo.
 */
import type { SpecialAnswer } from "./domain.ts";

export interface ScaleObservation {
  value?: number | null;
  special?: SpecialAnswer | null;
}

export interface FrequencyRow {
  value: number;
  count: number;
  /** Proporção sobre as respostas válidas (0–1). */
  relative: number;
}

export interface ScaleSummary {
  validN: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  notUsed: number;
  notApplicable: number;
  /** Respostas enviadas que não registraram nada para a pergunta. */
  missing: number;
  frequencies: FrequencyRow[];
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Desvio-padrão amostral (denominador n−1). Indefinido para n < 2. */
export function sampleStdDev(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const squares = values.reduce((sum, v) => sum + (v - m) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

export function validValues(observations: readonly ScaleObservation[]): number[] {
  return observations
    .filter((o) => !o.special && typeof o.value === "number" && Number.isFinite(o.value))
    .map((o) => o.value as number);
}

export function describeScale(
  observations: readonly ScaleObservation[],
  opts: { min: number; max: number; totalResponses: number },
): ScaleSummary {
  const values = validValues(observations);
  const notUsed = observations.filter((o) => o.special === "not_used").length;
  const notApplicable = observations.filter((o) => o.special === "not_applicable").length;
  const recorded = values.length + notUsed + notApplicable;
  const points = scalePoints(opts.min, opts.max);
  const frequencies = points.map((value) => {
    const count = values.filter((v) => v === value).length;
    return { value, count, relative: values.length ? count / values.length : 0 };
  });
  return {
    validN: values.length,
    mean: mean(values),
    median: median(values),
    sd: sampleStdDev(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    notUsed,
    notApplicable,
    missing: Math.max(0, opts.totalResponses - recorded),
    frequencies,
  };
}

/** Pontos inteiros da escala; escalas muito largas são limitadas a 101 pontos. */
export function scalePoints(min: number, max: number): number[] {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) return [];
  const span = Math.min(hi - lo, 100);
  return Array.from({ length: span + 1 }, (_, i) => lo + i);
}

export interface CategoricalRow {
  value: string;
  label: string;
  count: number;
  relative: number;
}

/**
 * Frequência de respostas categóricas. Em seleção múltipla, o denominador é o
 * número de respondentes (as proporções podem somar mais de 100%).
 */
export function describeCategorical(
  selections: readonly string[][],
  options: readonly { value: string; label: string }[],
): { respondents: number; rows: CategoricalRow[] } {
  const respondents = selections.filter((s) => s.length > 0).length;
  const rows = options.map((opt) => {
    const count = selections.filter((s) => s.includes(opt.value)).length;
    return { value: opt.value, label: opt.label, count, relative: respondents ? count / respondents : 0 };
  });
  return { respondents, rows };
}

export interface GroupComparison {
  a: { n: number; mean: number | null; median: number | null; sd: number | null };
  b: { n: number; mean: number | null; median: number | null; sd: number | null };
  meanDifference: number | null;
  note: string;
}

export const GROUP_COMPARISON_NOTE =
  "Comparação descritiva: a diferença entre médias, isoladamente, não indica significância estatística. Interprete considerando o tamanho de cada grupo.";

export function compareGroups(a: readonly number[], b: readonly number[]): GroupComparison {
  const summary = (v: readonly number[]) => ({ n: v.length, mean: mean(v), median: median(v), sd: sampleStdDev(v) });
  const sa = summary(a);
  const sb = summary(b);
  return {
    a: sa,
    b: sb,
    meanDifference: sa.mean !== null && sb.mean !== null ? sa.mean - sb.mean : null,
    note: GROUP_COMPARISON_NOTE,
  };
}

/** Formata número no padrão brasileiro (vírgula decimal). */
export function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}
