import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "../../lib/format.ts";
import { AXIS, TooltipBox, shortLabel } from "./ChartTooltip.tsx";

export interface MeanDatum {
  position: number;
  key: string;
  category: string | null;
  text: string;
  mean: number | null;
  median: number | null;
  sd: number | null;
  n: number;
  notUsed: number;
}

const toneFill = (m: number) => (m >= 4 ? "var(--scale-5)" : m >= 3.2 ? "var(--accent)" : m >= 2.6 ? "var(--warning)" : "var(--critical)");

/** Média por pergunta (escala 1–5), com n válido no rótulo. */
export function MeansChart({ data }: { data: MeanDatum[] }) {
  // Toda linha tem valor dentro do domínio (sem nota → barra transparente de comprimento zero),
  // e cada rótulo lê o próprio texto: nada depende da posição do item renderizado.
  const rows = data.map((d) => ({
    ...d,
    label: shortLabel(d.position, d.category, d.key),
    value: d.mean ?? 1,
    valueLabel: d.mean === null ? `sem dados · n=${d.n}` : `${fmt(d.mean)} · n=${d.n}`,
  }));
  return (
    <div className="chart-box" style={{ height: Math.max(220, rows.length * 38 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 96, bottom: 4, left: 8 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke="var(--axis-grid)" />
          <XAxis type="number" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS} />
          <YAxis type="category" dataKey="label" width={170} {...AXIS} axisLine={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              const d = active && payload?.[0]?.payload;
              if (!d) return null;
              return (
                <TooltipBox
                  title={d.text}
                  rows={[
                    { label: "Média", value: fmt(d.mean) },
                    { label: "Mediana", value: fmt(d.median, 1) },
                    { label: "Desvio-padrão", value: fmt(d.sd) },
                    { label: "n válido", value: d.n },
                    ...(d.notUsed ? [{ label: "Não utilizei / N.A.", value: d.notUsed }] : []),
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.mean === null ? "transparent" : toneFill(r.mean)} />
            ))}
            <LabelList
              dataKey="valueLabel"
              content={(props) => {
                const { x = 0, y = 0, width = 0, height = 0, value } = props as { x?: number; y?: number; width?: number; height?: number; value?: string };
                return (
                  <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2} dominantBaseline="middle" fill="var(--text)" fontSize={12} fontFamily="var(--font-mono)">
                    {value}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
