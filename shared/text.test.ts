import { describe, expect, it } from "vitest";
import { buildWordCloud, extractTerms, normalizeKey, tokenize, DEFAULT_TEXT_SETTINGS } from "./text.ts";
import { classifyThemes } from "./themes.ts";

const doc = (id: string, participantId: string, text: string) => ({
  id,
  participantId,
  text,
  meta: { profession: "physiotherapist" },
});

describe("normalização", () => {
  it("ignora maiúsculas, acentos e o subscrito de FiO₂ para agrupar", () => {
    expect(normalizeKey("Ventilação")).toBe("ventilacao");
    expect(normalizeKey("FiO₂")).toBe("fio2");
  });

  it("tokeniza preservando posições no texto original", () => {
    const text = "Gostei das curvas!";
    const tokens = tokenize(text);
    const curvas = tokens.find((t) => t.norm === "curvas")!;
    expect(text.slice(curvas.start, curvas.end)).toBe("curvas");
  });
});

describe("extração de termos", () => {
  it("remove stopwords em português e pontuação", () => {
    const keys = extractTerms("A interface é muito boa, e o menu também!", DEFAULT_TEXT_SETTINGS).map((t) => t.key);
    expect(keys).not.toContain("a");
    expect(keys).not.toContain("e");
    expect(keys).not.toContain("muito");
    expect(keys).toContain("interface");
  });

  it("preserva termos técnicos mesmo curtos (PEEP, PIP, EIT, FiO₂)", () => {
    const terms = extractTerms("Ajustei PEEP, PIP e FiO2; a EIT ajudou.", DEFAULT_TEXT_SETTINGS);
    const labels = terms.map((t) => t.label);
    expect(labels).toEqual(expect.arrayContaining(["PEEP", "PIP", "FiO₂", "EIT"]));
  });

  it("agrupa flexões de plural na mesma chave", () => {
    const a = extractTerms("curvas", DEFAULT_TEXT_SETTINGS)[0]!;
    const b = extractTerms("curva", DEFAULT_TEXT_SETTINGS)[0]!;
    expect(a.key).toBe(b.key);
    const c = extractTerms("ventilações", DEFAULT_TEXT_SETTINGS)[0]!;
    const d = extractTerms("ventilação", DEFAULT_TEXT_SETTINGS)[0]!;
    expect(c.key).toBe(d.key);
  });

  it("reconhece expressões compostas como um único termo", () => {
    const terms = extractTerms("O pulmão 3D e as curvas ventilatórias são ótimos", DEFAULT_TEXT_SETTINGS);
    const labels = terms.map((t) => t.label);
    expect(labels).toContain("pulmão 3D");
    expect(labels).toContain("curvas ventilatórias");
    // os tokens consumidos pela expressão não são contados de novo isoladamente
    expect(labels).not.toContain("pulmão");
  });
});

describe("nuvem de palavras", () => {
  it("diferencia ocorrências de participantes", () => {
    const cloud = buildWordCloud(
      [
        doc("a1", "p1", "As curvas são boas. Curvas claras."),
        doc("a2", "p1", "Mais curvas, por favor"),
        doc("a3", "p2", "curva confusa"),
      ],
      DEFAULT_TEXT_SETTINGS,
    );
    const curva = cloud.find((t) => t.key === extractTerms("curva", DEFAULT_TEXT_SETTINGS)[0]!.key)!;
    expect(curva.occurrences).toBe(4);
    expect(curva.participants).toBe(2);
    expect(curva.sources.map((s) => s.docId).sort()).toEqual(["a1", "a2", "a3"]);
  });

  it("nunca altera o texto original nas fontes", () => {
    const original = "  Interface CONFUSA no início!!  ";
    const cloud = buildWordCloud([doc("x", "p", original)], DEFAULT_TEXT_SETTINGS);
    expect(cloud[0]!.sources[0]!.text).toBe(original);
  });

  it("aceita stopwords e expressões adicionais configuradas", () => {
    const cloud = buildWordCloud([doc("x", "p", "modo professor excelente excelente")], {
      ...DEFAULT_TEXT_SETTINGS,
      extraStopwords: ["excelente"],
    });
    expect(cloud.map((t) => t.label)).toEqual(["modo professor"]);
  });
});

describe("temas por palavras-chave", () => {
  it("classifica comentário em temas conhecidos", () => {
    const themes = classifyThemes("Tive dificuldade para localizar o menu e o simulador travou");
    expect(themes).toEqual(expect.arrayContaining(["Navegação", "Desempenho"]));
  });
});

describe("temas — falsos positivos", () => {
  it("não confunde 'realmente' com realismo nem 'volume corrente' com interface", () => {
    expect(classifyThemes("Realmente gostei do volume corrente")).toEqual([]);
  });
});

describe("revisão: flexões e limites de frase", () => {
  it("agrupa plurais em -ses com o singular e mantém -res/-zes", () => {
    const key = (w: string) => extractTerms(w, DEFAULT_TEXT_SETTINGS)[0]!.key;
    expect(key("frases")).toBe(key("frase"));
    expect(key("análises")).toBe(key("análise"));
    expect(key("valores")).toBe(key("valor"));
    expect(key("luzes")).toBe(key("luz"));
  });

  it("expressão composta não atravessa pontuação", () => {
    const labels = extractTerms("Gostei da interface. Confusa foi a gasometria", DEFAULT_TEXT_SETTINGS).map((t) => t.label);
    expect(labels).not.toContain("interface confusa");
  });

  it("não trata propriedades herdadas como termo protegido", () => {
    expect(extractTerms("constructor", DEFAULT_TEXT_SETTINGS)[0]!.isCanonical).toBe(false);
  });
});
