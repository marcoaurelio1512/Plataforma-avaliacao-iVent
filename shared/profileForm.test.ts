import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_FORM,
  assignKeys,
  checkProfileAnswers,
  findDeletions,
  fromLegacyProfileForm,
  missingRequired,
  profileAnswerLabel,
  publicProfileForm,
  typeChanges,
  type ProfileField,
  type ProfileForm,
} from "./profileForm.ts";

const PROFESSIONS = [
  { code: "resident_neonatology", label: "Médico residente de Neonatologia", active: true },
  { code: "physiotherapist", label: "Fisioterapeuta", active: true },
];
const BASE: ProfileForm = { ...DEFAULT_PROFILE_FORM, profession: { ...DEFAULT_PROFILE_FORM.profession!, options: PROFESSIONS } };
const field = (key: string): ProfileField => BASE.fields.find((f) => f.key === key)!;
const withFields = (fields: ProfileField[]): ProfileForm => ({ ...BASE, fields });
const textField: ProfileField = { key: "", label: "Instituição", type: "text", required: false, enabled: true, options: [] };

describe("publicProfileForm", () => {
  it("omite perguntas e opções ocultas e mantém a profissão quando existe", () => {
    const years = field("experienceYears");
    const form = withFields([
      { ...years, options: years.options.map((o) => (o.code === "lt1" ? { ...o, active: false } : o)) },
      { ...field("iventExperience"), enabled: false },
    ]);
    const pub = publicProfileForm(form);
    expect(pub.profession?.options.map((o) => o.code)).toEqual(["resident_neonatology", "physiotherapist"]);
    expect(pub.fields.map((f) => f.key)).toEqual(["experienceYears"]);
    expect(pub.fields[0]!.options.map((o) => o.code)).toEqual(["1to3", "4to5", "gt5"]);
  });

  it("sem pergunta de profissão o participante não a recebe", () => {
    expect(publicProfileForm({ ...BASE, profession: null }).profession).toBeNull();
  });
});

describe("assignKeys", () => {
  it("gera chave para pergunta nova e código para opção nova, sem repetir", () => {
    const sim = field("simulatorExperience");
    const form = withFields([
      { ...sim, options: [...sim.options, { code: "", label: "Básica", active: true }] },
      textField,
      { ...textField, label: "Instituição" },
    ]);
    const out = assignKeys(form);
    expect(out.fields.map((f) => f.key)).toEqual(["simulatorExperience", "instituicao", "instituicao_2"]);
    expect(out.fields[0]!.options.at(-1)!.code).toBe("basica");
  });

  it("gera código de categoria profissional nova e não altera o formulário recebido", () => {
    const form: ProfileForm = { ...BASE, profession: { ...BASE.profession!, options: [...PROFESSIONS, { code: "", label: "Enfermeiro(a)", active: true }] } };
    expect(assignKeys(form).profession!.options.at(-1)!.code).toBe("enfermeiro_a");
    expect(form.profession!.options.at(-1)!.code).toBe("");
  });
});

describe("findDeletions e typeChanges", () => {
  it("lista perguntas, opções e a profissão apagadas", () => {
    const years = field("experienceYears");
    const next: ProfileForm = {
      ...BASE,
      profession: null,
      fields: [{ ...years, options: years.options.filter((o) => o.code !== "gt5") }, field("iventExperience")],
    };
    expect(findDeletions(BASE, next)).toEqual({
      profession: true,
      professionOptions: [],
      fields: [field("simulatorExperience")],
      options: [{ field: years, option: years.options[3] }],
    });
  });

  it("apagar categoria profissional aparece como opção da profissão", () => {
    const next: ProfileForm = { ...BASE, profession: { ...BASE.profession!, options: PROFESSIONS.slice(0, 1) } };
    expect(findDeletions(BASE, next).professionOptions).toEqual([PROFESSIONS[1]]);
  });

  it("ocultar não é apagar", () => {
    const next = withFields(BASE.fields.map((f) => ({ ...f, enabled: false, options: f.options.map((o) => ({ ...o, active: false })) })));
    expect(findDeletions(BASE, next)).toEqual({ profession: false, professionOptions: [], fields: [], options: [] });
  });

  it("detecta troca de tipo em pergunta já salva", () => {
    const next = withFields(BASE.fields.map((f) => (f.key === "iventExperience" ? { ...f, type: "multiple" as const } : f)));
    expect(typeChanges(BASE, next)).toEqual(["iventExperience"]);
  });
});

describe("checkProfileAnswers", () => {
  const form = withFields([{ ...field("experienceYears"), required: true }, { ...field("simulatorExperience"), type: "multiple" }, { ...textField, key: "instituicao" }]);

  it("aceita escolha única, múltipla e texto, e normaliza", () => {
    const out = checkProfileAnswers(form, {
      profession: "physiotherapist",
      answers: { experienceYears: "lt1", simulatorExperience: ["basic", "basic", "advanced"], instituicao: "  HC  ", lixo: "x" },
    });
    expect(out).toEqual({ ok: true, profession: "physiotherapist", answers: { experienceYears: "lt1", simulatorExperience: ["basic", "advanced"], instituicao: "HC" } });
  });

  it("recusa obrigatória sem resposta, código inexistente e categoria oculta", () => {
    expect(checkProfileAnswers(form, { profession: "physiotherapist", answers: {} })).toMatchObject({ ok: false });
    expect(checkProfileAnswers(form, { profession: "physiotherapist", answers: { experienceYears: "xyz" } })).toMatchObject({ ok: false });
    const hidden: ProfileForm = { ...form, profession: { ...form.profession!, options: PROFESSIONS.map((p) => ({ ...p, active: p.code === "resident_neonatology" })) } };
    expect(checkProfileAnswers(hidden, { profession: "physiotherapist", answers: { experienceYears: "lt1" } })).toMatchObject({ ok: false });
  });

  it("sem pergunta de profissão grava profissão vazia e descarta resposta de pergunta oculta", () => {
    const noProf: ProfileForm = { ...form, profession: null, fields: form.fields.map((f) => (f.key === "experienceYears" ? { ...f, enabled: false } : f)) };
    expect(checkProfileAnswers(noProf, { profession: "physiotherapist", answers: { experienceYears: "lt1" } })).toEqual({ ok: true, profession: null, answers: {} });
  });
});

describe("missingRequired", () => {
  it("aponta a primeira pergunta obrigatória sem resposta, começando pela profissão", () => {
    const form = withFields([{ ...field("experienceYears"), required: true }]);
    expect(missingRequired(publicProfileForm(form), { profession: null, answers: {} })).toBe("Categoria profissional");
    expect(missingRequired(publicProfileForm(form), { profession: "physiotherapist", answers: {} })).toBe("Tempo de experiência");
    expect(missingRequired(publicProfileForm(form), { profession: "physiotherapist", answers: { experienceYears: "lt1" } })).toBeNull();
  });
});

describe("profileAnswerLabel", () => {
  it("traduz códigos para os nomes atuais e junta múltiplas escolhas", () => {
    expect(profileAnswerLabel(field("experienceYears"), "1to3")).toBe("1–3 anos");
    expect(profileAnswerLabel({ ...field("simulatorExperience"), type: "multiple" }, ["none", "basic"])).toBe("Nenhuma; Básica");
    expect(profileAnswerLabel({ ...textField, key: "instituicao" }, "HC")).toBe("HC");
    expect(profileAnswerLabel(field("experienceYears"), undefined)).toBe("Não informado");
  });
});

describe("fromLegacyProfileForm", () => {
  it("converte o formato da versão anterior (campos fixos, opção ativa/inativa)", () => {
    const legacy = {
      title: "Seu perfil",
      subtitle: "",
      professionLabel: "Profissão",
      fields: {
        experienceYears: { label: "Anos", enabled: true, options: [{ code: "lt1", label: "Até 1", active: false }] },
        simulatorExperience: { label: "Sim", enabled: false, options: [{ code: "none", label: "Nenhuma", active: true }] },
        iventExperience: { label: "iVent", enabled: true, options: [{ code: "first", label: "Primeiro", active: true }] },
      },
    };
    const form = fromLegacyProfileForm(legacy);
    expect(form.title).toBe("Seu perfil");
    expect(form.profession).toEqual({ label: "Profissão", required: true, enabled: true, options: [] });
    expect(form.fields.map((f) => [f.key, f.type, f.required, f.enabled])).toEqual([
      ["experienceYears", "single", false, true],
      ["simulatorExperience", "single", false, false],
      ["iventExperience", "single", false, true],
    ]);
    expect(form.fields[0]!.options[0]).toEqual({ code: "lt1", label: "Até 1", active: false });
  });
});
