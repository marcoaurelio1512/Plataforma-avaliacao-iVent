import { describe, expect, it } from "vitest";
import { describeScale, mean, median, sampleStdDev, compareGroups } from "./stats.ts";

describe("estatística descritiva", () => {
  it("calcula média, mediana e desvio-padrão amostral", () => {
    const values = [1, 2, 3, 4, 5];
    expect(mean(values)).toBe(3);
    expect(median(values)).toBe(3);
    // DP amostral (n−1) de 1..5 = √2,5
    expect(sampleStdDev(values)).toBeCloseTo(Math.sqrt(2.5), 10);
  });

  it("mediana de quantidade par usa a média dos dois centrais", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("devolve null quando não há dados suficientes", () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
    expect(sampleStdDev([4])).toBeNull();
  });
});

describe("describeScale", () => {
  it("exclui 'Não utilizei' e 'Não se aplica' da média e conta separadamente", () => {
    const result = describeScale(
      [
        { value: 5 },
        { value: 4 },
        { special: "not_used" },
        { special: "not_used" },
        { special: "not_applicable" },
        { value: 3 },
      ],
      { min: 1, max: 5, totalResponses: 7 },
    );
    expect(result.validN).toBe(3);
    expect(result.mean).toBe(4);
    expect(result.notUsed).toBe(2);
    expect(result.notApplicable).toBe(1);
    // 7 respostas no total, 6 registradas → 1 ausente
    expect(result.missing).toBe(1);
  });

  it("frequência relativa usa apenas respostas válidas", () => {
    const result = describeScale([{ value: 5 }, { value: 5 }, { value: 1 }, { special: "not_used" }], {
      min: 1,
      max: 5,
      totalResponses: 4,
    });
    const five = result.frequencies.find((f) => f.value === 5)!;
    expect(five.count).toBe(2);
    expect(five.relative).toBeCloseTo(2 / 3, 10);
    expect(result.frequencies).toHaveLength(5);
    expect(result.frequencies.find((f) => f.value === 3)!.count).toBe(0);
  });

  it("nunca transforma 'Não utilizei' em zero", () => {
    const result = describeScale([{ special: "not_used" }, { special: "not_used" }], {
      min: 1,
      max: 5,
      totalResponses: 2,
    });
    expect(result.mean).toBeNull();
    expect(result.validN).toBe(0);
  });
});

describe("compareGroups", () => {
  it("relata diferença descritiva sem afirmar significância", () => {
    const result = compareGroups([5, 4, 5], [3, 3, 4]);
    expect(result.meanDifference).toBeCloseTo(14 / 3 - 10 / 3, 10);
    expect(result.note).toMatch(/descritiv/i);
  });

  it("indica dados insuficientes quando um grupo está vazio", () => {
    const result = compareGroups([5, 4], []);
    expect(result.meanDifference).toBeNull();
  });
});
