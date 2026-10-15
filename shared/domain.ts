/**
 * Vocabulário do domínio compartilhado entre servidor e navegador.
 * Nada aqui toca banco ou DOM: são tipos, constantes e rótulos.
 */

export const QUESTION_TYPES = [
  "likert",
  "numeric_scale",
  "yes_no",
  "single_choice",
  "multiple_choice",
  "short_text",
  "long_text",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  likert: "Escala Likert 1–5",
  numeric_scale: "Escala numérica configurável",
  yes_no: "Sim/Não",
  single_choice: "Múltipla escolha",
  multiple_choice: "Seleção múltipla",
  short_text: "Texto curto",
  long_text: "Texto longo",
};

/**
 * "Não se aplica" e "Não utilizei este recurso" não são tipos de pergunta
 * isolados: são marcações especiais que qualquer pergunta quantitativa pode
 * oferecer. Ficam fora de qualquer média — nunca viram zero.
 */
export const SPECIAL_ANSWERS = ["not_applicable", "not_used"] as const;
export type SpecialAnswer = (typeof SPECIAL_ANSWERS)[number];
export const SPECIAL_ANSWER_LABELS: Record<SpecialAnswer, string> = {
  not_applicable: "Não se aplica",
  not_used: "Não utilizei este recurso",
};

export const SECTIONS = ["quantitative", "open"] as const;
export type Section = (typeof SECTIONS)[number];

export const SURVEY_STATUSES = ["draft", "published", "closed", "archived"] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];
export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  closed: "Encerrada",
  archived: "Arquivada",
};

export const LIKERT_LABELS: Record<number, string> = {
  1: "Discordo totalmente",
  2: "Discordo parcialmente",
  3: "Nem concordo nem discordo",
  4: "Concordo parcialmente",
  5: "Concordo totalmente",
};

export interface ProfileOption {
  code: string;
  label: string;
}

export const EXPERIENCE_YEARS: ProfileOption[] = [
  { code: "lt1", label: "Menos de 1 ano" },
  { code: "1to3", label: "1–3 anos" },
  { code: "4to5", label: "4–5 anos" },
  { code: "gt5", label: "Mais de 5 anos" },
];

export const SIMULATOR_EXPERIENCE: ProfileOption[] = [
  { code: "none", label: "Nenhuma" },
  { code: "basic", label: "Básica" },
  { code: "intermediate", label: "Intermediária" },
  { code: "advanced", label: "Avançada" },
];

export const IVENT_EXPERIENCE: ProfileOption[] = [
  { code: "first", label: "Primeiro contato" },
  { code: "before", label: "Já utilizei anteriormente" },
  { code: "frequent", label: "Utilizo frequentemente" },
];

export function optionLabel(options: ProfileOption[], code: string | null | undefined): string {
  if (!code) return "Não informado";
  return options.find((o) => o.code === code)?.label ?? code;
}

/** Categorias profissionais iniciais; outras podem ser cadastradas pelo admin. */
export const DEFAULT_PROFESSIONS: ProfileOption[] = [
  { code: "resident_neonatology", label: "Médico residente de Neonatologia" },
  { code: "physiotherapist", label: "Fisioterapeuta" },
];
export const RESIDENT = "resident_neonatology";
export const PHYSIO = "physiotherapist";

export interface QuestionOptionDef {
  id?: string;
  label: string;
  value: string;
}

/** Pergunta como o editor e o formulário público a enxergam. */
export interface QuestionDef {
  id?: string;
  key: string;
  section: Section;
  type: QuestionType;
  text: string;
  helpText?: string | null;
  category?: string | null;
  required: boolean;
  allowComment: boolean;
  allowNotApplicable: boolean;
  allowNotUsed: boolean;
  scaleMin?: number | null;
  scaleMax?: number | null;
  scaleMinLabel?: string | null;
  scaleMaxLabel?: string | null;
  options: QuestionOptionDef[];
}

export function isQuantitative(type: QuestionType): boolean {
  return type === "likert" || type === "numeric_scale";
}

export function isTextType(type: QuestionType): boolean {
  return type === "short_text" || type === "long_text";
}

/** Limites de escala efetivos: Likert é sempre 1–5. */
export function scaleBounds(q: Pick<QuestionDef, "type" | "scaleMin" | "scaleMax">): {
  min: number;
  max: number;
} {
  if (q.type === "likert") return { min: 1, max: 5 };
  return { min: q.scaleMin ?? 0, max: q.scaleMax ?? 10 };
}

/** Resposta enviada pelo participante para uma pergunta. */
export interface AnswerInput {
  questionId: string;
  numericValue?: number | null;
  textValue?: string | null;
  choiceValues?: string[] | null;
  special?: SpecialAnswer | null;
  comment?: string | null;
}

export interface ProfileInput {
  profession: string;
  experienceYears?: string | null;
  simulatorExperience?: string | null;
  iventExperience?: string | null;
}

export const LIMITS = {
  shortText: 300,
  longText: 5000,
  comment: 2000,
  questionText: 1000,
  maxQuestions: 200,
  maxOptions: 50,
} as const;

/** Perfis de acesso ao painel: administrador gerencia tudo; pesquisador consulta e analisa. */
export const USER_ROLES = ["admin", "researcher"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  researcher: "Pesquisador",
};
