import { describe, expect, it } from "vitest";
import { neutralizeFormula, safeCell, toCsv } from "./spreadsheetSafe.ts";
import { computePriority } from "./themes.ts";

describe("proteção contra formula injection", () => {
  it.each(["=HYPERLINK(\"x\")", "+1+1", "-2", "@SUM(A1)", "\tcmd"])("neutraliza %s", (input) => {
    expect(neutralizeFormula(input).startsWith("'")).toBe(true);
  });

  it("não altera texto comum nem números", () => {
    expect(neutralizeFormula("Gostei das curvas")).toBe("Gostei das curvas");
    expect(safeCell(4)).toBe(4);
  });

  it("gera CSV com aspas, BOM e campos perigosos neutralizados", () => {
    const csv = toCsv(["a", "b"], [["=cmd()", 'texto, com "aspas"']]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'=cmd()");
    expect(csv).toContain('"texto, com ""aspas"""');
  });
});

describe("prioridade de melhorias", () => {
  it("nota baixa e muitas menções → Alta", () => {
    const r = computePriority({ theme: "Navegação", mean: 2.8, scaleMin: 1, scaleMax: 5, participantsMentioning: 8, participantsWithText: 16 });
    expect(r.level).toBe("Alta");
  });

  it("nota alta e poucas menções → Baixa", () => {
    const r = computePriority({ theme: "Interface", mean: 4.8, scaleMin: 1, scaleMax: 5, participantsMentioning: 1, participantsWithText: 20 });
    expect(r.level).toBe("Baixa");
  });

  it("sem nota associada usa apenas o volume de menções", () => {
    const r = computePriority({ theme: "Novas funcionalidades", mean: null, scaleMin: 1, scaleMax: 5, participantsMentioning: 10, participantsWithText: 10 });
    expect(r.deficit).toBeNull();
    expect(r.score).toBeCloseTo(0.5, 10);
  });
});
