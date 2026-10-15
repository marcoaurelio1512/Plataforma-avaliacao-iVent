/** Formulário de perfil do participante (textos, campos e opções), em app_settings. */
import { z } from "zod";
import {
  DEFAULT_PROFILE_FORM,
  PROFILE_FIELD_KEYS,
  assignOptionCodes,
  removedOptions,
  type ProfileForm,
} from "../../shared/profileForm.ts";
import { query, queryOne } from "../db.ts";
import { badRequest, conflict } from "../http.ts";

const KEY = "profile_form";
const MAX_OPTIONS = 30;

const optionSchema = z.object({
  // Vazio = opção nova; o código é gerado a partir do rótulo.
  code: z.string().trim().regex(/^([a-z0-9_]{1,30})?$/, "Código de opção inválido."),
  label: z.string().trim().min(1, "Toda opção precisa de um nome.").max(80),
  active: z.boolean(),
});

const fieldSchema = z.object({
  label: z.string().trim().min(2, "Todo campo precisa de um nome.").max(160),
  enabled: z.boolean(),
  options: z.array(optionSchema).min(1).max(MAX_OPTIONS),
});

export const profileFormSchema = z.object({
  title: z.string().trim().min(2, "Informe o título da tela.").max(120),
  subtitle: z.string().trim().max(300),
  professionLabel: z.string().trim().min(2, "Informe o nome do campo de categoria profissional.").max(120),
  fields: z.object({
    experienceYears: fieldSchema,
    simulatorExperience: fieldSchema,
    iventExperience: fieldSchema,
  }),
});

/** Formulário salvo, ou o padrão enquanto ninguém editou (ou se o valor gravado for inválido). */
export async function getProfileForm(): Promise<ProfileForm> {
  const row = await queryOne<{ value: unknown }>(`SELECT value FROM app_settings WHERE key = $1`, [KEY]);
  const parsed = profileFormSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_PROFILE_FORM;
}

function assertConsistent(form: ProfileForm): void {
  for (const key of PROFILE_FIELD_KEYS) {
    const field = form.fields[key];
    const codes = field.options.map((o) => o.code);
    if (new Set(codes).size !== codes.length) throw badRequest(`O campo "${field.label}" tem opções com o mesmo código.`);
    if (field.enabled && !field.options.some((o) => o.active)) {
      throw badRequest(`O campo "${field.label}" está visível mas não tem nenhuma opção ativa. Ative uma opção ou oculte o campo.`);
    }
  }
}

/** Valida e grava. Opções já salvas não podem sumir: respostas antigas guardam o código. */
export async function saveProfileForm(input: ProfileForm): Promise<ProfileForm> {
  const next = assignOptionCodes(input);
  assertConsistent(next);
  const removed = removedOptions(await getProfileForm(), next);
  if (removed.length) {
    throw conflict(`Opções já existentes não podem ser apagadas, apenas ocultadas: ${removed.map((r) => `"${r.label}"`).join(", ")}.`);
  }
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify(next)],
  );
  return next;
}
