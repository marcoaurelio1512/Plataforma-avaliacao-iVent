/**
 * Nuvem de palavras a partir dos textos originais, com cache em word_frequencies.
 * O cache guarda só os totais (termo/ocorrências/participantes); as fontes
 * clicáveis são sempre lidas do texto original.
 */
import { createHash } from "node:crypto";
import { buildWordCloud, type CloudTerm, type TextSettings } from "../../shared/text.ts";
import { query, withTransaction } from "../db.ts";
import { textDocuments, type TextMeta } from "./analytics.ts";
import type { Dataset } from "./dataset.ts";

export function computeCloud(ds: Dataset, settings: TextSettings, questionKey?: string): CloudTerm<TextMeta>[] {
  return buildWordCloud(textDocuments(ds, { questionKey }), settings);
}

export function cloudCacheKey(ds: Dataset, settings: TextSettings, questionKey?: string): string {
  const f = ds.filters;
  const signature = JSON.stringify([ds.version.id, f.profession, f.iventVersionId, f.from, f.to, questionKey, settings, ds.responses.length]);
  return createHash("sha256").update(signature).digest("hex").slice(0, 40);
}

/** Persiste o retrato de frequências (até 200 termos) se ainda não existir para esta chave. */
export async function storeFrequencies(ds: Dataset, cacheKey: string, terms: readonly CloudTerm<TextMeta>[]): Promise<boolean> {
  const top = terms.slice(0, 200);
  if (!top.length) return false;
  return withTransaction(async (client) => {
    const exists = await client.query(`SELECT 1 FROM word_frequencies WHERE cache_key = $1 LIMIT 1`, [cacheKey]);
    if (exists.rowCount) return false;
    await client.query(
      `INSERT INTO word_frequencies (cache_key, survey_id, term_key, label, occurrences, participant_count)
       SELECT $1, $2, t.key, t.label, t.occ, t.part
         FROM unnest($3::text[], $4::text[], $5::int[], $6::int[]) AS t(key, label, occ, part)
       ON CONFLICT (cache_key, term_key) DO NOTHING`,
      [cacheKey, ds.survey.id, top.map((t) => t.key), top.map((t) => t.label), top.map((t) => t.occurrences), top.map((t) => t.participants)],
    );
    return true;
  });
}

export async function cachedFrequencies(cacheKey: string): Promise<{ key: string; label: string; occurrences: number; participants: number }[]> {
  const rows = await query<{ term_key: string; label: string; occurrences: number; participant_count: number }>(
    `SELECT term_key, label, occurrences, participant_count FROM word_frequencies
      WHERE cache_key = $1 ORDER BY occurrences DESC, participant_count DESC`,
    [cacheKey],
  );
  return rows.map((r) => ({ key: r.term_key, label: r.label, occurrences: r.occurrences, participants: r.participant_count }));
}
