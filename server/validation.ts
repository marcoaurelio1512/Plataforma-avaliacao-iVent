/**
 * Schemas zod de entrada da API. Toda fronteira valida aqui antes de tocar o banco.
 */
import { z } from "zod";
import { LIMITS, QUESTION_TYPES, SECTIONS, SPECIAL_ANSWERS } from "../shared/domain.ts";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

export const questionOptionSchema = z.object({
  label: trimmed(300).min(1, "Opção sem texto."),
  value: trimmed(100).optional(),
});

export const questionInputSchema = z
  .object({
    key: z.string().trim().regex(/^[A-Za-z0-9_-]{1,60}$/, "Chave da pergunta inválida.").optional(),
    section: z.enum(SECTIONS),
    type: z.enum(QUESTION_TYPES),
    text: trimmed(LIMITS.questionText).min(3, "Texto da pergunta muito curto."),
    helpText: optionalText(1000),
    category: optionalText(80),
    required: z.boolean().default(false),
    allowComment: z.boolean().default(false),
    allowNotApplicable: z.boolean().default(false),
    allowNotUsed: z.boolean().default(false),
    scaleMin: z.number().int().min(-100).max(100).nullish(),
    scaleMax: z.number().int().min(-100).max(100).nullish(),
    scaleMinLabel: optionalText(80),
    scaleMaxLabel: optionalText(80),
    options: z.array(questionOptionSchema).max(LIMITS.maxOptions).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.type === "numeric_scale") {
      if (q.scaleMin === null || q.scaleMin === undefined || q.scaleMax === null || q.scaleMax === undefined) {
        ctx.addIssue({ code: "custom", message: "Escala numérica exige mínimo e máximo.", path: ["scaleMin"] });
      } else if (q.scaleMax <= q.scaleMin || q.scaleMax - q.scaleMin > 100) {
        ctx.addIssue({ code: "custom", message: "Escala inválida (máximo > mínimo, até 100 pontos).", path: ["scaleMax"] });
      }
    }
    if ((q.type === "single_choice" || q.type === "multiple_choice") && q.options.length < 2) {
      ctx.addIssue({ code: "custom", message: "Perguntas de escolha precisam de pelo menos 2 opções.", path: ["options"] });
    }
  });

export const surveyCreateSchema = z.lazy(() => surveyContentSchema.and(z.object({ meta: surveyMetaSchema.optional() })));

export const surveyContentSchema = z
  .object({
    title: trimmed(200).min(3, "Título muito curto."),
    instructions: z.string().trim().max(10_000).default(""),
    openSectionTitle: trimmed(120).default("Sua opinião"),
    questions: z.array(questionInputSchema).min(1, "Inclua ao menos uma pergunta.").max(LIMITS.maxQuestions),
  })
  .superRefine((s, ctx) => {
    const keys = s.questions.map((q) => q.key).filter(Boolean);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", message: "Há perguntas com a mesma chave.", path: ["questions"] });
    }
  });
export type SurveyContentInput = z.infer<typeof surveyContentSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const surveyMetaSchema = z.object({
  iventVersionId: z.uuid().nullable().optional(),
  consentText: optionalText(20_000),
  participantInfo: optionalText(20_000),
  protocolNumber: optionalText(120),
  institution: optionalText(200),
  leadResearcher: optionalText(200),
});
export type SurveyMetaInput = z.infer<typeof surveyMetaSchema>;

export const answerSchema = z.object({
  questionId: z.uuid(),
  numericValue: z.number().finite().nullish(),
  textValue: z.string().max(LIMITS.longText).nullish(),
  choiceValues: z.array(z.string().max(100)).max(LIMITS.maxOptions).nullish(),
  special: z.enum(SPECIAL_ANSWERS).nullish(),
  comment: z.string().max(LIMITS.comment).nullish(),
});

export const submissionSchema = z.object({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/, "Chave de envio inválida."),
  versionId: z.uuid(),
  startedAt: z.number().int().positive(),
  // Emitido pelo servidor ao abrir o formulário (HMAC): o tempo mínimo não depende do relógio do cliente.
  startToken: z.string().max(80),
  deviceClass: z.enum(["mobile", "tablet", "desktop"]).nullish(),
  // Campo-armadilha: invisível para pessoas, preenchido por robôs.
  website: z.string().max(200).optional(),
  profile: z.object({
    profession: z.string().trim().min(1).max(60),
    experienceYears: z.string().max(30).nullish(),
    simulatorExperience: z.string().max(30).nullish(),
    iventExperience: z.string().max(30).nullish(),
  }),
  answers: z.array(answerSchema).max(LIMITS.maxQuestions),
});
export type SubmissionInput = z.infer<typeof submissionSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida.");

export const analysisFiltersSchema = z.object({
  surveyId: z.uuid().optional(),
  versionId: z.uuid().optional(),
  profession: z.string().max(60).optional(),
  questionKey: z.string().max(60).optional(),
  iventVersionId: z.uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().max(200).optional(),
}).refine((f) => !f.from || !f.to || f.from <= f.to, { message: "A data inicial deve ser anterior à final.", path: ["from"] });
export type AnalysisFilters = z.infer<typeof analysisFiltersSchema>;
