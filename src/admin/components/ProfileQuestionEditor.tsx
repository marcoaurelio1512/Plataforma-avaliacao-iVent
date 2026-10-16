/**
 * Edição de uma pergunta da tela de perfil (texto, tipo, obrigatória, visível
 * e opções). Usado por ProfileFormPanel para as perguntas livres e para a de
 * categoria profissional.
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { PROFILE_FIELD_TYPE_LABELS, type ProfileFieldType, type ProfileOption } from "../../../shared/profileForm.ts";

export function moved<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export const NEW_OPTION: ProfileOption = { code: "", label: "", active: true };

function OptionsEditor({ id, label, options, onChange }: { id: string; label: string; options: ProfileOption[]; onChange: (o: ProfileOption[]) => void }) {
  const set = (index: number, patch: Partial<ProfileOption>) => onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  return (
    <>
      <p className="field-label">Opções</p>
      <ol className="profile-options">
        {options.map((o, i) => (
          <li key={o.code || `new-${i}`} className={`profile-option${o.active ? "" : " is-inactive"}`}>
            <input className="input grow" aria-label={`Opção ${i + 1} de ${label}`} value={o.label} placeholder="Nome da opção" onChange={(e) => set(i, { label: e.target.value })} />
            <label className="checkbox"><input type="checkbox" checked={o.active} onChange={(e) => set(i, { active: e.target.checked })} /> ativa</label>
            <span className="row profile-option-actions">
              <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Subir ${o.label}`} disabled={i === 0} onClick={() => onChange(moved(options, i, i - 1))}><ArrowUp /></button>
              <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Descer ${o.label}`} disabled={i === options.length - 1} onClick={() => onChange(moved(options, i, i + 1))}><ArrowDown /></button>
              <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Apagar opção ${o.label || i + 1}`} onClick={() => onChange(options.filter((_, j) => j !== i))}><Trash2 /></button>
            </span>
          </li>
        ))}
      </ol>
      <div>
        <button type="button" className="btn btn-sm btn-ghost" id={`${id}-add`} onClick={() => onChange([...options, NEW_OPTION])}><Plus /> Adicionar opção</button>
      </div>
    </>
  );
}

export interface EditableQuestion {
  label: string;
  required: boolean;
  enabled: boolean;
  options: ProfileOption[];
  /** Ausente na pergunta de categoria profissional (sempre escolha única). */
  type?: ProfileFieldType;
}

interface Props<Q extends EditableQuestion> {
  id: string;
  index: number;
  question: Q;
  /** Tipo só pode mudar antes de a pergunta ser salva. */
  typeLocked: boolean;
  badge?: string;
  onChange: (q: Q) => void;
  onDelete: () => void;
  onMove?: (delta: -1 | 1) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function ProfileQuestionEditor<Q extends EditableQuestion>({ id, index, question: q, typeLocked, badge, onChange, onDelete, onMove, isFirst, isLast }: Props<Q>) {
  const isChoice = q.type !== "text";
  const title = q.label.trim() || "Nova pergunta";
  return (
    <li className={`panel profile-field${q.enabled ? "" : " is-hidden"}`} aria-labelledby={`${id}-title`}>
      <div className="row-between">
        <h3 id={`${id}-title`} className="panel-title"><span className="num dim">{index}.</span> {title}</h3>
        <span className="row profile-option-actions">
          {onMove && <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Subir pergunta ${title}`} disabled={isFirst} onClick={() => onMove(-1)}><ArrowUp /></button>}
          {onMove && <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Descer pergunta ${title}`} disabled={isLast} onClick={() => onMove(1)}><ArrowDown /></button>}
          <button type="button" className="btn btn-sm btn-ghost" onClick={onDelete}><Trash2 /> Apagar pergunta</button>
        </span>
      </div>
      {badge && <p className="panel-note">{badge}</p>}
      <div className="field">
        <label htmlFor={`${id}-label`}>Texto da pergunta</label>
        <input id={`${id}-label`} className="input" value={q.label} placeholder="Ex.: Em qual instituição você trabalha?" onChange={(e) => onChange({ ...q, label: e.target.value })} />
      </div>
      <div className="row profile-question-flags">
        {q.type && (
          <div className="field">
            <label htmlFor={`${id}-type`}>Tipo</label>
            <select id={`${id}-type`} className="select" value={q.type} disabled={typeLocked} title={typeLocked ? "O tipo não muda depois de salvo. Apague e crie outra pergunta." : undefined}
              onChange={(e) => {
                const type = e.target.value as ProfileFieldType;
                onChange({ ...q, type, options: type === "text" ? [] : q.options.length ? q.options : [NEW_OPTION] });
              }}>
              {(Object.keys(PROFILE_FIELD_TYPE_LABELS) as ProfileFieldType[]).map((t) => <option key={t} value={t}>{PROFILE_FIELD_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        )}
        <label className="checkbox"><input type="checkbox" checked={q.required} onChange={(e) => onChange({ ...q, required: e.target.checked })} /> obrigatória</label>
        <label className="checkbox"><input type="checkbox" checked={q.enabled} onChange={(e) => onChange({ ...q, enabled: e.target.checked })} /> mostrar ao participante</label>
      </div>
      {isChoice && <OptionsEditor id={id} label={title} options={q.options} onChange={(options) => onChange({ ...q, options })} />}
    </li>
  );
}
