/**
 * Formulário de perfil do participante. Textos e perguntas ficam em
 * app_settings (chave profile_form); as opções da categoria profissional ficam
 * em professional_categories (usadas por filtros e comparação entre grupos).
 */
import { z } from "zod";
import {
  DEFAULT_PROFILE_FORM,
  assignKeys,
  findDeletions,
  fromLegacyProfileForm,
  typeChanges,
  type ProfileForm,
} from "../../shared/profileForm.ts";
import { getPool, query, queryOne, withTransaction, type Queryable } from "../db.ts";
import { HttpError, badRequest } from "../http.ts";
import { deletionImpacts, purgeDeletions } from "./profilePurge.ts";

const KEY = "profile_form";
const MAX_FIELDS = 30;
const MAX_OPTIONS = 50;
const CODE = /^([a-z0-9_]{2,60})?$/;
// As três perguntas originais usam camelCase (experienceYears…); as novas recebem chave minúscula.
const FIELD_KEY = /^([A-Za-z0-9_]{2,60})?$/;

const optionSchema = z.object({
  // Vazio = opção nova; o código é gerado a partir do nome.
  code: z.string().trim().regex(CODE, "Código de opção inválido."),
  label: z.string().trim().min(1, "Toda opção precisa de um nome.").max(120),
  active: z.boolean(),
});

const fieldSchema = z.object({
  key: z.string().trim().regex(FIELD_KEY, "Chave de pergunta inválida."),
  label: z.string().trim().min(2, "Toda pergunta precisa de um texto.").max(200),
  type: z.enum(["single", "multiple", "text"]),
  required: z.boolean(),
  enabled: z.boolean(),
  options: z.array(optionSchema).max(MAX_OPTIONS),
});

const professionBase = z.object({
  label: z.string().trim().min(2, "Informe o texto da pergunta de categoria profissional.").max(200),
  required: z.boolean(),
  enabled: z.boolean(),
});

const formBase = {
  title: z.string().trim().min(2, "Informe o título da tela.").max(120),
  subtitle: z.string().trim().max(300),
  fields: z.array(fieldSchema).max(MAX_FIELDS),
};

/** Entrada do PUT: inclui as categorias profissionais e a confirmação de exclusões. */
export const profileFormInputSchema = z.object({
  ...formBase,
  profession: professionBase.extend({ options: z.array(optionSchema).max(MAX_OPTIONS) }).nullable(),
  confirmDeletions: z.boolean().optional(),
});
export type ProfileFormInput = z.infer<typeof profileFormInputSchema>;

/** O que fica gravado em app_settings (sem as categorias, que têm tabela própria). */
const storedSchema = z.object({ ...formBase, profession: professionBase.nullable() });

const legacySchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  professionLabel: z.string(),
  fields: z.object({
    experienceYears: z.object({ label: z.string(), enabled: z.boolean(), options: z.array(optionSchema) }),
    simulatorExperience: z.object({ label: z.string(), enabled: z.boolean(), options: z.array(optionSchema) }),
    iventExperience: z.object({ label: z.string(), enabled: z.boolean(), options: z.array(optionSchema) }),
  }),
});

function parseStored(value: unknown): ProfileForm {
  const stored = storedSchema.safeParse(value);
  if (stored.success) return { ...stored.data, profession: stored.data.profession && { ...stored.data.profession, options: [] } };
  const legacy = legacySchema.safeParse(value);
  return legacy.success ? fromLegacyProfileForm(legacy.data) : DEFAULT_PROFILE_FORM;
}

export async function hasSavedProfileForm(db: Queryable = getPool()): Promise<boolean> {
  return Boolean(await queryOne(`SELECT 1 FROM app_settings WHERE key = $1`, [KEY], db));
}

/** Formulário atual (padrão enquanto ninguém salvou), com as categorias profissionais. */
export async function getProfileForm(db: Queryable = getPool()): Promise<ProfileForm> {
  const row = await queryOne<{ value: unknown }>(`SELECT value FROM app_settings WHERE key = $1`, [KEY], db);
  const form = parseStored(row?.value);
  if (!form.profession) return form;
  const options = await query<{ code: string; label: string; active: boolean }>(
    `SELECT code, label, active FROM professional_categories ORDER BY position, label`,
    [],
    db,
  );
  return { ...form, profession: { ...form.profession, options } };
}

function assertConsistent(prev: ProfileForm, next: ProfileForm): void {
  const keys = next.fields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) throw badRequest("Há perguntas repetidas. Recarregue a página e tente de novo.");
  const changed = typeChanges(prev, next);
  if (changed.length) throw badRequest("O tipo de uma pergunta já salva não pode mudar. Apague-a e crie outra com o tipo desejado.");
  const questions = [...(next.profession ? [{ label: next.profession.label, enabled: next.profession.enabled, choice: true, options: next.profession.options }] : []),
    ...next.fields.map((f) => ({ label: f.label, enabled: f.enabled, choice: f.type !== "text", options: f.options }))];
  for (const q of questions.filter((x) => x.choice)) {
    const codes = q.options.map((o) => o.code);
    if (new Set(codes).size !== codes.length) throw badRequest(`“${q.label}” tem opções repetidas.`);
    if (q.enabled && !q.options.some((o) => o.active)) throw badRequest(`“${q.label}” está visível mas não tem nenhuma opção ativa. Adicione ou ative uma opção, ou oculte a pergunta.`);
  }
}

async function syncProfessions(db: Queryable, form: ProfileForm): Promise<void> {
  if (!form.profession) return;
  for (const [position, o] of form.profession.options.entries()) {
    await query(
      `INSERT INTO professional_categories (code, label, position, active) VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, position = EXCLUDED.position, active = EXCLUDED.active`,
      [o.code, o.label, position, o.active],
      db,
    );
  }
}

/**
 * Valida e grava. Se a mudança apaga respostas já recebidas, exige
 * `confirmDeletions` e devolve 409 com o impacto para o administrador confirmar.
 */
export async function saveProfileForm(input: ProfileFormInput): Promise<ProfileForm> {
  const { confirmDeletions, ...form } = input;
  return withTransaction(async (db) => {
    const prev = await getProfileForm(db);
    const next = assignKeys(form);
    assertConsistent(prev, next);
    const deletions = findDeletions(prev, next);
    const impacts = (await deletionImpacts(db, deletions, prev.profession?.label ?? "")).filter((i) => i.answers > 0);
    if (impacts.length && !confirmDeletions) {
      throw new HttpError(409, "confirm_deletions", "Esta alteração apaga respostas já recebidas. Confirme para continuar.", { impacts });
    }
    await purgeDeletions(db, deletions);
    await syncProfessions(db, next);
    const stored = { ...next, profession: next.profession && { label: next.profession.label, required: next.profession.required, enabled: next.profession.enabled } };
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [KEY, JSON.stringify(stored)],
      db,
    );
    return getProfileForm(db);
  });
}
