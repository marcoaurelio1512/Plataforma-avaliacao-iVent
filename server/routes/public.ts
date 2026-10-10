/**
 * Área pública: participante carrega o questionário e envia as respostas.
 * Proteções: limite por IP, campo-armadilha, tempo mínimo de preenchimento,
 * chave de idempotência e validação completa no servidor.
 */
import { Hono } from "hono";
import { EXPERIENCE_YEARS, IVENT_EXPERIENCE, SIMULATOR_EXPERIENCE } from "../../shared/domain.ts";
import type { AppEnv } from "../context.ts";
import { query, queryOne } from "../db.ts";
import { badRequest, notFound, ok, readJson, tooManyRequests } from "../http.ts";
import { log } from "../logger.ts";
import { RateLimiter, signStart, verifyStart } from "../security.ts";
import { submitResponse } from "../services/responses.ts";
import { getVersionQuestions } from "../services/surveys.ts";
import { submissionSchema } from "../validation.ts";

export const submissionLimiter = new RateLimiter(30, 60 * 60 * 1000);
/** Teto global por pesquisa: independe do IP (que pode variar em abuso distribuído). */
export const surveySubmissionLimiter = new RateLimiter(60, 60 * 1000);
/** Validade do token de início (permite pausar e retomar o rascunho). */
const START_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const readLimiter = new RateLimiter(300, 60 * 1000);

export async function publicSurveyPayload(where: { slug?: string; id?: string }) {
  const survey = await queryOne<{
    id: string;
    slug: string;
    status: string;
    current_version_id: string | null;
    consent_text: string | null;
    participant_info: string | null;
    institution: string | null;
    lead_researcher: string | null;
    protocol_number: string | null;
    ivent_label: string | null;
  }>(
    `SELECT s.id, s.slug, s.status, s.current_version_id, s.consent_text, s.participant_info, s.institution,
            s.lead_researcher, s.protocol_number, iv.label AS ivent_label
       FROM surveys s LEFT JOIN ivent_versions iv ON iv.id = s.ivent_version_id
      WHERE ${where.slug ? "s.slug = $1" : "s.id = $1"}`,
    [where.slug ?? where.id],
  );
  if (!survey || survey.status === "archived" || !survey.current_version_id) throw notFound("Pesquisa não encontrada.");
  const version = await queryOne<{ id: string; title: string; instructions: string; open_section_title: string }>(
    `SELECT id, title, instructions, open_section_title FROM survey_versions WHERE id = $1`,
    [survey.current_version_id],
  );
  const professions = await query<{ code: string; label: string }>(
    `SELECT code, label FROM professional_categories WHERE active ORDER BY position, label`,
  );
  return {
    slug: survey.slug,
    status: survey.status,
    acceptingResponses: survey.status === "published",
    title: version!.title,
    instructions: version!.instructions,
    openSectionTitle: version!.open_section_title,
    versionId: version!.id,
    iventVersionLabel: survey.ivent_label,
    research: {
      consentText: survey.consent_text,
      participantInfo: survey.participant_info,
      institution: survey.institution,
      leadResearcher: survey.lead_researcher,
      protocolNumber: survey.protocol_number,
    },
    questions: await getVersionQuestions(version!.id),
    profileOptions: {
      professions,
      experienceYears: EXPERIENCE_YEARS,
      simulatorExperience: SIMULATOR_EXPERIENCE,
      iventExperience: IVENT_EXPERIENCE,
    },
  };
}

export function createPublicRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/api/public/surveys/:slug", async (c) => {
    if (!readLimiter.take(c.get("ipHash"))) throw tooManyRequests();
    const slug = c.req.param("slug");
    if (!/^[a-z0-9]{6,40}$/.test(slug)) throw notFound("Pesquisa não encontrada.");
    const payload = await publicSurveyPayload({ slug });
    // Pesquisa não publicada: só o título e o estado, sem as perguntas.
    if (!payload.acceptingResponses) {
      return ok(c, { slug: payload.slug, status: payload.status, acceptingResponses: false, title: payload.title });
    }
    return ok(c, { ...payload, startToken: signStart(slug, Date.now(), c.get("config").ipHashSalt) });
  });

  app.post("/api/public/surveys/:slug/responses", async (c) => {
    const cfg = c.get("config");
    if (!submissionLimiter.take(c.get("ipHash"))) throw tooManyRequests("Limite de envios atingido. Tente novamente mais tarde.");
    const input = await readJson(c, submissionSchema);
    if (input.website) {
      // Robô preencheu o campo invisível: resposta neutra, nada é gravado.
      log.warn("honeypot_triggered", { slug: c.req.param("slug") });
      return ok(c, { responseId: null, participantCode: null, duplicate: false }, 201);
    }
    const slug = c.req.param("slug");
    const issuedAt = verifyStart(input.startToken, slug, cfg.ipHashSalt);
    if (issuedAt === null) throw badRequest("Formulário inválido. Recarregue a página — suas respostas ficam salvas neste aparelho.");
    const elapsed = Date.now() - issuedAt;
    if (elapsed > START_TOKEN_MAX_AGE_MS) throw badRequest("Formulário expirado. Recarregue a página — suas respostas ficam salvas neste aparelho.");
    if (elapsed < cfg.minFillSeconds * 1000) throw badRequest("Envio muito rápido. Revise suas respostas antes de enviar.");
    if (!surveySubmissionLimiter.take(slug)) throw tooManyRequests("Muitos envios simultâneos para esta pesquisa. Tente novamente em instantes.");
    const result = await submitResponse(slug, input);
    log.info("response_submitted", { duplicate: result.duplicate });
    return ok(c, result, result.duplicate ? 200 : 201);
  });

  return app;
}
