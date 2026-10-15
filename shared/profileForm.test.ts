import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_FORM,
  assignOptionCodes,
  checkProfileAnswers,
  profileOptionLabel,
  publicProfileForm,
  removedOptions,
  type ProfileForm,
} from "./profileForm.ts";

const withField = (form: ProfileForm, key: keyof ProfileForm["fields"], patch: Partial<ProfileForm["fields"]["experienceYears"]>): ProfileForm => ({
  ...form,
  fields: { ...form.fields, [key]: { ...form.fields[key], ...patch } },
});

describe("profileOptionLabel", () => {
  it("devolve o rótulo atual da opção", () => {
    expect(profileOptionLabel(DEFAULT_PROFILE_FORM, "experienceYears", "1to3")).toBe("1–3 anos");
  });

  it("mostra 'Não informado' sem resposta e o próprio código quando a opção não existe", () => {
    expect(profileOptionLabel(DEFAULT_PROFILE_FORM, "simulatorExperience", null)).toBe("Não informado");
    expect(profileOptionLabel(DEFAULT_PROFILE_FORM, "simulatorExperience", "xyz")).toBe("xyz");
  });

  it("usa o rótulo renomeado também para respostas antigas (mesmo código)", () => {
    const renamed = withField(DEFAULT_PROFILE_FORM, "iventExperience", {
      options: DEFAULT_PROFILE_FORM.fields.iventExperience.options.map((o) => (o.code === "first" ? { ...o, label: "Nunca usei" } : o)),
    });
    expect(profileOptionLabel(renamed, "iventExperience", "first")).toBe("Nunca usei");
  });
});

describe("publicProfileForm", () => {
  it("omite campos ocultos e opções ocultas", () => {
    const form = withField(
      withField(DEFAULT_PROFILE_FORM, "iventExperience", { enabled: false }),
      "experienceYears",
      { options: DEFAULT_PROFILE_FORM.fields.experienceYears.options.map((o) => (o.code === "lt1" ? { ...o, active: false } : o)) },
    );
    const pub = publicProfileForm(form);
    expect(pub.fields.map((f) => f.key)).toEqual(["experienceYears", "simulatorExperience"]);
    expect(pub.fields[0]!.options.map((o) => o.code)).toEqual(["1to3", "4to5", "gt5"]);
    expect(pub.title).toBe(DEFAULT_PROFILE_FORM.title);
  });
});

describe("assignOptionCodes", () => {
  it("gera código a partir do rótulo para opções novas, sem repetir códigos do campo", () => {
    const form = withField(DEFAULT_PROFILE_FORM, "simulatorExperience", {
      options: [...DEFAULT_PROFILE_FORM.fields.simulatorExperience.options, { code: "", label: "Básica", active: true }, { code: "", label: "Muito avançada!", active: true }],
    });
    const codes = assignOptionCodes(form).fields.simulatorExperience.options.map((o) => o.code);
    expect(codes).toEqual(["none", "basic", "intermediate", "advanced", "basica", "muito_avancada"]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("não altera o formulário recebido", () => {
    const form = withField(DEFAULT_PROFILE_FORM, "experienceYears", { options: [{ code: "", label: "Novo", active: true }] });
    assignOptionCodes(form);
    expect(form.fields.experienceYears.options[0]!.code).toBe("");
  });

  it("usa código de reserva quando o rótulo não tem letras nem números", () => {
    const form = withField(DEFAULT_PROFILE_FORM, "experienceYears", { options: [{ code: "", label: "—", active: true }] });
    expect(assignOptionCodes(form).fields.experienceYears.options[0]!.code).toBe("opcao");
  });
});

describe("removedOptions", () => {
  it("aponta opções salvas que sumiram do novo formulário", () => {
    const next = withField(DEFAULT_PROFILE_FORM, "experienceYears", {
      options: DEFAULT_PROFILE_FORM.fields.experienceYears.options.filter((o) => o.code !== "gt5"),
    });
    expect(removedOptions(DEFAULT_PROFILE_FORM, next)).toEqual([{ field: "experienceYears", code: "gt5", label: "Mais de 5 anos" }]);
  });

  it("ocultar não conta como remoção", () => {
    const next = withField(DEFAULT_PROFILE_FORM, "experienceYears", {
      options: DEFAULT_PROFILE_FORM.fields.experienceYears.options.map((o) => ({ ...o, active: false })),
    });
    expect(removedOptions(DEFAULT_PROFILE_FORM, next)).toEqual([]);
  });
});

describe("checkProfileAnswers", () => {
  it("aceita códigos válidos e vazios", () => {
    expect(checkProfileAnswers(DEFAULT_PROFILE_FORM, { experienceYears: "lt1", simulatorExperience: null })).toEqual({
      ok: true,
      values: { experienceYears: "lt1", simulatorExperience: null, iventExperience: null },
    });
  });

  it("recusa código que não existe no campo", () => {
    expect(checkProfileAnswers(DEFAULT_PROFILE_FORM, { iventExperience: "lt1" })).toEqual({ ok: false, field: "iventExperience" });
  });

  it("descarta resposta de campo oculto (rascunho antigo)", () => {
    const form = withField(DEFAULT_PROFILE_FORM, "iventExperience", { enabled: false });
    expect(checkProfileAnswers(form, { iventExperience: "first" })).toMatchObject({ ok: true, values: { iventExperience: null } });
  });
});
