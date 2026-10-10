/**
 * Repositório de pesquisas, versões e perguntas.
 *
 * Regra de preservação histórica: uma versão que já recebeu resposta nunca é
 * alterada. Editar uma pesquisa nessa situação cria a versão seguinte e passa
 * a apontá-la como atual; as respostas antigas continuam ligadas à versão (e às
 * perguntas) que de fato responderam.
 */
import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { scaleBounds, type QuestionDef, type SurveyStatus } from "../../shared/domain.ts";
import { getPool, query, queryOne, withTransaction, type Queryable } from "../db.ts";
import { badRequest, conflict, notFound } from "../http.ts";
import type { QuestionInput, SurveyContentInput, SurveyMetaInput } from "../validation.ts";

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateSlug(length = 10): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join("");
}

export interface SurveySummary {
  id: string;
  slug: string;
  title: string;
  status: SurveyStatus;
  iventVersionId: string | null;
  iventVersionLabel: string | null;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  closedAt: string | null;
}

export interface SurveyVersionInfo {
  id: string;
  versionNumber: number;
  title: string;
  createdAt: string;
  responseCount: number;
}

export interface SurveyDetail extends SurveySummary {
  instructions: string;
  openSectionTitle: string;
  consentText: string | null;
  participantInfo: string | null;
  protocolNumber: string | null;
  institution: string | null;
  leadResearcher: string | null;
  questions: QuestionDef[];
  versions: SurveyVersionInfo[];
}

const SUMMARY_SQL = `
  SELECT s.id, s.slug, s.title, s.status, s.ivent_version_id, iv.label AS ivent_version_label,
         s.current_version_id, sv.version_number AS current_version_number,
         (SELECT count(*) FROM survey_responses r WHERE r.survey_id = s.id AND r.status = 'submitted') AS response_count,
         s.created_at, s.updated_at, s.published_at, s.closed_at,
         sv.instructions, sv.open_section_title,
         s.consent_text, s.participant_info, s.protocol_number, s.institution, s.lead_researcher
    FROM surveys s
    LEFT JOIN ivent_versions iv ON iv.id = s.ivent_version_id
    LEFT JOIN survey_versions sv ON sv.id = s.current_version_id`;

type SummaryRow = {
  id: string;
  slug: string;
  title: string;
  status: SurveyStatus;
  ivent_version_id: string | null;
  ivent_version_label: string | null;
  current_version_id: string | null;
  current_version_number: number | null;
  response_count: number;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  closed_at: Date | null;
  instructions: string | null;
  open_section_title: string | null;
  consent_text: string | null;
  participant_info: string | null;
  protocol_number: string | null;
  institution: string | null;
  lead_researcher: string | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toSummary(r: SummaryRow): SurveySummary {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    iventVersionId: r.ivent_version_id,
    iventVersionLabel: r.ivent_version_label,
    currentVersionId: r.current_version_id,
    currentVersionNumber: r.current_version_number,
    responseCount: r.response_count,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    publishedAt: iso(r.published_at),
    closedAt: iso(r.closed_at),
  };
}

export async function listSurveys(): Promise<SurveySummary[]> {
  const rows = await query<SummaryRow>(`${SUMMARY_SQL} ORDER BY s.created_at DESC`);
  return rows.map(toSummary);
}

type QuestionRow = {
  id: string;
  question_key: string;
  section: QuestionDef["section"];
  type: QuestionDef["type"];
  text: string;
  help_text: string | null;
  category: string | null;
  required: boolean;
  allow_comment: boolean;
  allow_not_applicable: boolean;
  allow_not_used: boolean;
  scale_min: number | null;
  scale_max: number | null;
  scale_min_label: string | null;
  scale_max_label: string | null;
  options: { id: string; label: string; value: string }[] | null;
};

export async function getVersionQuestions(versionId: string, db: Queryable = getPool()): Promise<QuestionDef[]> {
  const rows = await query<QuestionRow>(
    `SELECT q.*,
            (SELECT json_agg(json_build_object('id', o.id, 'label', o.label, 'value', o.value) ORDER BY o.position)
               FROM question_options o WHERE o.question_id = q.id) AS options
       FROM questions q
      WHERE q.survey_version_id = $1
      ORDER BY q.position`,
    [versionId],
    db,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.question_key,
    section: r.section,
    type: r.type,
    text: r.text,
    helpText: r.help_text,
    category: r.category,
    required: r.required,
    allowComment: r.allow_comment,
    allowNotApplicable: r.allow_not_applicable,
    allowNotUsed: r.allow_not_used,
    scaleMin: r.scale_min,
    scaleMax: r.scale_max,
    scaleMinLabel: r.scale_min_label,
    scaleMaxLabel: r.scale_max_label,
    options: r.options ?? [],
  }));
}

export async function getSurveyDetail(id: string): Promise<SurveyDetail> {
  const row = await queryOne<SummaryRow>(`${SUMMARY_SQL} WHERE s.id = $1`, [id]);
  if (!row) throw notFound("Pesquisa não encontrada.");
  const questions = row.current_version_id ? await getVersionQuestions(row.current_version_id) : [];
  const versions = await query<{ id: string; version_number: number; title: string; created_at: Date; response_count: number }>(
    `SELECT v.id, v.version_number, v.title, v.created_at,
            (SELECT count(*) FROM survey_responses r WHERE r.survey_version_id = v.id AND r.status = 'submitted') AS response_count
       FROM survey_versions v WHERE v.survey_id = $1 ORDER BY v.version_number DESC`,
    [id],
  );
  return {
    ...toSummary(row),
    instructions: row.instructions ?? "",
    openSectionTitle: row.open_section_title ?? "Sua opinião",
    consentText: row.consent_text,
    participantInfo: row.participant_info,
    protocolNumber: row.protocol_number,
    institution: row.institution,
    leadResearcher: row.lead_researcher,
    questions,
    versions: versions.map((v) => ({
      id: v.id,
      versionNumber: v.version_number,
      title: v.title,
      createdAt: v.created_at.toISOString(),
      responseCount: v.response_count,
    })),
  };
}

function slugifyKey(text: string, index: number): string {
  const base = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${base || "pergunta"}_${index + 1}`;
}

/** Normaliza as perguntas recebidas: chaves únicas, escala Likert fixa, opções com valor. */
export function normalizeQuestions(questions: QuestionInput[]): QuestionInput[] {
  const used = new Set<string>();
  return questions.map((q, index) => {
    let key = q.key ?? slugifyKey(q.text, index);
    while (used.has(key)) key = `${key}_${index + 1}`;
    used.add(key);
    const isScale = q.type === "likert" || q.type === "numeric_scale";
    const bounds = isScale ? scaleBounds(q) : null;
    const isText = q.type === "short_text" || q.type === "long_text";
    const isChoice = q.type === "single_choice" || q.type === "multiple_choice";
    const optionValues = new Set<string>();
    const options = isChoice
      ? q.options.map((o, i) => {
          let value = o.value?.trim() || `op${i + 1}`;
          while (optionValues.has(value)) value = `${value}_${i + 1}`;
          optionValues.add(value);
          return { label: o.label, value };
        })
      : [];
    return {
      ...q,
      key,
      scaleMin: bounds?.min ?? null,
      scaleMax: bounds?.max ?? null,
      scaleMinLabel: isScale ? q.scaleMinLabel ?? null : null,
      scaleMaxLabel: isScale ? q.scaleMaxLabel ?? null : null,
      allowComment: isText ? false : q.allowComment,
      allowNotApplicable: isText ? false : q.allowNotApplicable,
      allowNotUsed: isText ? false : q.allowNotUsed,
      options,
    };
  });
}

async function insertQuestions(client: PoolClient, versionId: string, questions: QuestionInput[], startPosition = 0): Promise<void> {
  for (const [offset, q] of normalizeQuestions(questions).entries()) {
    const position = startPosition + offset;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO questions (survey_version_id, position, question_key, section, type, text, help_text, category,
                              required, allow_comment, allow_not_applicable, allow_not_used,
                              scale_min, scale_max, scale_min_label, scale_max_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [
        versionId, position, q.key, q.section, q.type, q.text, q.helpText ?? null, q.category ?? null,
        q.required, q.allowComment, q.allowNotApplicable, q.allowNotUsed,
        q.scaleMin ?? null, q.scaleMax ?? null, q.scaleMinLabel ?? null, q.scaleMaxLabel ?? null,
      ],
    );
    await insertOptions(client, inserted.rows[0]!.id, q.options);
  }
}

async function insertOptions(client: PoolClient, questionId: string, options: QuestionInput["options"]): Promise<void> {
  for (const [optPos, opt] of options.entries()) {
    await client.query(`INSERT INTO question_options (question_id, position, label, value) VALUES ($1,$2,$3,$4)`, [questionId, optPos, opt.label, opt.value]);
  }
}

/**
 * Reescrita no lugar (versão ainda sem respostas) preservando o id de cada
 * pergunta pela chave estável: rascunhos de participantes continuam válidos.
 */
async function upsertQuestions(client: PoolClient, versionId: string, questions: QuestionInput[]): Promise<void> {
  const normalized = normalizeQuestions(questions);
  const existing = await client.query<{ id: string; question_key: string }>(`SELECT id, question_key FROM questions WHERE survey_version_id = $1`, [versionId]);
  const byKey = new Map(existing.rows.map((r) => [r.question_key, r.id]));
  const keep = new Set(normalized.map((q) => q.key!));
  const removed = existing.rows.filter((r) => !keep.has(r.question_key)).map((r) => r.id);
  if (removed.length) await client.query(`DELETE FROM questions WHERE id = ANY($1::uuid[])`, [removed]);
  for (const [position, q] of normalized.entries()) {
    const id = byKey.get(q.key!);
    if (!id) {
      await insertQuestions(client, versionId, [q], position);
      continue;
    }
    await client.query(
      `UPDATE questions SET position = $2, section = $3, type = $4, text = $5, help_text = $6, category = $7, required = $8,
              allow_comment = $9, allow_not_applicable = $10, allow_not_used = $11, scale_min = $12, scale_max = $13,
              scale_min_label = $14, scale_max_label = $15
        WHERE id = $1`,
      [id, position, q.section, q.type, q.text, q.helpText ?? null, q.category ?? null, q.required, q.allowComment, q.allowNotApplicable,
        q.allowNotUsed, q.scaleMin ?? null, q.scaleMax ?? null, q.scaleMinLabel ?? null, q.scaleMaxLabel ?? null],
    );
    await client.query(`DELETE FROM question_options WHERE question_id = $1`, [id]);
    await insertOptions(client, id, q.options);
  }
}

async function insertVersion(client: PoolClient, surveyId: string, number: number, content: SurveyContentInput): Promise<string> {
  const v = await client.query<{ id: string }>(
    `INSERT INTO survey_versions (survey_id, version_number, title, instructions, open_section_title)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [surveyId, number, content.title, content.instructions, content.openSectionTitle],
  );
  const versionId = v.rows[0]!.id;
  await insertQuestions(client, versionId, content.questions);
  return versionId;
}

export interface CreateSurveyOptions {
  seedKey?: string;
  iventVersionId?: string | null;
  status?: SurveyStatus;
}

export async function createSurvey(content: SurveyContentInput, opts: CreateSurveyOptions = {}, db?: PoolClient): Promise<string> {
  const run = async (client: PoolClient) => {
    const s = await client.query<{ id: string }>(
      `INSERT INTO surveys (seed_key, slug, title, status, ivent_version_id, published_at)
       VALUES ($1,$2,$3,$4,$5, CASE WHEN $4 = 'published' THEN now() END) RETURNING id`,
      [opts.seedKey ?? null, generateSlug(), content.title, opts.status ?? "draft", opts.iventVersionId ?? null],
    );
    const surveyId = s.rows[0]!.id;
    const versionId = await insertVersion(client, surveyId, 1, content);
    await client.query(`UPDATE surveys SET current_version_id = $1 WHERE id = $2`, [versionId, surveyId]);
    return surveyId;
  };
  return db ? run(db) : withTransaction(run);
}

export interface ContentUpdateResult {
  versionCreated: boolean;
  versionId: string;
  versionNumber: number;
}

export async function updateSurveyContent(surveyId: string, content: SurveyContentInput): Promise<ContentUpdateResult> {
  return withTransaction(async (client) => {
    const current = await client.query<{ current_version_id: string | null; status: SurveyStatus; version_number: number | null; has_responses: boolean }>(
      `SELECT s.current_version_id, s.status, v.version_number,
              EXISTS (SELECT 1 FROM survey_responses r WHERE r.survey_version_id = s.current_version_id) AS has_responses
         FROM surveys s LEFT JOIN survey_versions v ON v.id = s.current_version_id
        WHERE s.id = $1 FOR UPDATE OF s`,
      [surveyId],
    );
    const row = current.rows[0];
    if (!row) throw notFound("Pesquisa não encontrada.");
    if (row.status === "archived") throw conflict("Desarquive a pesquisa antes de editá-la.");

    if (row.has_responses || !row.current_version_id) {
      const max = await client.query<{ max: number | null }>(`SELECT max(version_number) AS max FROM survey_versions WHERE survey_id = $1`, [surveyId]);
      const number = (max.rows[0]?.max ?? 0) + 1;
      const versionId = await insertVersion(client, surveyId, number, content);
      await client.query(`UPDATE surveys SET current_version_id = $1, title = $2, updated_at = now() WHERE id = $3`, [versionId, content.title, surveyId]);
      return { versionCreated: true, versionId, versionNumber: number };
    }

    // Versão ainda sem respostas: pode ser reescrita no lugar (ids preservados pela chave).
    await client.query(`UPDATE survey_versions SET title = $1, instructions = $2, open_section_title = $3 WHERE id = $4`, [
      content.title, content.instructions, content.openSectionTitle, row.current_version_id,
    ]);
    await upsertQuestions(client, row.current_version_id, content.questions);
    await client.query(`UPDATE surveys SET title = $1, updated_at = now() WHERE id = $2`, [content.title, surveyId]);
    return { versionCreated: false, versionId: row.current_version_id, versionNumber: row.version_number ?? 1 };
  });
}

export async function updateSurveyMeta(surveyId: string, meta: SurveyMetaInput): Promise<void> {
  const fields: [string, unknown][] = [];
  if (meta.iventVersionId !== undefined) fields.push(["ivent_version_id", meta.iventVersionId]);
  if (meta.consentText !== undefined) fields.push(["consent_text", meta.consentText]);
  if (meta.participantInfo !== undefined) fields.push(["participant_info", meta.participantInfo]);
  if (meta.protocolNumber !== undefined) fields.push(["protocol_number", meta.protocolNumber]);
  if (meta.institution !== undefined) fields.push(["institution", meta.institution]);
  if (meta.leadResearcher !== undefined) fields.push(["lead_researcher", meta.leadResearcher]);
  if (!fields.length) return;
  // Nomes de coluna vêm da lista fixa acima, nunca da requisição.
  const sets = fields.map(([col], i) => `${col} = $${i + 2}`).join(", ");
  const updated = await query(`UPDATE surveys SET ${sets}, updated_at = now() WHERE id = $1 RETURNING id`, [
    surveyId,
    ...fields.map(([, v]) => v),
  ]);
  if (!updated.length) throw notFound("Pesquisa não encontrada.");
}

export type StatusAction = "publish" | "close" | "reopen" | "archive" | "unarchive";

const TRANSITIONS: Record<StatusAction, { from: SurveyStatus[]; to: SurveyStatus }> = {
  publish: { from: ["draft"], to: "published" },
  close: { from: ["published"], to: "closed" },
  reopen: { from: ["closed"], to: "published" },
  archive: { from: ["draft", "published", "closed"], to: "archived" },
  unarchive: { from: ["archived"], to: "closed" },
};

export async function changeStatus(surveyId: string, action: StatusAction): Promise<SurveyStatus> {
  const rule = TRANSITIONS[action];
  const survey = await queryOne<{ status: SurveyStatus; current_version_id: string | null; published_at: Date | null }>(
    `SELECT status, current_version_id, published_at FROM surveys WHERE id = $1`,
    [surveyId],
  );
  if (!survey) throw notFound("Pesquisa não encontrada.");
  if (!rule.from.includes(survey.status)) {
    throw conflict(`Não é possível executar esta ação a partir do estado "${survey.status}".`);
  }
  if (rule.to === "published") {
    const count = await queryOne<{ n: number }>(`SELECT count(*) AS n FROM questions WHERE survey_version_id = $1`, [survey.current_version_id]);
    if (!count?.n) throw badRequest("A pesquisa precisa de ao menos uma pergunta para ser publicada.");
  }
  // Desarquivar algo que nunca foi publicado volta para rascunho.
  const target = action === "unarchive" && !survey.published_at ? "draft" : rule.to;
  // Atômico: só transiciona se o estado ainda for um dos permitidos (ações concorrentes).
  const updated = await query(
    `UPDATE surveys
        SET status = $2, updated_at = now(),
            published_at = CASE WHEN $2 = 'published' AND published_at IS NULL THEN now() ELSE published_at END,
            closed_at = CASE WHEN $2 = 'closed' THEN now() WHEN $2 = 'published' THEN NULL ELSE closed_at END
      WHERE id = $1 AND status = ANY($3::text[]) RETURNING id`,
    [surveyId, target, rule.from],
  );
  if (!updated.length) throw conflict("O estado da pesquisa mudou. Atualize a página e tente novamente.");
  return target;
}

export async function duplicateSurvey(surveyId: string): Promise<string> {
  const detail = await getSurveyDetail(surveyId);
  const content: SurveyContentInput = {
    title: `${detail.title} (cópia)`.slice(0, 200),
    instructions: detail.instructions,
    openSectionTitle: detail.openSectionTitle,
    // As chaves são mantidas de propósito: a cópia continua comparável à original.
    questions: detail.questions.map((q) => ({
      key: q.key,
      section: q.section,
      type: q.type,
      text: q.text,
      helpText: q.helpText ?? null,
      category: q.category ?? null,
      required: q.required,
      allowComment: q.allowComment,
      allowNotApplicable: q.allowNotApplicable,
      allowNotUsed: q.allowNotUsed,
      scaleMin: q.scaleMin ?? null,
      scaleMax: q.scaleMax ?? null,
      scaleMinLabel: q.scaleMinLabel ?? null,
      scaleMaxLabel: q.scaleMaxLabel ?? null,
      options: q.options.map((o) => ({ label: o.label, value: o.value })),
    })),
  };
  return withTransaction(async (client) => {
    const id = await createSurvey(content, { iventVersionId: detail.iventVersionId }, client);
    await client.query(
      `UPDATE surveys SET consent_text = $2, participant_info = $3, protocol_number = $4, institution = $5, lead_researcher = $6 WHERE id = $1`,
      [id, detail.consentText, detail.participantInfo, detail.protocolNumber, detail.institution, detail.leadResearcher],
    );
    return id;
  });
}

/** Exclusão só para rascunhos sem nenhuma resposta (dados coletados nunca somem). */
export async function deleteDraftSurvey(surveyId: string): Promise<void> {
  const survey = await queryOne<{ status: SurveyStatus; responses: number }>(
    `SELECT status, (SELECT count(*) FROM survey_responses r WHERE r.survey_id = s.id) AS responses FROM surveys s WHERE id = $1`,
    [surveyId],
  );
  if (!survey) throw notFound("Pesquisa não encontrada.");
  if (survey.status !== "draft" || survey.responses > 0) {
    throw conflict("Somente rascunhos sem respostas podem ser excluídos. Use Arquivar.");
  }
  await withTransaction(async (client) => {
    await client.query(`UPDATE surveys SET current_version_id = NULL WHERE id = $1`, [surveyId]);
    await client.query(`DELETE FROM surveys WHERE id = $1`, [surveyId]);
  });
}
