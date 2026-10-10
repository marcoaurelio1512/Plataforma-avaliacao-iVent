import { describe, expect, it } from "vitest";
import type { QuestionDef } from "../../shared/domain.ts";
import { validateAnswers } from "./answerValidation.ts";

const base: Omit<QuestionDef, "id" | "key" | "type"> = {
  section: "quantitative",
  text: "Pergunta",
  required: true,
  allowComment: true,
  allowNotApplicable: false,
  allowNotUsed: false,
  options: [],
};
const likert: QuestionDef = { ...base, id: "00000000-0000-4000-8000-000000000001", key: "l", type: "likert", scaleMin: 1, scaleMax: 5 };
const likertNotUsed: QuestionDef = { ...likert, id: "00000000-0000-4000-8000-000000000002", key: "l2", allowNotUsed: true };
const longText: QuestionDef = { ...base, id: "00000000-0000-4000-8000-000000000003", key: "t", type: "long_text", section: "open", required: false, allowComment: false };
const choice: QuestionDef = {
  ...base,
  id: "00000000-0000-4000-8000-000000000004",
  key: "c",
  type: "multiple_choice",
  required: false,
  options: [
    { label: "A", value: "a" },
    { label: "B", value: "b" },
  ],
};
const questions = [likert, likertNotUsed, longText, choice];

describe("validateAnswers", () => {
  it("aceita respostas válidas e preserva o texto original", () => {
    const result = validateAnswers(questions, [
      { questionId: likert.id!, numericValue: 4, comment: "  Ótimo!  " },
      { questionId: likertNotUsed.id!, special: "not_used" },
      { questionId: longText.id!, textValue: "=texto livre\ncom quebra" },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]!.comment).toBe("  Ótimo!  ");
    expect(result[2]!.textValue).toBe("=texto livre\ncom quebra");
  });

  it("rejeita nota fora da escala", () => {
    expect(() => validateAnswers(questions, [{ questionId: likert.id!, numericValue: 6 }, { questionId: likertNotUsed.id!, numericValue: 3 }])).toThrow();
  });

  it("rejeita 'Não utilizei' quando a pergunta não oferece a opção", () => {
    expect(() => validateAnswers(questions, [{ questionId: likert.id!, special: "not_used" }, { questionId: likertNotUsed.id!, numericValue: 3 }])).toThrow();
  });

  it("rejeita nota e marcação especial ao mesmo tempo", () => {
    expect(() =>
      validateAnswers(questions, [{ questionId: likert.id!, numericValue: 3 }, { questionId: likertNotUsed.id!, numericValue: 3, special: "not_used" }]),
    ).toThrow();
  });

  it("exige perguntas obrigatórias", () => {
    expect(() => validateAnswers(questions, [{ questionId: likert.id!, numericValue: 3 }])).toThrow(/obrigat/i);
  });

  it("rejeita pergunta desconhecida e opção inexistente", () => {
    expect(() =>
      validateAnswers(questions, [
        { questionId: likert.id!, numericValue: 3 },
        { questionId: likertNotUsed.id!, numericValue: 3 },
        { questionId: "00000000-0000-4000-8000-0000000000ff", numericValue: 3 },
      ]),
    ).toThrow();
    expect(() =>
      validateAnswers(questions, [
        { questionId: likert.id!, numericValue: 3 },
        { questionId: likertNotUsed.id!, numericValue: 3 },
        { questionId: choice.id!, choiceValues: ["z"] },
      ]),
    ).toThrow();
  });

  it("descarta texto vazio e comentário só com espaços", () => {
    const result = validateAnswers(questions, [
      { questionId: likert.id!, numericValue: 5, comment: "   " },
      { questionId: likertNotUsed.id!, numericValue: 2 },
      { questionId: longText.id!, textValue: "   " },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!.comment).toBeNull();
  });
});
