/**
 * Classifica a edição de um questionário que já recebeu respostas.
 *
 * Correções de redação (texto da pergunta, texto de apoio, categoria, rótulos
 * de opções e da escala) e a ordem das perguntas não mudam o que foi medido:
 * podem ser aplicadas na própria versão. Qualquer mudança no que o participante
 * responde (perguntas incluídas/removidas, tipo, seção, escala, opções,
 * obrigatoriedade, "Não utilizei", "Não se aplica", comentário) é estrutural e
 * exige uma nova versão para preservar a comparabilidade dos dados.
 */
import { scaleBounds, type QuestionDef } from "./domain.ts";

/** Formato mínimo comparado: serve tanto para perguntas salvas quanto para as recebidas do editor. */
export type ComparableQuestion = Pick<
  QuestionDef,
  "type" | "section" | "scaleMin" | "scaleMax" | "required" | "allowComment" | "allowNotApplicable" | "allowNotUsed"
> & {
  key?: string | null;
  /** Só o valor importa; o rótulo pode ser corrigido livremente. */
  options: readonly { label?: string; value?: string | null }[];
};

const isChoice = (q: ComparableQuestion) => q.type === "single_choice" || q.type === "multiple_choice";

function structureSignature(q: ComparableQuestion): string {
  const isScale = q.type === "likert" || q.type === "numeric_scale";
  const bounds = isScale ? scaleBounds(q) : null;
  const optionValues = isChoice(q) ? q.options.map((o) => o.value ?? "") : [];
  return JSON.stringify([
    q.type,
    q.section,
    bounds?.min ?? null,
    bounds?.max ?? null,
    q.required,
    q.allowComment,
    q.allowNotApplicable,
    q.allowNotUsed,
    optionValues,
  ]);
}

/** true quando a edição altera a estrutura (e portanto precisa de nova versão). */
export function isStructuralChange(before: readonly ComparableQuestion[], after: readonly ComparableQuestion[]): boolean {
  if (before.length !== after.length) return true;
  const byKey = new Map(before.map((q) => [q.key ?? "", q]));
  const seen = new Set<string>();
  for (const q of after) {
    const key = q.key ?? "";
    const original = byKey.get(key);
    if (!key || !original || seen.has(key)) return true;
    seen.add(key);
    if (structureSignature(original) !== structureSignature(q)) return true;
  }
  return false;
}
