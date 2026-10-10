import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "../../lib/format.ts";
import { AXIS, TooltipBox } from "./ChartTooltip.tsx";

export interface GroupDatum {
  label: string;
  text: string;
  a: number | null;
  b: number | null;
  na: number;
  nb: number;
}

/** Médias lado a lado para dois grupos (azul = A, laranja = B), com legenda e rótulos diretos. */
export function GroupBarsChart({ data, labelA, labelB, domain = [1, 5] }: { data: GroupDatum[]; labelA: string; labelB: string; domain?: [number, number] }) {
  // Sem nota → barra de comprimento zero (no início do domínio) e rótulo "—": a linha nunca desaparece.
  const rows = data.map((d) => ({
    ...d,
    va: d.a ?? domain[0],
    vb: d.b ?? domain[0],
    la: d.a === null ? "—" : fmt(d.a),
    lb: d.b === null ? "—" : fmt(d.b),
  }));
  const label = (props: unknown) => {
    const { x = 0, y = 0, width = 0, height = 0, value } = props as { x?: number; y?: number; width?: number; height?: number; value?: string };
    return (
      <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dominantBaseline="middle" fill="var(--text-muted)" fontSize={11} fontFamily="var(--font-mono)">
        {value}
      </text>
    );
  };
  return (
    <div className="stack-sm">
      <div className="legend">
        <span><i style={{ background: "var(--series-a)" }} />{labelA}</span>
        <span><i style={{ background: "var(--series-b)" }} />{labelB}</span>
      </div>
      <div className="chart-box" style={{ height: Math.max(240, rows.length * 52 + 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap={10} barGap={2}>
            <CartesianGrid horizontal={false} stroke="var(--axis-grid)" />
            <XAxis type="number" domain={domain} {...AXIS} />
            <YAxis type="category" dataKey="label" width={170} {...AXIS} axisLine={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                const d = active && (payload?.[0]?.payload as GroupDatum | undefined);
                if (!d) return null;
                return (
                  <TooltipBox
                    title={d.text}
                    rows={[
                      { label: labelA, value: `${fmt(d.a)} (n=${d.na})`, swatch: "var(--series-a)" },
                      { label: labelB, value: `${fmt(d.b)} (n=${d.nb})`, swatch: "var(--series-b)" },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="va" name={labelA} fill="var(--series-a)" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="la" content={label} />
            </Bar>
            <Bar dataKey="vb" name={labelB} fill="var(--series-b)" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="lb" content={label} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
