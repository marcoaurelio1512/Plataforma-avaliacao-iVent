/**
 * Tela "Conte um pouco sobre você", editável em Configurações → Tela de perfil.
 * A pergunta de categoria profissional é especial (alimenta comparação entre
 * grupos e filtros; suas opções vivem em professional_categories). As demais
 * perguntas são livres: escolha única, múltipla escolha ou texto curto.
 * Chaves e códigos são permanentes (respostas os guardam); rótulos podem mudar.
 * Apagar pergunta ou opção apaga também as respostas já recebidas.
 */

export type ProfileFieldType = "single" | "multiple" | "text";

export const PROFILE_FIELD_TYPE_LABELS: Record<ProfileFieldType, string> = {
  single: "Escolha única",
  multiple: "Múltipla escolha",
  text: "Texto curto",
};

export interface ProfileOption {
  code: string;
  label: string;
  active: boolean;
}

export interface ProfileField {
  key: string;
  label: string;
  type: ProfileFieldType;
  required: boolean;
  enabled: boolean;
  options: ProfileOption[];
}

export interface ProfessionQuestion {
  label: string;
  required: boolean;
  enabled: boolean;
  options: ProfileOption[];
}

export interface ProfileForm {
  title: string;
  subtitle: string;
  profession: ProfessionQuestion | null;
  fields: ProfileField[];
}

export type ProfileAnswerValue = string | string[];
export type ProfileAnswers = Record<string, ProfileAnswerValue>;

/** Perfil enviado pelo participante. */
export interface ProfileInput {
  profession: string | null;
  answers: ProfileAnswers;
}

interface PublicQuestion {
  label: string;
  required: boolean;
  options: { code: string; label: string }[];
}

export interface PublicProfileForm {
  title: string;
  subtitle: string;
  profession: PublicQuestion | null;
  fields: (PublicQuestion & { key: string; type: ProfileFieldType })[];
}

export const NOT_INFORMED = "Não informado";
export const PROFILE_TEXT_MAX = 300;
const FALLBACK_CODE = "opcao";
const FALLBACK_KEY = "pergunta";
const MAX_CODE_LENGTH = 30;

const option = (code: string, label: string): ProfileOption => ({ code, label, active: true });
const choice = (key: string, label: string, options: ProfileOption[]): ProfileField => ({ key, label, type: "single", required: false, enabled: true, options });

export const DEFAULT_PROFILE_FORM: ProfileForm = {
  title: "Conte um pouco sobre você",
  subtitle: "Usamos estas informações apenas para comparar percepções entre grupos.",
  // As opções da profissão vêm da tabela professional_categories.
  profession: { label: "Categoria profissional", required: true, enabled: true, options: [] },
  fields: [
    choice("experienceYears", "Tempo de experiência", [option("lt1", "Menos de 1 ano"), option("1to3", "1–3 anos"), option("4to5", "4–5 anos"), option("gt5", "Mais de 5 anos")]),
    choice("simulatorExperience", "Experiência prévia com simuladores de ventilação mecânica", [option("none", "Nenhuma"), option("basic", "Básica"), option("intermediate", "Intermediária"), option("advanced", "Avançada")]),
    choice("iventExperience", "Experiência prévia com o iVent NeoPed", [option("first", "Primeiro contato"), option("before", "Já utilizei anteriormente"), option("frequent", "Utilizo frequentemente")]),
  ],
};

const isChoice = (f: { type: ProfileFieldType }) => f.type !== "text";
const visibleOptions = (options: ProfileOption[]) => options.filter((o) => o.active).map(({ code, label }) => ({ code, label }));

export function publicProfileForm(form: ProfileForm): PublicProfileForm {
  const p = form.profession;
  return {
    title: form.title,
    subtitle: form.subtitle,
    profession: p && p.enabled ? { label: p.label, required: p.required, options: visibleOptions(p.options) } : null,
    fields: form.fields
      .filter((f) => f.enabled)
      .map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, options: isChoice(f) ? visibleOptions(f.options) : [] })),
  };
}

// Chaves e códigos ------------------------------------------------------------------

function slug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_CODE_LENGTH - 3);
}

function uniqueSlug(label: string, fallback: string, taken: Set<string>): string {
  const base = slug(label).length >= 2 ? slug(label) : fallback;
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}_${n}`;
  taken.add(candidate);
  return candidate;
}

function withCodes(options: ProfileOption[]): ProfileOption[] {
  const taken = new Set(options.map((o) => o.code).filter(Boolean));
  return options.map((o) => (o.code ? o : { ...o, code: uniqueSlug(o.label, FALLBACK_CODE, taken) }));
}

/** Perguntas e opções novas chegam sem chave/código; geramos a partir do rótulo. */
export function assignKeys(form: ProfileForm): ProfileForm {
  const taken = new Set(form.fields.map((f) => f.key).filter(Boolean));
  return {
    ...form,
    profession: form.profession && { ...form.profession, options: withCodes(form.profession.options) },
    fields: form.fields.map((f) => ({
      ...f,
      key: f.key || uniqueSlug(f.label, FALLBACK_KEY, taken),
      options: isChoice(f) ? withCodes(f.options) : [],
    })),
  };
}

// Mudanças entre a versão salva e a nova -------------------------------------------

export interface ProfileDeletions {
  profession: boolean;
  professionOptions: ProfileOption[];
  fields: ProfileField[];
  options: { field: ProfileField; option: ProfileOption }[];
}

const missingFrom = (prev: ProfileOption[], next: ProfileOption[]) => {
  const kept = new Set(next.map((o) => o.code));
  return prev.filter((o) => !kept.has(o.code));
};

export function findDeletions(prev: ProfileForm, next: ProfileForm): ProfileDeletions {
  const nextFields = new Map(next.fields.map((f) => [f.key, f]));
  const kept = prev.fields.filter((f) => nextFields.has(f.key));
  return {
    profession: Boolean(prev.profession && !next.profession),
    professionOptions: prev.profession && next.profession ? missingFrom(prev.profession.options, next.profession.options) : [],
    fields: prev.fields.filter((f) => !nextFields.has(f.key)),
    options: kept.flatMap((f) => missingFrom(f.options, nextFields.get(f.key)!.options).map((option) => ({ field: f, option }))),
  };
}

/** Chaves de perguntas já salvas cujo tipo mudou (não permitido: as respostas ficariam inconsistentes). */
export function typeChanges(prev: ProfileForm, next: ProfileForm): string[] {
  const prevTypes = new Map(prev.fields.map((f) => [f.key, f.type]));
  return next.fields.filter((f) => prevTypes.has(f.key) && prevTypes.get(f.key) !== f.type).map((f) => f.key);
}

// Respostas ------------------------------------------------------------------------

export type ProfileAnswerCheck = { ok: true; profession: string | null; answers: ProfileAnswers } | { ok: false; message: string };

function normalizeAnswer(field: ProfileField, raw: unknown): ProfileAnswerValue | null | "invalid" {
  const codes = new Set(field.options.map((o) => o.code));
  if (field.type === "text") {
    const text = typeof raw === "string" ? raw.trim() : "";
    return text.length > PROFILE_TEXT_MAX ? "invalid" : text || null;
  }
  if (field.type === "single") {
    if (raw === null || raw === undefined || raw === "") return null;
    return typeof raw === "string" && codes.has(raw) ? raw : "invalid";
  }
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw) || raw.some((c) => typeof c !== "string" || !codes.has(c))) return "invalid";
  const unique = [...new Set(raw as string[])];
  return unique.length ? unique : null;
}

function checkProfession(form: ProfileForm, raw: string | null | undefined): { ok: true; value: string | null } | { ok: false; message: string } {
  const p = form.profession;
  if (!p || !p.enabled) return { ok: true, value: null };
  if (!raw) return p.required ? { ok: false, message: `Responda “${p.label}”.` } : { ok: true, value: null };
  return p.options.some((o) => o.code === raw && o.active) ? { ok: true, value: raw } : { ok: false, message: `Opção inválida em “${p.label}”. Recarregue a página.` };
}

/** Confere o perfil enviado contra o formulário atual. Perguntas ocultas ou desconhecidas são descartadas. */
export function checkProfileAnswers(form: ProfileForm, input: { profession?: string | null; answers?: Record<string, unknown> }): ProfileAnswerCheck {
  const profession = checkProfession(form, input.profession);
  if (!profession.ok) return profession;
  const answers: ProfileAnswers = {};
  for (const field of form.fields.filter((f) => f.enabled)) {
    const value = normalizeAnswer(field, input.answers?.[field.key]);
    if (value === "invalid") return { ok: false, message: `Resposta inválida em “${field.label}”. Recarregue a página.` };
    if (value === null && field.required) return { ok: false, message: `Responda “${field.label}”.` };
    if (value !== null) answers[field.key] = value;
  }
  return { ok: true, profession: profession.value, answers };
}

const isEmpty = (v: ProfileAnswerValue | undefined) => v === undefined || (Array.isArray(v) ? v.length === 0 : !v.trim());

/** Rótulo da primeira pergunta obrigatória sem resposta (para o participante), ou null. */
export function missingRequired(form: PublicProfileForm, profile: ProfileInput): string | null {
  if (form.profession?.required && !profile.profession) return form.profession.label;
  return form.fields.find((f) => f.required && isEmpty(profile.answers[f.key]))?.label ?? null;
}

/** Texto exibido em relatórios e exportações para uma resposta. */
export function profileAnswerLabel(field: ProfileField, value: ProfileAnswerValue | null | undefined): string {
  if (value === null || value === undefined || isEmpty(value)) return NOT_INFORMED;
  if (field.type === "text") return String(value);
  const label = (code: string) => field.options.find((o) => o.code === code)?.label ?? code;
  return Array.isArray(value) ? value.map(label).join("; ") : label(value);
}

// Formato da versão anterior (campos fixos) -------------------------------------------

interface LegacyField {
  label: string;
  enabled: boolean;
  options: ProfileOption[];
}

export interface LegacyProfileForm {
  title: string;
  subtitle: string;
  professionLabel: string;
  fields: Record<"experienceYears" | "simulatorExperience" | "iventExperience", LegacyField>;
}

export function fromLegacyProfileForm(legacy: LegacyProfileForm): ProfileForm {
  return {
    title: legacy.title,
    subtitle: legacy.subtitle,
    profession: { label: legacy.professionLabel, required: true, enabled: true, options: [] },
    fields: (["experienceYears", "simulatorExperience", "iventExperience"] as const).map((key) => ({
      key,
      label: legacy.fields[key].label,
      type: "single",
      required: false,
      enabled: legacy.fields[key].enabled,
      options: legacy.fields[key].options,
    })),
  };
}
