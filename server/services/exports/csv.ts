/** Exportações CSV (formato longo, uma linha por resposta a pergunta). */
import { SPECIAL_ANSWER_LABELS } from "../../../shared/domain.ts";
import { profileOptionLabel } from "../../../shared/profileForm.ts";
import { toCsv, type CellValue } from "../../../shared/spreadsheetSafe.ts";
import { questionStats, textDocuments } from "../analytics.ts";
import type { Dataset } from "../dataset.ts";

export type CsvKind = "respostas" | "comentarios" | "estatisticas";

export function answersCsv(ds: Dataset): string {
  const header = [
    "id_resposta", "participante", "profissao", "tempo_experiencia", "experiencia_simuladores", "experiencia_ivent",
    "versao_ivent", "versao_questionario", "enviado_em", "chave_pergunta", "pergunta", "tipo",
    "valor_numerico", "escolhas", "texto", "marcacao_especial", "comentario",
  ];
  const rows: CellValue[][] = [];
  for (const r of ds.responses) {
    for (const q of ds.questions) {
      const a = r.answers.get(q.id!);
      rows.push([
        r.id, r.participantCode, r.professionLabel,
        profileOptionLabel(ds.profileForm, "experienceYears", r.experienceYears),
        profileOptionLabel(ds.profileForm, "simulatorExperience", r.simulatorExperience),
        profileOptionLabel(ds.profileForm, "iventExperience", r.iventExperience),
        r.iventVersionLabel ?? "", ds.version.number, r.submittedAt.toISOString(), q.key, q.text, q.type,
        a?.numeric ?? null, a?.choices?.join("; ") ?? null, a?.text ?? null,
        a?.special ? SPECIAL_ANSWER_LABELS[a.special] : null, a?.comment ?? null,
      ]);
    }
  }
  return toCsv(header, rows);
}

export function commentsCsv(ds: Dataset): string {
  const docs = textDocuments(ds);
  return toCsv(
    ["participante", "profissao", "origem", "chave_pergunta", "pergunta", "texto", "enviado_em", "versao_ivent"],
    docs.map((d) => [
      d.meta.participantCode, d.meta.professionLabel, d.meta.kind === "open" ? "Pergunta aberta" : "Comentário do item",
      d.meta.questionKey, d.meta.questionText, d.text, d.meta.submittedAt, d.meta.iventVersionLabel ?? "",
    ]),
  );
}

export function statsCsv(ds: Dataset): string {
  const stats = questionStats(ds.questions, ds.responses);
  const header = ["chave", "pergunta", "categoria", "n_valido", "media", "mediana", "desvio_padrao", "nao_utilizei", "nao_se_aplica", "ausentes", "freq_1", "freq_2", "freq_3", "freq_4", "freq_5"];
  const rows = stats
    .filter((s) => s.scale)
    .map((s) => {
      const f = (v: number) => s.scale!.frequencies.find((x) => x.value === v)?.count ?? null;
      return [s.key, s.text, s.category, s.scale!.validN, s.scale!.mean, s.scale!.median, s.scale!.sd, s.scale!.notUsed, s.scale!.notApplicable, s.scale!.missing, f(1), f(2), f(3), f(4), f(5)];
    });
  return toCsv(header, rows);
}

export function buildCsv(ds: Dataset, kind: CsvKind): string {
  if (kind === "comentarios") return commentsCsv(ds);
  if (kind === "estatisticas") return statsCsv(ds);
  return answersCsv(ds);
}
