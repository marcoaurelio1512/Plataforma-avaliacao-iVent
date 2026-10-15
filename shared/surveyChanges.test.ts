import { describe, expect, it } from "vitest";
import { isStructuralChange, type ComparableQuestion } from "./surveyChanges.ts";

const likert = (key: string): ComparableQuestion & { text: string } => ({
  key,
  text: `Pergunta ${key}`,
  type: "likert",
  section: "quantitative",
  scaleMin: 1,
  scaleMax: 5,
  required: true,
  allowComment: true,
  allowNotApplicable: false,
  allowNotUsed: false,
  options: [],
});

const choice: ComparableQuestion = {
  key: "recursos",
  type: "multiple_choice",
  section: "quantitative",
  scaleMin: null,
  scaleMax: null,
  required: false,
  allowComment: false,
  allowNotApplicable: false,
  allowNotUsed: false,
  options: [
    { label: "Curvas", value: "op1" },
    { label: "EIT", value: "op2" },
  ],
};

const base = [likert("a"), likert("b"), choice];

describe("isStructuralChange", () => {
  it("returns false when only wording, option labels and order change", () => {
    const after = [
      { ...choice, options: [{ label: "Curvas e loops", value: "op1" }, { label: "Tomografia (EIT)", value: "op2" }] },
      { ...likert("b"), text: "Texto corrigido" },
      likert("a"),
    ];
    expect(isStructuralChange(base, after)).toBe(false);
  });

  it("returns true when a question is added or removed", () => {
    expect(isStructuralChange(base, [...base, likert("c")])).toBe(true);
    expect(isStructuralChange(base, base.slice(0, 2))).toBe(true);
  });

  it("returns true when a new question has no key yet", () => {
    expect(isStructuralChange(base, [likert("a"), { ...likert("b"), key: "" }, choice])).toBe(true);
  });

  it("returns true when type, scale or flags change", () => {
    expect(isStructuralChange(base, [{ ...likert("a"), type: "numeric_scale", scaleMin: 0, scaleMax: 10 }, likert("b"), choice])).toBe(true);
    expect(isStructuralChange(base, [{ ...likert("a"), allowNotUsed: true }, likert("b"), choice])).toBe(true);
    expect(isStructuralChange(base, [{ ...likert("a"), required: false }, likert("b"), choice])).toBe(true);
  });

  it("returns true when choice options are added, removed or get a new value", () => {
    expect(isStructuralChange(base, [likert("a"), likert("b"), { ...choice, options: [...choice.options, { label: "Nova", value: "" }] }])).toBe(true);
    expect(isStructuralChange(base, [likert("a"), likert("b"), { ...choice, options: choice.options.slice(0, 1) }])).toBe(true);
  });

  it("ignores scale bounds sent for likert, which are always 1–5", () => {
    expect(isStructuralChange(base, [{ ...likert("a"), scaleMin: null, scaleMax: null }, likert("b"), choice])).toBe(false);
  });

  it("returns true when keys are duplicated", () => {
    expect(isStructuralChange(base, [likert("a"), likert("a"), choice])).toBe(true);
  });
});
