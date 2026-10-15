/**
 * Tela "Conte um pouco sobre você": textos, campos opcionais e opções editáveis
 * em Configurações. O código de cada opção é permanente (respostas antigas o
 * guardam); o rótulo pode mudar e vale também para o histórico.
 */

export const PROFILE_FIELD_KEYS = ["experienceYears", "simulatorExperience", "iventExperience"] as const;
export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];

export interface ProfileFieldOption {
  code: string;
  label: string;
  active: boolean;
}

export interface ProfileFieldConfig {
  label: string;
  enabled: boolean;
  options: ProfileFieldOption[];
}

export interface ProfileForm {
  title: string;
  subtitle: string;
  professionLabel: string;
  fields: Record<ProfileFieldKey, ProfileFieldConfig>;
}

/** O que o participante recebe: só campos visíveis e opções ativas, na ordem configurada. */
export interface PublicProfileForm {
  title: string;
  subtitle: string;
  professionLabel: string;
  fields: { key: ProfileFieldKey; label: string; options: { code: string; label: string }[] }[];
}

const option = (code: string, label: string): ProfileFieldOption => ({ code, label, active: true });

export const DEFAULT_PROFILE_FORM: ProfileForm = {
  title: "Conte um pouco sobre você",
  subtitle: "Usamos estas informações apenas para comparar percepções entre grupos.",
  professionLabel: "Categoria profissional",
  fields: {
    experienceYears: {
      label: "Tempo de experiência",
      enabled: true,
      options: [option("lt1", "Menos de 1 ano"), option("1to3", "1–3 anos"), option("4to5", "4–5 anos"), option("gt5", "Mais de 5 anos")],
    },
    simulatorExperience: {
      label: "Experiência prévia com simuladores de ventilação mecânica",
      enabled: true,
      options: [option("none", "Nenhuma"), option("basic", "Básica"), option("intermediate", "Intermediária"), option("advanced", "Avançada")],
    },
    iventExperience: {
      label: "Experiência prévia com o iVent NeoPed",
      enabled: true,
      options: [option("first", "Primeiro contato"), option("before", "Já utilizei anteriormente"), option("frequent", "Utilizo frequentemente")],
    },
  },
};

export const NOT_INFORMED = "Não informado";
const FALLBACK_CODE = "opcao";
const MAX_CODE_LENGTH = 30;

export function profileOptionLabel(form: ProfileForm, key: ProfileFieldKey, code: string | null | undefined): string {
  if (!code) return NOT_INFORMED;
  return form.fields[key].options.find((o) => o.code === code)?.label ?? code;
}

export function publicProfileForm(form: ProfileForm): PublicProfileForm {
  return {
    title: form.title,
    subtitle: form.subtitle,
    professionLabel: form.professionLabel,
    fields: PROFILE_FIELD_KEYS.filter((key) => form.fields[key].enabled).map((key) => ({
      key,
      label: form.fields[key].label,
      options: form.fields[key].options.filter((o) => o.active).map(({ code, label }) => ({ code, label })),
    })),
  };
}

function slug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_CODE_LENGTH - 3);
}

function uniqueCode(label: string, taken: ReadonlySet<string>): string {
  const base = slug(label) || FALLBACK_CODE;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

function withCodes(options: ProfileFieldOption[]): ProfileFieldOption[] {
  const taken = new Set(options.map((o) => o.code).filter(Boolean));
  return options.map((o) => {
    if (o.code) return o;
    const code = uniqueCode(o.label, taken);
    taken.add(code);
    return { ...o, code };
  });
}

/** Opções novas chegam sem código; o servidor gera um a partir do rótulo. */
export function assignOptionCodes(form: ProfileForm): ProfileForm {
  const fields = Object.fromEntries(
    PROFILE_FIELD_KEYS.map((key) => [key, { ...form.fields[key], options: withCodes(form.fields[key].options) }]),
  ) as ProfileForm["fields"];
  return { ...form, fields };
}

/** Opções já salvas que não estão no novo formulário (devem ser ocultadas, não apagadas). */
export function removedOptions(previous: ProfileForm, next: ProfileForm): { field: ProfileFieldKey; code: string; label: string }[] {
  return PROFILE_FIELD_KEYS.flatMap((field) => {
    const kept = new Set(next.fields[field].options.map((o) => o.code));
    return previous.fields[field].options.filter((o) => !kept.has(o.code)).map((o) => ({ field, code: o.code, label: o.label }));
  });
}

export type ProfileAnswers = Partial<Record<ProfileFieldKey, string | null | undefined>>;

export type ProfileAnswerCheck =
  | { ok: true; values: Record<ProfileFieldKey, string | null> }
  | { ok: false; field: ProfileFieldKey };

/**
 * Confere as respostas opcionais do participante contra o formulário atual.
 * Campo oculto é descartado (rascunho aberto antes da mudança); código
 * desconhecido é recusado. Opção oculta continua aceita pelo mesmo motivo.
 */
export function checkProfileAnswers(form: ProfileForm, answers: ProfileAnswers): ProfileAnswerCheck {
  const values = {} as Record<ProfileFieldKey, string | null>;
  for (const key of PROFILE_FIELD_KEYS) {
    const code = answers[key] || null;
    const field = form.fields[key];
    if (!code || !field.enabled) {
      values[key] = null;
      continue;
    }
    if (!field.options.some((o) => o.code === code)) return { ok: false, field: key };
    values[key] = code;
  }
  return { ok: true, values };
}
