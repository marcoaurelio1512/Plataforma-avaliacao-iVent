import { Check } from "lucide-react";
import { LIKERT_LABELS, LIMITS, SPECIAL_ANSWER_LABELS, scaleBounds, type AnswerInput, type QuestionDef, type SpecialAnswer } from "../../shared/domain.ts";

interface InputProps {
  question: QuestionDef;
  answer: AnswerInput;
  onChange: (next: AnswerInput) => void;
}

function SpecialButtons({ question, answer, onChange }: InputProps) {
  const specials: SpecialAnswer[] = [
    ...(question.allowNotUsed ? (["not_used"] as const) : []),
    ...(question.allowNotApplicable ? (["not_applicable"] as const) : []),
  ];
  if (!specials.length) return null;
  return (
    <div className="special-row">
      {specials.map((s) => {
        const active = answer.special === s;
        return (
          <button
            key={s}
            type="button"
            className={`special-btn${active ? " is-active" : ""}`}
            aria-pressed={active}
            onClick={() => onChange({ ...answer, special: active ? null : s, numericValue: null, choiceValues: null })}
          >
            {active && <Check aria-hidden="true" />}
            {SPECIAL_ANSWER_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

export function LikertInput(props: InputProps) {
  const { question, answer, onChange } = props;
  return (
    <div className="stack">
      <div className="likert" role="radiogroup" aria-label="Sua avaliação">
        {[1, 2, 3, 4, 5].map((v) => {
          const active = answer.numericValue === v && !answer.special;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              className={`likert-option tone-${v}${active ? " is-active" : ""}`}
              onClick={() => onChange({ ...answer, numericValue: v, special: null })}
            >
              <span className="likert-num num">{v}</span>
              <span className="likert-label">{LIKERT_LABELS[v]}</span>
            </button>
          );
        })}
      </div>
      <p className="hint hint-keyboard">Dica: no teclado, use as teclas 1 a 5.</p>
      <SpecialButtons {...props} question={question} />
    </div>
  );
}

export function NumericScaleInput(props: InputProps) {
  const { question, answer, onChange } = props;
  const { min, max } = scaleBounds(question);
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="stack">
      <div className="numeric-scale" role="radiogroup" aria-label="Sua nota">
        {points.map((v) => {
          const active = answer.numericValue === v && !answer.special;
          return (
            <button key={v} type="button" role="radio" aria-checked={active} className={`numeric-option num${active ? " is-active" : ""}`} onClick={() => onChange({ ...answer, numericValue: v, special: null })}>
              {v}
            </button>
          );
        })}
      </div>
      {(question.scaleMinLabel || question.scaleMaxLabel) && (
        <div className="row-between hint">
          <span>{min} — {question.scaleMinLabel}</span>
          <span>{max} — {question.scaleMaxLabel}</span>
        </div>
      )}
      <SpecialButtons {...props} />
    </div>
  );
}

export function ChoiceInput(props: InputProps) {
  const { question, answer, onChange } = props;
  const multiple = question.type === "multiple_choice";
  const options = question.type === "yes_no" ? [{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }] : question.options;
  const selected = answer.choiceValues ?? [];
  const toggle = (value: string) => {
    const next = multiple ? (selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]) : selected.includes(value) ? [] : [value];
    onChange({ ...answer, choiceValues: next, special: null });
  };
  return (
    <div className="stack">
      {multiple && <p className="hint">Selecione todas as opções que se aplicam.</p>}
      <div className={`choice-list${question.type === "yes_no" ? " is-binary" : ""}`} role={multiple ? "group" : "radiogroup"}>
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button key={o.value} type="button" role={multiple ? "checkbox" : "radio"} aria-checked={active} className={`choice-option${active ? " is-active" : ""}`} onClick={() => toggle(o.value)}>
              <span className={`choice-mark${multiple ? " is-square" : ""}`} aria-hidden="true">{active && <Check />}</span>
              {o.label}
            </button>
          );
        })}
      </div>
      <SpecialButtons {...props} />
    </div>
  );
}

export function TextInput({ question, answer, onChange }: InputProps) {
  const long = question.type === "long_text";
  const limit = long ? LIMITS.longText : LIMITS.shortText;
  const value = answer.textValue ?? "";
  return (
    <div className="field">
      <label htmlFor={`q-${question.id}`} className="sr-only">Sua resposta</label>
      {long ? (
        <textarea id={`q-${question.id}`} className="textarea textarea-xl" value={value} maxLength={limit} placeholder="Escreva com suas palavras…" onChange={(e) => onChange({ ...answer, textValue: e.target.value })} />
      ) : (
        <input id={`q-${question.id}`} className="input input-lg" value={value} maxLength={limit} onChange={(e) => onChange({ ...answer, textValue: e.target.value })} />
      )}
      <span className="hint num">{value.length}/{limit}</span>
    </div>
  );
}

export function CommentBox({ question, answer, onChange }: InputProps) {
  if (!question.allowComment) return null;
  return (
    <div className="field comment-box">
      <label htmlFor={`c-${question.id}`}>Comentários ou sugestões sobre este item <span className="dim">(opcional)</span></label>
      <textarea id={`c-${question.id}`} className="textarea" value={answer.comment ?? ""} maxLength={LIMITS.comment} onChange={(e) => onChange({ ...answer, comment: e.target.value })} />
    </div>
  );
}

export function QuestionInput(props: InputProps) {
  switch (props.question.type) {
    case "likert":
      return <LikertInput {...props} />;
    case "numeric_scale":
      return <NumericScaleInput {...props} />;
    case "short_text":
    case "long_text":
      return <TextInput {...props} />;
    default:
      return <ChoiceInput {...props} />;
  }
}

export function isAnswered(q: QuestionDef, a: AnswerInput | undefined): boolean {
  if (!a) return false;
  if (a.special) return true;
  if (q.type === "likert" || q.type === "numeric_scale") return a.numericValue !== null && a.numericValue !== undefined;
  if (q.type === "short_text" || q.type === "long_text") return Boolean(a.textValue?.trim());
  return Boolean(a.choiceValues?.length);
}

export function answerSummary(q: QuestionDef, a: AnswerInput | undefined): string {
  if (!a || !isAnswered(q, a)) return "Sem resposta";
  if (a.special) return SPECIAL_ANSWER_LABELS[a.special];
  if (q.type === "likert") return `${a.numericValue} — ${LIKERT_LABELS[a.numericValue!]}`;
  if (q.type === "numeric_scale") return String(a.numericValue);
  if (q.type === "short_text" || q.type === "long_text") return a.textValue!.trim();
  if (q.type === "yes_no") return a.choiceValues![0] === "yes" ? "Sim" : "Não";
  return q.options.filter((o) => a.choiceValues!.includes(o.value)).map((o) => o.label).join(", ");
}
