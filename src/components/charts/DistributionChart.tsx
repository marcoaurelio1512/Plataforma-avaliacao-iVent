import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LIKERT_LABELS } from "../../../shared/domain.ts";
import { pct } from "../../lib/format.ts";
import { AXIS, SCALE_FILLS, TooltipBox, shortLabel } from "./ChartTooltip.tsx";

export interface DistributionDatum {
  position: number;
  key: string;
  category: string | null;
  text: string;
  n: number;
  frequencies: { value: number; count: number; relative: number }[];
}

/** Distribuição 1–5 empilhada em 100% (somente respostas válidas). */
export function DistributionChart({ data }: { data: DistributionDatum[] }) {
  const rows = data.map((d) => ({
    label: shortLabel(d.position, d.category, d.key),
    text: d.text,
    n: d.n,
    ...Object.fromEntries(d.frequencies.map((f) => [`v${f.value}`, f.relative])),
    ...Object.fromEntries(d.frequencies.map((f) => [`c${f.value}`, f.count])),
  }));
  return (
    <div className="stack-sm">
      <div className="legend" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((v) => (
          <span key={v}>
            <i style={{ background: SCALE_FILLS[v - 1] }} />
            {v} — {LIKERT_LABELS[v]}
          </span>
        ))}
      </div>
      <div className="chart-box" style={{ height: Math.max(220, rows.length * 34 + 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" stackOffset="expand" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barCategoryGap={8}>
            <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v * 100)}%`} {...AXIS} />
            <YAxis type="category" dataKey="label" width={170} {...AXIS} axisLine={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                const d = active && (payload?.[0]?.payload as Record<string, number | string> | undefined);
                if (!d) return null;
                return (
                  <TooltipBox
                    title={`${d.text} (n=${d.n})`}
                    rows={[5, 4, 3, 2, 1].map((v) => ({ label: `${v} — ${LIKERT_LABELS[v]}`, value: `${d[`c${v}`]} · ${pct(d[`v${v}`] as number, 0)}`, swatch: SCALE_FILLS[v - 1] }))}
                  />
                );
              }}
            />
            {[1, 2, 3, 4, 5].map((v) => (
              <Bar key={v} dataKey={`v${v}`} stackId="d" fill={SCALE_FILLS[v - 1]} stroke="var(--surface-1)" strokeWidth={2} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
