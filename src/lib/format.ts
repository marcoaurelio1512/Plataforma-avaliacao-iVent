export { fmt, pct } from "../../shared/stats.ts";

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR");
}

/** Cor semântica para uma média numa escala (favorável/neutro/atenção). */
export function scoreTone(mean: number | null, min = 1, max = 5): "ok" | "accent" | "warning" | "critical" | "none" {
  if (mean === null) return "none";
  const r = (mean - min) / (max - min);
  if (r >= 0.75) return "ok";
  if (r >= 0.55) return "accent";
  if (r >= 0.4) return "warning";
  return "critical";
}
