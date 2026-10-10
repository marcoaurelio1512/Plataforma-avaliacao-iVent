/**
 * Carrega, para uma versão de questionário, as respostas submetidas com perfil e
 * respostas por pergunta. Todas as análises (estatística, nuvem, IA, relatórios)
 * partem deste mesmo conjunto — os números batem entre as telas e exportações.
 */
import type { QuestionDef, SpecialAnswer } from "../../shared/domain.ts";
import { query, queryOne } from "../db.ts";
import { badRequest, notFound } from "../http.ts";
import type { AnalysisFilters } from "../validation.ts";
import { getVersionQuestions } from "./surveys.ts";

export interface AnswerRecord {
  answerId: string;
  numeric: number | null;
  text: string | null;
  choices: string[] | null;
  special: SpecialAnswer | null;
  comment: string | null;
}

export interface DatasetResponse {
  id: string;
  participantId: string;
  participantCode: string;
  profession: string;
  professionLabel: string;
  experienceYears: string | null;
  simulatorExperience: string | null;
  iventExperience: string | null;
  deviceClass: string | null;
  submittedAt: Date;
  iventVersionId: string | null;
  iventVersionLabel: string | null;
  answers: Map<string, AnswerRecord>;
}

export interface Dataset {
  survey: { id: string; title: string; slug: string; status: string; iventVersionLabel: string | null };
  version: { id: string; number: number; title: string; instructions: string };
  questions: QuestionDef[];
  responses: DatasetResponse[];
  filters: AnalysisFilters;
}

export async function resolveVersion(surveyId: string, versionId?: string) {
  if (versionId) {
    const v = await queryOne<{ id: string; version_number: number; title: string; instructions: string }>(
      `SELECT id, version_number, title, instructions FROM survey_versions WHERE id = $1 AND survey_id = $2`,
      [versionId, surveyId],
    );
    if (!v) throw notFound("Versão do questionário não encontrada.");
    return v;
  }
  // Padrão: a versão mais recente que já tem respostas; senão, a atual.
  const v = await queryOne<{ id: string; version_number: number; title: string; instructions: string }>(
    `SELECT v.id, v.version_number, v.title, v.instructions
       FROM survey_versions v
      WHERE v.survey_id = $1
      ORDER BY EXISTS (SELECT 1 FROM survey_responses r WHERE r.survey_version_id = v.id AND r.status = 'submitted') DESC,
               v.version_number DESC
      LIMIT 1`,
    [surveyId],
  );
  if (!v) throw notFound("A pesquisa não tem versões.");
  return v;
}

export async function loadDataset(filters: AnalysisFilters): Promise<Dataset> {
  if (!filters.surveyId) throw badRequest("Selecione uma pesquisa.");
  const survey = await queryOne<{ id: string; title: string; slug: string; status: string; ivent_label: string | null }>(
    `SELECT s.id, s.title, s.slug, s.status, iv.label AS ivent_label
       FROM surveys s LEFT JOIN ivent_versions iv ON iv.id = s.ivent_version_id WHERE s.id = $1`,
    [filters.surveyId],
  );
  if (!survey) throw notFound("Pesquisa não encontrada.");
  const version = await resolveVersion(survey.id, filters.versionId);
  const questions = await getVersionQuestions(version.id);

  const conditions = ["r.survey_version_id = $1", "r.status = 'submitted'"];
  const params: unknown[] = [version.id];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  };
  if (filters.profession) add("p.profession_code = ?", filters.profession);
  if (filters.iventVersionId) add("r.ivent_version_id = ?", filters.iventVersionId);
  if (filters.from) add("r.submitted_at >= (?::date AT TIME ZONE 'America/Sao_Paulo')", filters.from);
  if (filters.to) add("r.submitted_at < ((?::date + 1) AT TIME ZONE 'America/Sao_Paulo')", filters.to);

  const rows = await query<{
    id: string;
    participant_id: string;
    anonymous_code: string;
    profession_code: string;
    profession_label: string;
    experience_years: string | null;
    simulator_experience: string | null;
    ivent_experience: string | null;
    device_class: string | null;
    submitted_at: Date;
    ivent_version_id: string | null;
    ivent_label: string | null;
  }>(
    `SELECT r.id, r.participant_id, p.anonymous_code, p.profession_code, pc.label AS profession_label,
            p.experience_years, p.simulator_experience, p.ivent_experience, r.device_class, r.submitted_at,
            r.ivent_version_id, iv.label AS ivent_label
       FROM survey_responses r
       JOIN participants p ON p.id = r.participant_id
       JOIN professional_categories pc ON pc.code = p.profession_code
       LEFT JOIN ivent_versions iv ON iv.id = r.ivent_version_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.submitted_at`,
    params,
  );

  const ids = rows.map((r) => r.id);
  const answers = ids.length
    ? await query<{
        id: string;
        response_id: string;
        question_id: string;
        numeric_value: number | null;
        text_value: string | null;
        choice_values: string[] | null;
        special: SpecialAnswer | null;
        comment: string | null;
      }>(
        `SELECT a.id, a.response_id, a.question_id, a.numeric_value, a.text_value, a.choice_values, a.special, c.text AS comment
           FROM answers a LEFT JOIN answer_comments c ON c.answer_id = a.id
          WHERE a.response_id = ANY($1::uuid[])`,
        [ids],
      )
    : [];
  const byResponse = new Map<string, Map<string, AnswerRecord>>();
  for (const a of answers) {
    const map = byResponse.get(a.response_id) ?? new Map<string, AnswerRecord>();
    map.set(a.question_id, {
      answerId: a.id,
      numeric: a.numeric_value,
      text: a.text_value,
      choices: a.choice_values,
      special: a.special,
      comment: a.comment,
    });
    byResponse.set(a.response_id, map);
  }

  return {
    survey: { id: survey.id, title: survey.title, slug: survey.slug, status: survey.status, iventVersionLabel: survey.ivent_label },
    version: { id: version.id, number: version.version_number, title: version.title, instructions: version.instructions },
    questions,
    responses: rows.map((r) => ({
      id: r.id,
      participantId: r.participant_id,
      participantCode: r.anonymous_code,
      profession: r.profession_code,
      professionLabel: r.profession_label,
      experienceYears: r.experience_years,
      simulatorExperience: r.simulator_experience,
      iventExperience: r.ivent_experience,
      deviceClass: r.device_class,
      submittedAt: r.submitted_at,
      iventVersionId: r.ivent_version_id,
      iventVersionLabel: r.ivent_label,
      answers: byResponse.get(r.id) ?? new Map(),
    })),
    filters,
  };
}
