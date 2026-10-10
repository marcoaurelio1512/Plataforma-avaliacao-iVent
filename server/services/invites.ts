/**
 * Convites de uso único. O código vai no link (/r/<slug>?c=<código>) ou no QR.
 * O sistema não sabe quem recebeu cada convite: a resposta continua anônima.
 */
import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { query, queryOne } from "../db.ts";
import { conflict, notFound } from "../http.ts";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const INVITE_CODE_RE = /^[a-z0-9]{8,24}$/;

export function inviteCode(length = 12): string {
  return Array.from(randomBytes(length), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export type InviteStatus = "valid" | "missing" | "invalid" | "used" | "revoked";

export interface InviteRow {
  id: string;
  code: string;
  label: string | null;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

export async function inviteStatus(surveyId: string, code: string | undefined): Promise<InviteStatus> {
  if (!code) return "missing";
  if (!INVITE_CODE_RE.test(code)) return "invalid";
  const row = await queryOne<{ used_at: Date | null; revoked_at: Date | null }>(
    `SELECT used_at, revoked_at FROM survey_invites WHERE survey_id = $1 AND code = $2`,
    [surveyId, code],
  );
  if (!row) return "invalid";
  if (row.revoked_at) return "revoked";
  if (row.used_at) return "used";
  return "valid";
}

/** Dentro da transação da resposta: trava o convite e o marca como usado. */
export async function consumeInvite(client: PoolClient, surveyId: string, code: string, responseId: string): Promise<void> {
  const row = await client.query<{ id: string }>(
    `SELECT id FROM survey_invites WHERE survey_id = $1 AND code = $2 AND used_at IS NULL AND revoked_at IS NULL FOR UPDATE`,
    [surveyId, code],
  );
  if (!row.rows[0]) throw conflict("Este convite já foi utilizado ou não é válido.");
  await client.query(`UPDATE survey_invites SET used_at = now(), response_id = $2 WHERE id = $1`, [row.rows[0].id, responseId]);
}

export async function listInvites(surveyId: string): Promise<InviteRow[]> {
  const rows = await query<{ id: string; code: string; label: string | null; created_at: Date; used_at: Date | null; revoked_at: Date | null }>(
    `SELECT id, code, label, created_at, used_at, revoked_at FROM survey_invites WHERE survey_id = $1 ORDER BY created_at, code`,
    [surveyId],
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    createdAt: r.created_at.toISOString(),
    usedAt: r.used_at?.toISOString() ?? null,
    revokedAt: r.revoked_at?.toISOString() ?? null,
  }));
}

export async function createInvites(surveyId: string, count: number, label: string | null): Promise<number> {
  const exists = await queryOne(`SELECT 1 FROM surveys WHERE id = $1`, [surveyId]);
  if (!exists) throw notFound("Pesquisa não encontrada.");
  const codes = Array.from({ length: count }, () => inviteCode());
  const rows = await query(
    `INSERT INTO survey_invites (survey_id, code, label)
     SELECT $1, c, $3 FROM unnest($2::text[]) AS c ON CONFLICT (code) DO NOTHING RETURNING id`,
    [surveyId, codes, label],
  );
  return rows.length;
}

export async function revokeInvite(surveyId: string, inviteId: string): Promise<void> {
  const rows = await query(
    `UPDATE survey_invites SET revoked_at = now() WHERE id = $1 AND survey_id = $2 AND used_at IS NULL AND revoked_at IS NULL RETURNING id`,
    [inviteId, surveyId],
  );
  if (!rows.length) throw conflict("Convite inexistente, já utilizado ou já revogado.");
}
