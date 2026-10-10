import type { ReactNode } from "react";

/** Caixa de tooltip comum aos gráficos (texto em tokens de texto, nunca na cor da série). */
export function TooltipBox({ title, rows }: { title: ReactNode; rows: { label: ReactNode; value: ReactNode; swatch?: string }[] }) {
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="chart-tooltip-row">
          <span>
            {r.swatch && <i style={{ background: r.swatch }} />}
            {r.label}
          </span>
          <strong className="num">{r.value}</strong>
        </div>
      ))}
    </div>
  );
}

export const AXIS = {
  stroke: "var(--axis-line)",
  tick: { fill: "var(--axis-text)", fontSize: 11 },
  tickLine: false,
} as const;

export const SCALE_FILLS = ["var(--scale-1)", "var(--scale-2)", "var(--scale-3)", "var(--scale-4)", "var(--scale-5)"];

/** Rótulo curto de pergunta para eixos: "Q1 · Interface". */
export function shortLabel(position: number, category: string | null, key: string): string {
  return `Q${position + 1} · ${category ?? key}`;
}
