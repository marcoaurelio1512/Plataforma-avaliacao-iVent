/**
 * Gravação de submissões: participante anônimo + resposta + respostas por
 * pergunta + comentários, tudo numa transação. A chave de idempotência gerada
 * no navegador garante que reenvios (rede instável, duplo clique) não dupliquem.
 */
import { randomBytes } from "node:crypto";
import type { QuestionDef } from "../../shared/domain.ts";
import { queryOne, withTransaction } from "../db.ts";
import { badRequest, conflict, notFound } from "../http.ts";
import type { SubmissionInput } from "../validation.ts";
import { validateAnswers } from "./answerValidation.ts";
import { getVersionQuestions } from "./surveys.ts";
import { consumeInvite } from "./invites.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function anonymousCode(): string {
  const bytes = randomBytes(6);
  return `P-${Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")}`;
}

export interface SubmissionResult {
  responseId: string;
  participantCode: string;
  duplicate: boolean;
}

class DuplicateRace extends Error {}

async function previousSubmission(key: string) {
  return queryOne<{ id: string; survey_id: string; anonymous_code: string }>(
    `SELECT r.id, r.survey_id, p.anonymous_code FROM survey_responses r JOIN participants p ON p.id = r.participant_id
      WHERE r.idempotency_key = $1`,
    [key],
  );
}

export async function submitResponse(slug: string, input: SubmissionInput): Promise<SubmissionResult> {
  try {
    return await insertSubmission(slug, input);
  } catch (error) {
    if (!(error instanceof DuplicateRace)) throw error;
    // Dois envios simultâneos com a mesma chave: o outro gravou; este é um reenvio bem-sucedido.
    const previous = await previousSubmission(input.idempotencyKey);
    if (!previous) throw conflict("Não foi possível confirmar o envio. Tente novamente.");
    return { responseId: previous.id, participantCode: previous.anonymous_code, duplicate: true };
  }
}

async function insertSubmission(slug: string, input: SubmissionInput): Promise<SubmissionResult> {
  const survey = await queryOne<{ id: string; status: string; ivent_version_id: string | null; require_invite: boolean }>(
    `SELECT id, status, ivent_version_id, require_invite FROM surveys WHERE slug = $1`,
    [slug],
  );
  if (!survey) throw notFound("Pesquisa não encontrada.");

  // Reenvio da mesma submissão: devolve o registro original, sem duplicar.
  const previous = await previousSubmission(input.idempotencyKey);
  if (previous) {
    if (previous.survey_id !== survey.id) throw conflict("Chave de envio já utilizada.");
    return { responseId: previous.id, participantCode: previous.anonymous_code, duplicate: true };
  }

  if (survey.status !== "published") throw conflict("Esta pesquisa não está recebendo respostas no momento.");
  if (survey.require_invite && !input.inviteCode) throw badRequest("Esta pesquisa exige um convite. Use o link ou QR Code individual que você recebeu.");

  const version = await queryOne<{ id: string }>(`SELECT id FROM survey_versions WHERE id = $1 AND survey_id = $2`, [
    input.versionId,
    survey.id,
  ]);
  if (!version) throw badRequest("Versão do questionário inválida. Recarregue a página.");

  const profession = await queryOne<{ code: string }>(`SELECT code FROM professional_categories WHERE code = $1 AND active`, [
    input.profile.profession,
  ]);
  if (!profession) throw badRequest("Categoria profissional inválida.");

  const questions: QuestionDef[] = await getVersionQuestions(version.id);
  const answers = validateAnswers(questions, input.answers);

  return withTransaction(async (client) => {
    const code = anonymousCode();
    const participant = await client.query<{ id: string }>(
      `INSERT INTO participants (anonymous_code, profession_code, experience_years, simulator_experience, ivent_experience)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [code, profession.code, input.profile.experienceYears ?? null, input.profile.simulatorExperience ?? null, input.profile.iventExperience ?? null],
    );
    const response = await client.query<{ id: string }>(
      `INSERT INTO survey_responses (survey_id, survey_version_id, ivent_version_id, participant_id, idempotency_key, device_class, started_at)
       VALUES ($1,$2,$3,$4,$5,$6, to_timestamp($7 / 1000.0))
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [survey.id, version.id, survey.ivent_version_id, participant.rows[0]!.id, input.idempotencyKey, input.deviceClass ?? null, input.startedAt],
    );
    if (!response.rows[0]) throw new DuplicateRace();
    const responseId = response.rows[0].id;
    if (survey.require_invite) {
      await consumeInvite(client, survey.id, input.inviteCode!, responseId);
    } else if (input.inviteCode) {
      // Pesquisa aberta: um convite válido é apenas registrado como usado (sem bloquear).
      await client.query(
        `UPDATE survey_invites SET used_at = now(), response_id = $3 WHERE survey_id = $1 AND code = $2 AND used_at IS NULL AND revoked_at IS NULL`,
        [survey.id, input.inviteCode, responseId],
      );
    }
    for (const a of answers) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO answers (response_id, question_id, numeric_value, text_value, choice_values, special)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [responseId, a.questionId, a.numericValue, a.textValue, a.choiceValues, a.special],
      );
      if (a.comment) {
        await client.query(`INSERT INTO answer_comments (answer_id, text) VALUES ($1,$2)`, [inserted.rows[0]!.id, a.comment]);
      }
    }
    // A nuvem em cache deixou de refletir os dados.
    await client.query(`DELETE FROM word_frequencies WHERE survey_id = $1`, [survey.id]);
    return { responseId, participantCode: code, duplicate: false };
  });
}
