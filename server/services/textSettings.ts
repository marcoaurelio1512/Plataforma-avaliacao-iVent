/** Configurações da análise textual (stopwords/expressões/termos extras), em app_settings. */
import { z } from "zod";
import { DEFAULT_TEXT_SETTINGS, type TextSettings } from "../../shared/text.ts";
import { query, queryOne } from "../db.ts";

export const textSettingsSchema = z.object({
  extraStopwords: z.array(z.string().trim().min(1).max(60)).max(500),
  extraPhrases: z.array(z.string().trim().min(3).max(80)).max(200),
  extraProtected: z.array(z.string().trim().min(1).max(40)).max(200),
});

const KEY = "text_settings";

export async function getTextSettings(): Promise<TextSettings> {
  const row = await queryOne<{ value: unknown }>(`SELECT value FROM app_settings WHERE key = $1`, [KEY]);
  const parsed = textSettingsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_TEXT_SETTINGS;
}

export async function saveTextSettings(settings: TextSettings): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify(settings)],
  );
  // Novas regras invalidam toda a nuvem em cache (dado recalculável).
  await query(`DELETE FROM word_frequencies`);
}
