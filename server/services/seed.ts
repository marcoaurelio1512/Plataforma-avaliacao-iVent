/**
 * Dados iniciais, idempotentes: rodar o seed N vezes produz o mesmo estado.
 * - categorias profissionais: ON CONFLICT DO NOTHING (o admin pode renomear);
 * - versão inicial do iVent: só se ainda não houver nenhuma;
 * - questionário inicial: identificado por seed_key, criado uma única vez;
 * - administrador: criado a partir de ADMIN_EMAIL/ADMIN_PASSWORD, nunca sobrescrito
 *   (exceto com ADMIN_RESET_PASSWORD=true).
 */
import { randomBytes } from "node:crypto";
import { DEFAULT_PROFESSIONS } from "../../shared/domain.ts";
import { query, queryOne, withTransaction } from "../db.ts";
import { log } from "../logger.ts";
import { hashPassword, passwordPolicyError } from "../password.ts";
import { createSurvey } from "./surveys.ts";
import { INITIAL_INSTRUCTIONS, INITIAL_QUESTIONS, INITIAL_SURVEY_SEED_KEY, INITIAL_SURVEY_TITLE } from "./seedData.ts";

export interface SeedResult {
  professionsInserted: number;
  iventVersionCreated: boolean;
  surveyCreated: boolean;
  admin: "created" | "exists" | "reset" | "skipped";
  generatedPassword?: string;
}

export async function seedProfessions(): Promise<number> {
  let inserted = 0;
  for (const [position, p] of DEFAULT_PROFESSIONS.entries()) {
    const rows = await query(
      `INSERT INTO professional_categories (code, label, position) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO NOTHING RETURNING code`,
      [p.code, p.label, position],
    );
    inserted += rows.length;
  }
  return inserted;
}

async function seedIventVersion(label: string): Promise<{ id: string; created: boolean }> {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM ivent_versions ORDER BY created_at LIMIT 1`);
  if (existing) return { id: existing.id, created: false };
  const row = await queryOne<{ id: string }>(
    `INSERT INTO ivent_versions (label, notes) VALUES ($1, 'Versão cadastrada automaticamente na instalação.')
     ON CONFLICT DO NOTHING RETURNING id`,
    [label],
  );
  if (row) return { id: row.id, created: true };
  const again = await queryOne<{ id: string }>(`SELECT id FROM ivent_versions WHERE lower(label) = lower($1)`, [label]);
  return { id: again!.id, created: false };
}

async function seedInitialSurvey(iventVersionId: string): Promise<boolean> {
  return withTransaction(async (client) => {
    // Lock por seed_key evita corrida entre duas instâncias subindo juntas.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [INITIAL_SURVEY_SEED_KEY]);
    const exists = await client.query(`SELECT 1 FROM surveys WHERE seed_key = $1`, [INITIAL_SURVEY_SEED_KEY]);
    if (exists.rowCount) return false;
    await createSurvey(
      { title: INITIAL_SURVEY_TITLE, instructions: INITIAL_INSTRUCTIONS, openSectionTitle: "Sua opinião sobre o iVent NeoPed", questions: INITIAL_QUESTIONS },
      { seedKey: INITIAL_SURVEY_SEED_KEY, iventVersionId, status: "draft" },
      client,
    );
    return true;
  });
}

export async function seedAdmin(env: NodeJS.ProcessEnv): Promise<Pick<SeedResult, "admin" | "generatedPassword">> {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  let password = env.ADMIN_PASSWORD ?? "";
  if (!email) {
    log.warn("admin_seed_skipped", { reason: "ADMIN_EMAIL não definido" });
    return { admin: "skipped" };
  }
  const existing = await queryOne<{ id: string }>(`SELECT id FROM admin_users WHERE lower(email) = $1`, [email]);
  const reset = env.ADMIN_RESET_PASSWORD === "true";
  if (existing && !reset) return { admin: "exists" };

  let generatedPassword: string | undefined;
  if (!password) {
    if (env.NODE_ENV === "production") {
      log.error("admin_seed_skipped", undefined, { reason: "ADMIN_PASSWORD obrigatório em produção" });
      return { admin: "skipped" };
    }
    password = `${randomBytes(9).toString("base64url")}9a`;
    generatedPassword = password;
  }
  const policy = passwordPolicyError(password);
  if (policy) {
    log.error("admin_seed_skipped", undefined, { reason: policy });
    return { admin: "skipped" };
  }
  const hash = await hashPassword(password);
  if (existing) {
    await query(`UPDATE admin_users SET password_hash = $1 WHERE id = $2`, [hash, existing.id]);
    await query(`DELETE FROM admin_sessions WHERE admin_id = $1`, [existing.id]);
    return { admin: "reset", generatedPassword };
  }
  await query(`INSERT INTO admin_users (email, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
    email,
    env.ADMIN_NAME?.trim() || "Administrador",
    hash,
  ]);
  return { admin: "created", generatedPassword };
}

export async function runSeed(env: NodeJS.ProcessEnv = process.env): Promise<SeedResult> {
  const professionsInserted = await seedProfessions();
  const iv = await seedIventVersion(env.INITIAL_IVENT_VERSION?.trim() || "iVent 1.0");
  const surveyCreated = await seedInitialSurvey(iv.id);
  const admin = await seedAdmin(env);
  return { professionsInserted, iventVersionCreated: iv.created, surveyCreated, ...admin };
}
