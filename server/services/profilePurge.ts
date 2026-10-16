/**
 * Apagar pergunta ou opção do perfil apaga também as respostas já recebidas
 * (decisão do produto). Aqui ficam a contagem do impacto, mostrada ao
 * administrador antes de confirmar, e a remoção em si (dentro da transação).
 */
import type { ProfileDeletions } from "../../shared/profileForm.ts";
import { query, type Queryable } from "../db.ts";

export interface DeletionImpact {
  label: string;
  answers: number;
}

const count = async (db: Queryable, sql: string, params: unknown[]) => Number((await query<{ n: number }>(sql, params, db))[0]?.n ?? 0);

// `->` + `@>` cobre escolha única ("a" @> "a") e múltipla (["a","b"] @> "a").
const HAS_OPTION = `profile_answers -> $1::text @> to_jsonb($2::text)`;

export async function deletionImpacts(db: Queryable, d: ProfileDeletions, professionLabel: string): Promise<DeletionImpact[]> {
  const impacts: DeletionImpact[] = [];
  if (d.profession) {
    impacts.push({ label: `Pergunta “${professionLabel}”`, answers: await count(db, `SELECT count(*) AS n FROM participants WHERE profession_code IS NOT NULL`, []) });
  }
  for (const o of d.professionOptions) {
    impacts.push({ label: `Opção “${o.label}” de “${professionLabel}”`, answers: await count(db, `SELECT count(*) AS n FROM participants WHERE profession_code = $1`, [o.code]) });
  }
  for (const f of d.fields) {
    impacts.push({ label: `Pergunta “${f.label}”`, answers: await count(db, `SELECT count(*) AS n FROM participants WHERE profile_answers ? $1`, [f.key]) });
  }
  for (const { field, option } of d.options) {
    impacts.push({ label: `Opção “${option.label}” de “${field.label}”`, answers: await count(db, `SELECT count(*) AS n FROM participants WHERE ${HAS_OPTION}`, [field.key, option.code]) });
  }
  return impacts;
}

async function purgeOption(db: Queryable, key: string, code: string): Promise<void> {
  // Escolha única: remove a chave.
  await query(`UPDATE participants SET profile_answers = profile_answers - $1::text WHERE profile_answers ->> $1::text = $2`, [key, code], db);
  // Múltipla escolha: tira o código da lista (e a chave, se a lista ficar vazia).
  await query(
    `UPDATE participants p
        SET profile_answers = CASE WHEN x.rest = '[]'::jsonb THEN p.profile_answers - $1::text ELSE jsonb_set(p.profile_answers, ARRAY[$1::text], x.rest) END
       FROM (SELECT id, COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(profile_answers -> $1::text) e WHERE e <> to_jsonb($2::text)), '[]'::jsonb) AS rest
               FROM participants
              WHERE jsonb_typeof(profile_answers -> $1::text) = 'array' AND ${HAS_OPTION}) x
      WHERE p.id = x.id`,
    [key, code],
    db,
  );
}

export async function purgeDeletions(db: Queryable, d: ProfileDeletions): Promise<void> {
  if (d.profession) {
    await query(`UPDATE participants SET profession_code = NULL WHERE profession_code IS NOT NULL`, [], db);
    await query(`DELETE FROM professional_categories`, [], db);
  }
  for (const o of d.professionOptions) {
    await query(`UPDATE participants SET profession_code = NULL WHERE profession_code = $1`, [o.code], db);
    await query(`DELETE FROM professional_categories WHERE code = $1`, [o.code], db);
  }
  for (const f of d.fields) {
    await query(`UPDATE participants SET profile_answers = profile_answers - $1::text WHERE profile_answers ? $1`, [f.key], db);
  }
  for (const { field, option } of d.options) await purgeOption(db, field.key, option.code);
  // A nuvem de palavras em cache foi calculada com os dados antigos.
  const anything = d.profession || d.professionOptions.length + d.fields.length + d.options.length > 0;
  if (anything) await query(`DELETE FROM word_frequencies`, [], db);
}
