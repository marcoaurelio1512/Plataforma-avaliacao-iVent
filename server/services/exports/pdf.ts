/**
 * Relatório PDF profissional (PDFKit, gráficos vetoriais desenhados aqui).
 *
 * Fonte: Noto Sans (subconjunto latino, embutido). Caracteres fora desse
 * subconjunto são adaptados apenas na impressão (ex.: FiO₂ → FiO2); o texto
 * original no banco nunca muda.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import PDFDocument from "pdfkit";
import { fmt, pct, GROUP_COMPARISON_NOTE } from "../../../shared/stats.ts";
import { PRIORITY_FORMULA } from "../../../shared/themes.ts";
import { LIMITATIONS_TEXT, METHODOLOGY_TEXT, type ReportData } from "./reportData.ts";

const require = createRequire(import.meta.url);
const FONT_DIR = join(dirname(require.resolve("@fontsource/noto-sans/package.json")), "files");
const FONT_REGULAR = join(FONT_DIR, "noto-sans-latin-400-normal.woff");
const FONT_BOLD = join(FONT_DIR, "noto-sans-latin-700-normal.woff");

const C = {
  ink: "#1a2230",
  muted: "#4a586e",
  dim: "#6a7890",
  line: "#d5dce7",
  surface: "#f4f7fb",
  accent: "#2d6bb8",
  oxygen: "#1a9a8c",
  warning: "#c4921a",
  critical: "#d64545",
};
/** Grupos: ordem categórica validada (azul, laranja). */
const SERIES_A = "#2a78d6";
const SERIES_B = "#eb6834";
/** Divergente 1→5: crítico → neutro → oxigenação (mesma linguagem do iVent). */
const SCALE_COLORS = ["#d64545", "#e8956b", "#b9c2cf", "#5fb8ad", "#1a9a8c"];

const SUBSCRIPT: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

/** Cobertura do subconjunto latino da Noto Sans (fontsource). */
function inFont(cp: number): boolean {
  return (
    cp <= 0xff || cp === 0x131 || cp === 0x152 || cp === 0x153 || cp === 0x2c6 || cp === 0x2da || cp === 0x2dc ||
    (cp >= 0x2000 && cp <= 0x206f) || cp === 0x20ac || cp === 0x2122 || cp === 0x2212
  );
}

const REPLACEMENTS: Record<string, string> = { "≥": ">=", "≤": "<=", "→": "->", "≈": "~" };

export function pdfText(text: string): string {
  return Array.from(text.replace(/[₀-₉]/g, (c) => SUBSCRIPT[c] ?? c).replace(/[≥≤→≈]/g, (c) => REPLACEMENTS[c] ?? c))
    .filter((ch) => inFont(ch.codePointAt(0)!))
    .join("");
}

type Doc = PDFKit.PDFDocument;
const PAGE = { margin: 50, width: 595.28, height: 841.89 };
const CONTENT_W = PAGE.width - PAGE.margin * 2;
const BOTTOM = PAGE.height - PAGE.margin - 20;

function ensureSpace(doc: Doc, h: number): void {
  if (doc.y + h > BOTTOM) doc.addPage();
}

/** Título de seção; `follow` reserva espaço para o conteúdo seguinte (evita título órfão). */
function heading(doc: Doc, title: string, follow = 80): void {
  ensureSpace(doc, 40 + follow);
  doc.moveDown(0.8);
  doc.font("bold").fontSize(14).fillColor(C.ink).text(pdfText(title), PAGE.margin, doc.y);
  const y = doc.y + 3;
  doc.moveTo(PAGE.margin, y).lineTo(PAGE.margin + 40, y).lineWidth(2).strokeColor(C.accent).stroke();
  doc.moveDown(0.6);
}

function para(doc: Doc, text: string, opts: { size?: number; color?: string; bold?: boolean } = {}): void {
  doc.font(opts.bold ? "bold" : "regular").fontSize(opts.size ?? 9.5).fillColor(opts.color ?? C.ink);
  ensureSpace(doc, doc.heightOfString(pdfText(text), { width: CONTENT_W }) + 4);
  doc.text(pdfText(text), PAGE.margin, doc.y, { width: CONTENT_W, lineGap: 1.5 });
}

function bullets(doc: Doc, items: readonly string[]): void {
  for (const item of items) para(doc, `•  ${item}`, { color: C.muted });
}

interface Column {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
}

function table(doc: Doc, columns: Column[], rows: string[][], opts: { size?: number } = {}): void {
  const size = opts.size ?? 8;
  const pad = 4;
  const drawHeader = () => {
    ensureSpace(doc, 24);
    const y = doc.y;
    doc.rect(PAGE.margin, y, CONTENT_W, 16).fill(C.ink);
    let x = PAGE.margin;
    doc.font("bold").fontSize(size).fillColor("#ffffff");
    for (const c of columns) {
      doc.text(pdfText(c.label), x + pad, y + 4, { width: c.width - pad * 2, align: c.align ?? "left", lineBreak: false, ellipsis: true });
      x += c.width;
    }
    doc.y = y + 16;
  };
  drawHeader();
  rows.forEach((row, ri) => {
    doc.font("regular").fontSize(size);
    const h = Math.max(...row.map((cell, i) => doc.heightOfString(pdfText(cell), { width: columns[i]!.width - pad * 2 }))) + pad * 2;
    if (doc.y + h > BOTTOM) {
      doc.addPage();
      drawHeader();
    }
    doc.font("regular").fontSize(size);
    const y = doc.y;
    if (ri % 2 === 0) doc.rect(PAGE.margin, y, CONTENT_W, h).fill(C.surface);
    let x = PAGE.margin;
    doc.fillColor(C.ink);
    row.forEach((cell, i) => {
      doc.text(pdfText(cell), x + pad, y + pad, { width: columns[i]!.width - pad * 2, align: columns[i]!.align ?? "left" });
      x += columns[i]!.width;
    });
    doc.y = y + h;
  });
  doc.moveDown(0.5);
}

function meansChart(doc: Doc, data: ReportData): void {
  const items = data.stats.filter((s) => s.scale && s.type === "likert");
  if (!items.length) return;
  const rowH = 18;
  const labelW = 150;
  const chartW = CONTENT_W - labelW - 40;
  ensureSpace(doc, items.length * rowH + 30);
  const top = doc.y;
  const x0 = PAGE.margin + labelW;
  for (let v = 1; v <= 5; v++) {
    const x = x0 + ((v - 1) / 4) * chartW;
    doc.moveTo(x, top).lineTo(x, top + items.length * rowH).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font("regular").fontSize(7).fillColor(C.dim).text(String(v), x - 5, top + items.length * rowH + 3, { width: 10, align: "center" });
  }
  items.forEach((s, i) => {
    const y = top + i * rowH;
    doc.font("regular").fontSize(7.5).fillColor(C.muted).text(pdfText(`Q${s.position + 1} · ${s.category ?? s.key}`), PAGE.margin, y + 4, { width: labelW - 8, lineBreak: false, ellipsis: true });
    const m = s.scale!.mean;
    if (m !== null) {
      const w = ((m - 1) / 4) * chartW;
      doc.roundedRect(x0, y + 3, Math.max(w, 2), rowH - 7, 2).fill(m >= 4 ? C.oxygen : m >= 3 ? C.accent : C.warning);
      doc.font("bold").fontSize(7.5).fillColor(C.ink).text(`${fmt(m)} (n=${s.scale!.validN})`, x0 + w + 4, y + 4, { width: 70, lineBreak: false });
    }
  });
  doc.y = top + items.length * rowH + 18;
}

function distributionChart(doc: Doc, data: ReportData): void {
  const items = data.stats.filter((s) => s.scale && s.type === "likert");
  if (!items.length) return;
  const rowH = 16;
  const labelW = 150;
  const chartW = CONTENT_W - labelW;
  ensureSpace(doc, items.length * rowH + 40);
  const top = doc.y;
  items.forEach((s, i) => {
    const y = top + i * rowH;
    doc.font("regular").fontSize(7.5).fillColor(C.muted).text(pdfText(`Q${s.position + 1} · ${s.category ?? s.key}`), PAGE.margin, y + 3, { width: labelW - 8, lineBreak: false, ellipsis: true });
    let x = PAGE.margin + labelW;
    s.scale!.frequencies.forEach((f, k) => {
      const w = f.relative * chartW;
      if (w > 0) {
        doc.rect(x, y + 2, w, rowH - 5).fill(SCALE_COLORS[k] ?? C.dim);
        if (w > 22) doc.font("bold").fontSize(6.5).fillColor("#ffffff").text(pct(f.relative, 0), x, y + 4, { width: w, align: "center", lineBreak: false });
      }
      x += w;
    });
  });
  let lx = PAGE.margin + labelW;
  const ly = top + items.length * rowH + 6;
  ["1 Discordo totalmente", "2", "3 Neutro", "4", "5 Concordo totalmente"].forEach((label, k) => {
    doc.rect(lx, ly, 8, 8).fill(SCALE_COLORS[k]!);
    doc.font("regular").fontSize(7).fillColor(C.muted).text(label, lx + 11, ly, { lineBreak: false });
    lx += doc.widthOfString(label) + 26;
  });
  doc.y = ly + 18;
}

function groupBars(doc: Doc, data: ReportData): void {
  const g = data.groups;
  const items = g.questions.filter((q) => q.scaleMax === 5 && q.scaleMin === 1);
  if (!items.length) return;
  const rowH = 22;
  const labelW = 150;
  const chartW = CONTENT_W - labelW - 50;
  ensureSpace(doc, items.length * rowH + 30);
  const top = doc.y;
  items.forEach((q, i) => {
    const y = top + i * rowH;
    doc.font("regular").fontSize(7.5).fillColor(C.muted).text(pdfText(q.category ?? q.key), PAGE.margin, y + 6, { width: labelW - 8, lineBreak: false, ellipsis: true });
    const bar = (m: number | null, n: number, dy: number, color: string) => {
      if (m === null) return;
      const w = ((m - 1) / 4) * chartW;
      doc.rect(PAGE.margin + labelW, y + dy, Math.max(w, 2), 8).fill(color);
      doc.font("regular").fontSize(6.5).fillColor(C.ink).text(`${fmt(m)} (n=${n})`, PAGE.margin + labelW + w + 3, y + dy, { lineBreak: false });
    };
    bar(q.comparison.a.mean, q.comparison.a.n, 2, SERIES_A);
    bar(q.comparison.b.mean, q.comparison.b.n, 11, SERIES_B);
  });
  const ly = top + items.length * rowH + 4;
  doc.rect(PAGE.margin + labelW, ly, 8, 8).fill(SERIES_A);
  doc.font("regular").fontSize(7).fillColor(C.muted).text(pdfText(g.groupA.label), PAGE.margin + labelW + 11, ly, { lineBreak: false });
  const off = doc.widthOfString(pdfText(g.groupA.label)) + 30;
  doc.rect(PAGE.margin + labelW + off, ly, 8, 8).fill(SERIES_B);
  doc.font("regular").fontSize(7).fillColor(C.muted).text(pdfText(g.groupB.label), PAGE.margin + labelW + off + 11, ly, { lineBreak: false });
  doc.y = ly + 18;
}

/** Nuvem em fluxo centralizado: tamanho proporcional às ocorrências. */
function wordCloud(doc: Doc, data: ReportData): void {
  const terms = data.cloud.slice(0, 60);
  if (!terms.length) {
    para(doc, "Sem textos suficientes para a nuvem de palavras.", { color: C.muted });
    return;
  }
  const max = terms[0]!.occurrences;
  const min = terms[terms.length - 1]!.occurrences;
  // Cor sequencial (um só matiz): reforça a frequência, não inventa categorias.
  const RAMP = ["#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];
  const tierOf = (n: number) => (max === min ? 3 : Math.min(3, Math.floor(((n - min) / (max - min)) * 4)));
  const shuffled = [...terms].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const lines: { words: { text: string; size: number; color: string; w: number }[]; width: number; height: number }[] = [];
  let current = { words: [] as { text: string; size: number; color: string; w: number }[], width: 0, height: 0 };
  shuffled.forEach((t) => {
    const size = max === min ? 14 : 8 + ((t.occurrences - min) / (max - min)) * 20;
    doc.font("bold").fontSize(size);
    const text = pdfText(t.label);
    const w = doc.widthOfString(text) + 10;
    if (current.width + w > CONTENT_W && current.words.length) {
      lines.push(current);
      current = { words: [], width: 0, height: 0 };
    }
    current.words.push({ text, size, color: RAMP[tierOf(t.occurrences)]!, w });
    current.width += w;
    current.height = Math.max(current.height, size * 1.25);
  });
  if (current.words.length) lines.push(current);
  const total = lines.reduce((s, l) => s + l.height, 0);
  ensureSpace(doc, Math.min(total + 20, 400));
  for (const line of lines) {
    ensureSpace(doc, line.height);
    let x = PAGE.margin + (CONTENT_W - line.width) / 2;
    const y = doc.y;
    for (const word of line.words) {
      doc.font("bold").fontSize(word.size).fillColor(word.color).text(word.text, x, y + (line.height - word.size * 1.25), { lineBreak: false });
      x += word.w;
    }
    doc.y = y + line.height;
  }
  doc.moveDown(0.6);
  para(doc, "Tamanho proporcional ao número de ocorrências. Termos mais frequentes:", { size: 8, color: C.muted });
  table(
    doc,
    [
      { label: "Termo", width: CONTENT_W - 200 },
      { label: "Ocorrências", width: 100, align: "right" },
      { label: "Participantes", width: 100, align: "right" },
    ],
    data.cloud.slice(0, 15).map((t) => [t.label, String(t.occurrences), String(t.participants)]),
  );
}

function cover(doc: Doc, data: ReportData): void {
  const { ds, overview: o } = data;
  doc.rect(0, 0, PAGE.width, 150).fill(C.ink);
  doc.font("bold").fontSize(10).fillColor("#7eb6ff").text("iVent NeoPed — Avaliação", PAGE.margin, 40);
  doc.font("bold").fontSize(20).fillColor("#ffffff").text("Relatório de Avaliação", PAGE.margin, 58);
  doc.font("regular").fontSize(10.5).fillColor("#c9d3e1").text(pdfText(ds.survey.title), PAGE.margin, 88, { width: CONTENT_W });
  doc.y = 175;
  const period = o.firstSubmission
    ? `${new Date(o.firstSubmission).toLocaleDateString("pt-BR")} a ${new Date(o.lastSubmission!).toLocaleDateString("pt-BR")}`
    : "Sem respostas no período";
  const facts: [string, string][] = [
    ["Versão do questionário", `v${ds.version.number}`],
    ["Versão avaliada do iVent", ds.survey.iventVersionLabel ?? "Não informada"],
    ["Período das respostas", period],
    ["Participantes", String(o.totalParticipants)],
    ...o.byProfession.map((p) => [p.label, String(p.count)] as [string, string]),
    ["Média geral (Likert 1–5)", `${fmt(o.generalMean.mean)} (n=${o.generalMean.n} notas válidas)`],
    ["Comentários por item", String(o.commentCount)],
    ["Respostas abertas", String(o.openAnswerCount)],
    ["Gerado em", data.generatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
  ];
  const f = ds.filters;
  if (f.profession || f.from || f.to || f.iventVersionId) {
    facts.push(["Filtros aplicados", [f.profession && `profissão=${f.profession}`, f.from && `de ${f.from}`, f.to && `até ${f.to}`].filter(Boolean).join(", ") || "sim"]);
  }
  if (data.research.institution) facts.push(["Instituição", data.research.institution]);
  if (data.research.leadResearcher) facts.push(["Pesquisador responsável", data.research.leadResearcher]);
  if (data.research.protocolNumber) facts.push(["Número do protocolo", data.research.protocolNumber]);
  table(doc, [{ label: "Item", width: 190 }, { label: "Valor", width: CONTENT_W - 190 }], facts.map(([a, b]) => [a, b]), { size: 9 });
}

/**
 * Comentários representativos: alterna entre categorias profissionais e não
 * repete textos idênticos. É uma amostra para leitura; a íntegra está no Excel/CSV.
 */
function representativeAnswers(data: ReportData, questionId: string, limit: number) {
  const seen = new Set<string>();
  const byProfession = new Map<string, { r: ReportData["ds"]["responses"][number]; a: NonNullable<ReturnType<Map<string, import("../dataset.ts").AnswerRecord>["get"]>> }[]>();
  for (const r of data.ds.responses) {
    const a = r.answers.get(questionId);
    const text = a?.text?.trim();
    if (!a || !text) continue;
    const key = text.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    byProfession.set(r.profession, [...(byProfession.get(r.profession) ?? []), { r, a }]);
  }
  const queues = [...byProfession.values()];
  const picked: { r: ReportData["ds"]["responses"][number]; a: import("../dataset.ts").AnswerRecord }[] = [];
  while (picked.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && picked.length < limit) picked.push(next);
    }
  }
  return picked;
}

export async function buildPdf(data: ReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: PAGE.margin, bufferPages: true, info: { Title: "Relatório de Avaliação — iVent NeoPed", Author: "iVent NeoPed — Avaliação" } });
  doc.registerFont("regular", FONT_REGULAR);
  doc.registerFont("bold", FONT_BOLD);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  cover(doc, data);

  heading(doc, "Metodologia");
  bullets(doc, METHODOLOGY_TEXT);

  heading(doc, "Estatísticas por pergunta");
  table(
    doc,
    [
      { label: "#", width: 22 },
      { label: "Pergunta", width: 205 },
      { label: "n", width: 30, align: "right" },
      { label: "Média", width: 42, align: "right" },
      { label: "Mediana", width: 46, align: "right" },
      { label: "DP", width: 38, align: "right" },
      { label: "Não utilizei", width: 58, align: "right" },
      { label: "Ausentes", width: CONTENT_W - 441, align: "right" },
    ],
    data.stats
      .filter((s) => s.scale)
      .map((s) => [String(s.position + 1), s.text, String(s.scale!.validN), fmt(s.scale!.mean), fmt(s.scale!.median, 1), fmt(s.scale!.sd), String(s.scale!.notUsed + s.scale!.notApplicable), String(s.scale!.missing)]),
    { size: 7.5 },
  );

  const likertCount = data.stats.filter((s) => s.scale && s.type === "likert").length;
  heading(doc, "Média por pergunta", likertCount * 18 + 30);
  meansChart(doc, data);

  heading(doc, "Distribuição das respostas", likertCount * 16 + 40);
  distributionChart(doc, data);

  const g = data.groups;
  heading(doc, `Comparação: ${g.groupA.label} × ${g.groupB.label}`, 160);
  para(doc, `${g.groupA.label}: ${g.groupA.n} participante(s) · ${g.groupB.label}: ${g.groupB.n} participante(s). Média geral: ${fmt(g.overall.a.mean)} (n=${g.overall.a.n}) × ${fmt(g.overall.b.mean)} (n=${g.overall.b.n}).`);
  para(doc, GROUP_COMPARISON_NOTE, { size: 8, color: C.muted });
  doc.moveDown(0.4);
  groupBars(doc, data);

  heading(doc, "Nuvem de palavras", 260);
  wordCloud(doc, data);

  heading(doc, "Principais comentários", 120);
  para(doc, "Amostra representativa por pergunta (alternando categorias profissionais, sem repetições). A íntegra está nas exportações Excel/CSV e na plataforma.", { size: 8, color: C.muted });
  const openQs = data.ds.questions.filter((q) => q.type === "long_text" || q.type === "short_text");
  for (const q of openQs) {
    const answers = representativeAnswers(data, q.id!, 6);
    if (!answers.length) continue;
    para(doc, q.text, { bold: true, size: 9 });
    for (const { r, a } of answers) para(doc, `“${a!.text!.trim()}” — ${r.professionLabel}`, { size: 8.5, color: C.muted });
    doc.moveDown(0.4);
  }

  heading(doc, "Análise qualitativa");
  if (data.ai) {
    para(doc, `Análise exploratória por IA (${data.ai.model}, ${new Date(data.ai.createdAt).toLocaleDateString("pt-BR")}); cada tema está vinculado aos comentários originais na plataforma.`, { size: 8, color: C.muted });
    para(doc, data.ai.result.overallSummary);
    for (const t of data.ai.result.themes.slice(0, 10)) {
      para(doc, `${t.category} — ${t.title} (${t.count} comentário(s))`, { bold: true, size: 9 });
      para(doc, t.summary, { size: 8.5, color: C.muted });
    }
  } else {
    para(doc, "Sem análise por IA registrada. Temas identificados por palavras-chave (classificação determinística):", { size: 8.5, color: C.muted });
    table(
      doc,
      [{ label: "Tema", width: 200 }, { label: "Comentários relacionados", width: 150, align: "right" }, { label: "Participantes", width: CONTENT_W - 350, align: "right" }],
      data.priorities.filter((p) => p.comments > 0).map((p) => [p.theme, String(p.comments), String(p.participants)]),
    );
  }

  heading(doc, "Principais oportunidades de melhoria");
  table(
    doc,
    [
      { label: "Tema", width: 150 },
      { label: "Nota média", width: 90, align: "right" },
      { label: "Comentários", width: 80, align: "right" },
      { label: "Participantes", width: 80, align: "right" },
      { label: "Prioridade", width: CONTENT_W - 400 },
    ],
    data.priorities.slice(0, 10).map((p) => [p.theme, p.mean === null ? "sem nota" : `${fmt(p.mean, 1)}/5 (n=${p.meanN})`, String(p.comments), String(p.participants), p.level]),
  );
  para(doc, PRIORITY_FORMULA, { size: 7.5, color: C.muted });

  heading(doc, "Limitações");
  bullets(doc, LIMITATIONS_TEXT);

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Rodapé abaixo da margem: zera a margem inferior para o PDFKit não abrir página nova.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("regular").fontSize(7).fillColor(C.dim).text(`iVent NeoPed — Avaliação · página ${i + 1} de ${range.count}`, PAGE.margin, PAGE.height - 35, {
      width: CONTENT_W,
      align: "center",
      lineBreak: false,
    });
    doc.page.margins.bottom = bottomMargin;
  }
  doc.end();
  return done;
}
