/**
 * Validação das respostas contra a versão do questionário respondida.
 * Função pura: recebe as perguntas e as respostas, devolve respostas normalizadas
 * ou lança erro 400 com a lista de problemas por pergunta.
 *
 * Os textos são guardados exatamente como digitados; só textos compostos apenas
 * de espaços são tratados como "não respondido".
 */
import { LIMITS, isQuantitative, scaleBounds, type AnswerInput, type QuestionDef, type SpecialAnswer } from "../../shared/domain.ts";
import { badRequest } from "../http.ts";

export interface NormalizedAnswer {
  questionId: string;
  numericValue: number | null;
  textValue: string | null;
  choiceValues: string[] | null;
  special: SpecialAnswer | null;
  comment: string | null;
}

const blank = (v: string | null | undefined) => !v || v.trim() === "";
const YES_NO = ["yes", "no"];

function validateOne(q: QuestionDef, a: AnswerInput, problems: string[]): NormalizedAnswer | null {
  const special = a.special ?? null;
  const comment = q.allowComment && !blank(a.comment) ? (a.comment as string) : null;
  if (comment && comment.length > LIMITS.comment) problems.push(`${q.key}: comentário muito longo.`);

  if (special) {
    if ((special === "not_used" && !q.allowNotUsed) || (special === "not_applicable" && !q.allowNotApplicable)) {
      problems.push(`${q.key}: opção especial não disponível nesta pergunta.`);
      return null;
    }
    if (a.numericValue !== null && a.numericValue !== undefined) {
      problems.push(`${q.key}: não é possível marcar nota e "${special}" ao mesmo tempo.`);
      return null;
    }
    return { questionId: q.id!, numericValue: null, textValue: null, choiceValues: null, special, comment };
  }

  if (isQuantitative(q.type)) {
    if (a.numericValue === null || a.numericValue === undefined) return comment ? emptyWithComment(q, comment) : null;
    const { min, max } = scaleBounds(q);
    if (!Number.isInteger(a.numericValue) || a.numericValue < min || a.numericValue > max) {
      problems.push(`${q.key}: nota deve ser inteira entre ${min} e ${max}.`);
      return null;
    }
    return { questionId: q.id!, numericValue: a.numericValue, textValue: null, choiceValues: null, special: null, comment };
  }

  if (q.type === "short_text" || q.type === "long_text") {
    if (blank(a.textValue)) return null;
    const limit = q.type === "short_text" ? LIMITS.shortText : LIMITS.longText;
    if ((a.textValue as string).length > limit) {
      problems.push(`${q.key}: texto excede ${limit} caracteres.`);
      return null;
    }
    return { questionId: q.id!, numericValue: null, textValue: a.textValue as string, choiceValues: null, special: null, comment: null };
  }

  const choices = [...new Set(a.choiceValues ?? [])];
  if (!choices.length) return comment ? emptyWithComment(q, comment) : null;
  const allowed = q.type === "yes_no" ? YES_NO : q.options.map((o) => o.value);
  if (choices.some((c) => !allowed.includes(c))) {
    problems.push(`${q.key}: opção inválida.`);
    return null;
  }
  if (q.type !== "multiple_choice" && choices.length > 1) {
    problems.push(`${q.key}: selecione apenas uma opção.`);
    return null;
  }
  return { questionId: q.id!, numericValue: null, textValue: null, choiceValues: choices, special: null, comment };
}

/** Comentário sem nota: guardamos o comentário, a pergunta conta como sem resposta. */
function emptyWithComment(q: QuestionDef, comment: string): NormalizedAnswer {
  return { questionId: q.id!, numericValue: null, textValue: null, choiceValues: null, special: null, comment };
}

const isAnswered = (n: NormalizedAnswer) => n.numericValue !== null || n.textValue !== null || n.choiceValues !== null || n.special !== null;

export function validateAnswers(questions: readonly QuestionDef[], answers: readonly AnswerInput[]): NormalizedAnswer[] {
  const byId = new Map(questions.map((q) => [q.id!, q]));
  const problems: string[] = [];
  const seen = new Set<string>();
  const normalized: NormalizedAnswer[] = [];
  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) {
      problems.push(`Pergunta desconhecida: ${a.questionId}.`);
      continue;
    }
    if (seen.has(a.questionId)) {
      problems.push(`${q.key}: resposta duplicada.`);
      continue;
    }
    seen.add(a.questionId);
    const result = validateOne(q, a, problems);
    if (result) normalized.push(result);
  }
  for (const q of questions) {
    if (q.required && !normalized.some((n) => n.questionId === q.id && isAnswered(n))) {
      problems.push(`${q.key}: pergunta obrigatória sem resposta.`);
    }
  }
  if (problems.length) throw badRequest("Há respostas inválidas ou obrigatórias faltando.", problems);
  return normalized;
}
