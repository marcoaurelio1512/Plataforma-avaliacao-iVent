/**
 * Exportação Excel com as 8 abas pedidas. Todo texto passa por safeCell
 * (proteção contra formula injection).
 */
import ExcelJS from "exceljs";
import { SPECIAL_ANSWER_LABELS, isQuantitative } from "../../../shared/domain.ts";
import { profileOptionLabel } from "../../../shared/profileForm.ts";
import { safeCell, type CellValue } from "../../../shared/spreadsheetSafe.ts";
import { GROUP_COMPARISON_NOTE } from "../../../shared/stats.ts";
import { textDocuments } from "../analytics.ts";
import type { ReportData } from "./reportData.ts";

function addSheet(wb: ExcelJS.Workbook, name: string, header: string[], rows: CellValue[][], widths?: number[]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(header.map((h) => safeCell(h)));
  for (const r of rows) ws.addRow(r.map((v) => safeCell(v)));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2230" } };
  header.forEach((h, i) => {
    ws.getColumn(i + 1).width = widths?.[i] ?? Math.min(60, Math.max(12, h.length + 4));
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
  return ws;
}

const round = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? null : Number(v.toFixed(d)));

export async function buildXlsx(data: ReportData): Promise<Buffer> {
  const { ds } = data;
  const wb = new ExcelJS.Workbook();
  wb.creator = "iVent NeoPed — Avaliação";
  wb.created = data.generatedAt;

  addSheet(
    wb,
    "Participantes",
    ["Participante", "Profissão", "Tempo de experiência", "Experiência com simuladores", "Experiência com o iVent", "Dispositivo", "Enviado em", "Versão do iVent"],
    ds.responses.map((r) => [
      r.participantCode, r.professionLabel, profileOptionLabel(ds.profileForm, "experienceYears", r.experienceYears),
      profileOptionLabel(ds.profileForm, "simulatorExperience", r.simulatorExperience),
      profileOptionLabel(ds.profileForm, "iventExperience", r.iventExperience), r.deviceClass ?? "", r.submittedAt, r.iventVersionLabel ?? "",
    ]),
    [14, 34, 20, 26, 26, 12, 22, 16],
  );

  const quantQs = ds.questions.filter((q) => q.section === "quantitative");
  addSheet(
    wb,
    "Respostas quantitativas",
    ["Participante", "Profissão", ...quantQs.map((q, i) => `Q${i + 1} ${q.key}`)],
    ds.responses.map((r) => [
      r.participantCode,
      r.professionLabel,
      ...quantQs.map((q) => {
        const a = r.answers.get(q.id!);
        if (!a) return null;
        if (a.special) return SPECIAL_ANSWER_LABELS[a.special];
        if (isQuantitative(q.type)) return a.numeric;
        return a.choices?.join("; ") ?? a.text;
      }),
    ]),
  );

  const docs = textDocuments(ds);
  const textSheet = (name: string, kind: "comment" | "open") =>
    addSheet(
      wb,
      name,
      ["Participante", "Profissão", "Pergunta", kind === "comment" ? "Comentário" : "Resposta", "Enviado em"],
      docs.filter((d) => d.meta.kind === kind).map((d) => [d.meta.participantCode, d.meta.professionLabel, d.meta.questionText, d.text, new Date(d.meta.submittedAt)]),
      [14, 30, 50, 80, 22],
    );
  textSheet("Comentários", "comment");
  textSheet("Perguntas abertas", "open");

  addSheet(
    wb,
    "Estatísticas",
    ["Chave", "Pergunta", "Categoria", "n válido", "Média", "Mediana", "Desvio-padrão", "Não utilizei", "Não se aplica", "Ausentes",
      "1 (n)", "1 (%)", "2 (n)", "2 (%)", "3 (n)", "3 (%)", "4 (n)", "4 (%)", "5 (n)", "5 (%)"],
    data.stats
      .filter((s) => s.scale)
      .map((s) => {
        const sc = s.scale!;
        const freq = [1, 2, 3, 4, 5].flatMap((v) => {
          const f = sc.frequencies.find((x) => x.value === v);
          return [f?.count ?? null, f ? round(f.relative * 100, 1) : null];
        });
        return [s.key, s.text, s.category, sc.validN, round(sc.mean), round(sc.median), round(sc.sd), sc.notUsed, sc.notApplicable, sc.missing, ...freq];
      }),
  );

  addSheet(
    wb,
    "Frequência de palavras",
    ["Termo", "Ocorrências", "Participantes que mencionaram"],
    data.cloud.slice(0, 300).map((t) => [t.label, t.occurrences, t.participants]),
    [36, 14, 30],
  );

  const g = data.groups;
  const groupWs = addSheet(
    wb,
    "Residentes × Fisioterapeutas",
    ["Chave", "Pergunta", `${g.groupA.label} n`, `${g.groupA.label} média`, `${g.groupA.label} mediana`, `${g.groupA.label} DP`,
      `${g.groupB.label} n`, `${g.groupB.label} média`, `${g.groupB.label} mediana`, `${g.groupB.label} DP`, "Diferença de médias (A − B)"],
    [
      ["GERAL", "Média geral (Likert 1–5)", g.overall.a.n, round(g.overall.a.mean), round(g.overall.a.median), round(g.overall.a.sd),
        g.overall.b.n, round(g.overall.b.mean), round(g.overall.b.median), round(g.overall.b.sd), round(g.overall.meanDifference)],
      ...g.questions.map((q) => [
        q.key, q.text, q.comparison.a.n, round(q.comparison.a.mean), round(q.comparison.a.median), round(q.comparison.a.sd),
        q.comparison.b.n, round(q.comparison.b.mean), round(q.comparison.b.median), round(q.comparison.b.sd), round(q.comparison.meanDifference),
      ]),
    ],
  );
  groupWs.addRow([]);
  groupWs.addRow([safeCell(GROUP_COMPARISON_NOTE)]);

  const ev = data.evolution;
  addSheet(
    wb,
    "Versões do iVent",
    ["Chave", "Pergunta", "Compatível", "Texto variou", ...ev.versions.flatMap((v) => [`${v.label} n`, `${v.label} média`])],
    ev.rows.map((r) => [
      r.key, r.text, r.compatible ? "Sim" : `Não — ${r.incompatibilityReason}`, r.textVaries ? "Sim" : "Não",
      ...ev.versions.flatMap((v) => [r.byVersion[v.id]?.n ?? 0, round(r.byVersion[v.id]?.mean)]),
    ]),
  );

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
