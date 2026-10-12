import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Copy, GripVertical, Plus, Trash2, X } from "lucide-react";
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, isQuantitative, isTextType, type QuestionDef, type QuestionType } from "../../../shared/domain.ts";

export interface EditableQuestion extends QuestionDef {
  uid: string;
}

export function newUid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function blankQuestion(type: QuestionType): EditableQuestion {
  const text = isTextType(type);
  const choice = type === "single_choice" || type === "multiple_choice";
  return {
    uid: newUid(),
    key: "",
    section: text ? "open" : "quantitative",
    type,
    text: "",
    helpText: null,
    category: null,
    required: !text,
    allowComment: type === "likert",
    allowNotApplicable: false,
    allowNotUsed: false,
    scaleMin: type === "numeric_scale" ? 0 : type === "likert" ? 1 : null,
    scaleMax: type === "numeric_scale" ? 10 : type === "likert" ? 5 : null,
    scaleMinLabel: type === "likert" ? "Discordo totalmente" : null,
    scaleMaxLabel: type === "likert" ? "Concordo totalmente" : null,
    options: choice ? [{ label: "Opção 1", value: "" }, { label: "Opção 2", value: "" }] : [],
  };
}

/** Ao trocar o tipo, mantém o texto e ajusta só o que o novo tipo exige. */
export function changeType(q: EditableQuestion, type: QuestionType): EditableQuestion {
  const fresh = blankQuestion(type);
  return { ...fresh, uid: q.uid, key: q.key, text: q.text, helpText: q.helpText, category: q.category, options: fresh.options.length && q.options.length >= 2 ? q.options : fresh.options };
}

interface Props {
  index: number;
  total: number;
  question: EditableQuestion;
  expanded: boolean;
  onToggle: () => void;
  onChange: (q: EditableQuestion) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
  locked: boolean;
}

export function QuestionEditor({ index, total, question: q, expanded, onToggle, onChange, onRemove, onDuplicate, onMove, locked }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: q.uid });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const set = <K extends keyof EditableQuestion>(k: K, v: EditableQuestion[K]) => onChange({ ...q, [k]: v });
  const quantitative = isQuantitative(q.type) || q.type === "yes_no" || q.type === "single_choice" || q.type === "multiple_choice";
  const choice = q.type === "single_choice" || q.type === "multiple_choice";

  return (
    <li ref={setNodeRef} style={style} className={`q-card${isDragging ? " is-dragging" : ""}${expanded ? " is-expanded" : ""}`}>
      <div className="q-head">
        <button type="button" className="q-handle" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Arrastar pergunta ${index + 1}`}>
          <GripVertical />
        </button>
        <span className="q-index num">{index + 1}</span>
        <button type="button" className="q-summary" onClick={onToggle} aria-expanded={expanded}>
          <span className="row">
            <span className={`badge ${q.section === "open" ? "badge-ok" : "badge-accent"}`}>{q.section === "open" ? "Aberta" : "Quantitativa"}</span>
            <span className="badge">{QUESTION_TYPE_LABELS[q.type]}</span>
            {q.required && <span className="badge badge-warning">Obrigatória</span>}
            {q.allowNotUsed && <span className="badge">Não utilizei</span>}
            {q.allowNotApplicable && <span className="badge">Não se aplica</span>}
            {q.allowComment && <span className="badge">Comentário</span>}
          </span>
          <span className={`q-text${q.text ? "" : " dim"}`}>{q.text || "Pergunta sem texto"}</span>
          {!expanded && q.helpText && <span className="q-help dim">{q.helpText}</span>}
        </button>
        <div className="q-tools">
          <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Mover para cima"><ChevronUp /></button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Mover para baixo"><ChevronDown /></button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onDuplicate} aria-label="Duplicar pergunta"><Copy /></button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm btn-danger" onClick={onRemove} aria-label="Excluir pergunta"><Trash2 /></button>
        </div>
      </div>
      {expanded && (
        <div className="q-body">
          <div className="field">
            <label htmlFor={`qt-${q.uid}`}>Texto da pergunta</label>
            <textarea id={`qt-${q.uid}`} className="textarea q-autosize" rows={3} value={q.text} onChange={(e) => set("text", e.target.value)} />
          </div>
          <div className="q-grid">
            <div className="field">
              <label htmlFor={`qy-${q.uid}`}>Tipo</label>
              <select id={`qy-${q.uid}`} className="select" value={q.type} onChange={(e) => onChange(changeType(q, e.target.value as QuestionType))}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`qs-${q.uid}`}>Seção</label>
              <select id={`qs-${q.uid}`} className="select" value={q.section} onChange={(e) => set("section", e.target.value as EditableQuestion["section"])}>
                <option value="quantitative">Avaliação (quantitativa)</option>
                <option value="open">Sua opinião (aberta)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`qc-${q.uid}`}>Categoria</label>
              <input id={`qc-${q.uid}`} className="input" value={q.category ?? ""} placeholder="Ex.: Interface" onChange={(e) => set("category", e.target.value || null)} />
            </div>
            <div className="field">
              <label htmlFor={`qk-${q.uid}`}>Chave estável</label>
              <input id={`qk-${q.uid}`} className="input num" value={q.key} placeholder="gerada automaticamente" disabled={locked && Boolean(q.id)} onChange={(e) => set("key", e.target.value.replace(/[^A-Za-z0-9_-]/g, "_"))} />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`qh-${q.uid}`}>Texto de apoio <span className="dim">(opcional)</span></label>
            <input id={`qh-${q.uid}`} className="input" value={q.helpText ?? ""} onChange={(e) => set("helpText", e.target.value || null)} />
          </div>
          {q.type === "numeric_scale" && (
            <div className="q-grid">
              <div className="field">
                <label htmlFor={`qmin-${q.uid}`}>Mínimo</label>
                <input id={`qmin-${q.uid}`} type="number" className="input" value={q.scaleMin ?? 0} onChange={(e) => set("scaleMin", Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor={`qmax-${q.uid}`}>Máximo</label>
                <input id={`qmax-${q.uid}`} type="number" className="input" value={q.scaleMax ?? 10} onChange={(e) => set("scaleMax", Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor={`qminl-${q.uid}`}>Rótulo do mínimo</label>
                <input id={`qminl-${q.uid}`} className="input" value={q.scaleMinLabel ?? ""} onChange={(e) => set("scaleMinLabel", e.target.value || null)} />
              </div>
              <div className="field">
                <label htmlFor={`qmaxl-${q.uid}`}>Rótulo do máximo</label>
                <input id={`qmaxl-${q.uid}`} className="input" value={q.scaleMaxLabel ?? ""} onChange={(e) => set("scaleMaxLabel", e.target.value || null)} />
              </div>
            </div>
          )}
          {choice && (
            <div className="stack-sm">
              <p className="field-label">Opções</p>
              {q.options.map((o, i) => (
                <div key={i} className="row option-row">
                  <input className="input grow" aria-label={`Opção ${i + 1}`} value={o.label} onChange={(e) => set("options", q.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Remover opção" disabled={q.options.length <= 2} onClick={() => set("options", q.options.filter((_, j) => j !== i))}><X /></button>
                </div>
              ))}
              <div>
                <button type="button" className="btn btn-sm" onClick={() => set("options", [...q.options, { label: `Opção ${q.options.length + 1}`, value: "" }])}><Plus /> Adicionar opção</button>
              </div>
            </div>
          )}
          <div className="row q-flags">
            <label className="checkbox"><input type="checkbox" checked={q.required} onChange={(e) => set("required", e.target.checked)} /> Obrigatória</label>
            {quantitative && (
              <>
                <label className="checkbox"><input type="checkbox" checked={q.allowComment} onChange={(e) => set("allowComment", e.target.checked)} /> Campo “Comentários ou sugestões sobre este item”</label>
                <label className="checkbox"><input type="checkbox" checked={q.allowNotUsed} onChange={(e) => set("allowNotUsed", e.target.checked)} /> Opção “Não utilizei este recurso”</label>
                <label className="checkbox"><input type="checkbox" checked={q.allowNotApplicable} onChange={(e) => set("allowNotApplicable", e.target.checked)} /> Opção “Não se aplica”</label>
              </>
            )}
          </div>
          {(q.allowNotUsed || q.allowNotApplicable) && <p className="panel-note">“Não utilizei” e “Não se aplica” ficam fora de médias e medianas e são contados à parte.</p>}
        </div>
      )}
    </li>
  );
}
