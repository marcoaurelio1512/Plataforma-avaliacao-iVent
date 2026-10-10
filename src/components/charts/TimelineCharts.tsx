import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { date, fmt } from "../../lib/format.ts";
import { AXIS, TooltipBox } from "./ChartTooltip.tsx";

export interface TimelinePoint {
  date: string;
  responses: number;
  cumulativeResponses: number;
  dayMean: number | null;
  cumulativeMean: number | null;
}

/** Duas visões separadas (nunca eixo duplo): volume diário e média acumulada. */
export function TimelineCharts({ data }: { data: TimelinePoint[] }) {
  const rows = data.map((d) => ({ ...d, label: date(d.date) }));
  return (
    <div className="split">
      <div className="stack-sm">
        <p className="panel-note">Respostas por dia</p>
        <div className="chart-box" style={{ height: 200, minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--axis-grid)" />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} axisLine={false} />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                content={({ active, payload }) => {
                  const d = active && (payload?.[0]?.payload as (TimelinePoint & { label: string }) | undefined);
                  if (!d) return null;
                  return <TooltipBox title={d.label} rows={[{ label: "Respostas no dia", value: d.responses }, { label: "Acumulado", value: d.cumulativeResponses }]} />;
                }}
              />
              <Bar dataKey="responses" fill="var(--series-a)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="stack-sm">
        <p className="panel-note">Média geral acumulada (Likert 1–5)</p>
        <div className="chart-box" style={{ height: 200, minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--axis-grid)" />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS} axisLine={false} />
              <Tooltip
                cursor={{ stroke: "var(--axis-line)" }}
                content={({ active, payload }) => {
                  const d = active && (payload?.[0]?.payload as (TimelinePoint & { label: string }) | undefined);
                  if (!d) return null;
                  return <TooltipBox title={d.label} rows={[{ label: "Média acumulada", value: fmt(d.cumulativeMean) }, { label: "Média do dia", value: fmt(d.dayMean) }]} />;
                }}
              />
              <Line type="monotone" dataKey="cumulativeMean" stroke="var(--series-a)" strokeWidth={2} dot={{ r: 4, fill: "var(--series-a)", stroke: "var(--surface-1)", strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
