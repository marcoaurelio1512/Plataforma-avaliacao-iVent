/**
 * Configurações → Tela de perfil: textos da etapa "Conte um pouco sobre você",
 * campos opcionais e suas opções. Opção já salva não se apaga, só se oculta
 * (respostas antigas guardam o código); renomear vale também para o histórico.
 */
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PROFILE_FIELD_KEYS, type ProfileFieldConfig, type ProfileFieldKey, type ProfileForm } from "../../../shared/profileForm.ts";
import { ErrorState, Loading } from "../../components/States.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { useAsync } from "../../lib/useAsync.ts";

const PATH = "/api/admin/profile-form";

function moved<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function FieldEditor({ id, field, onChange }: { id: ProfileFieldKey; field: ProfileFieldConfig; onChange: (f: ProfileFieldConfig) => void }) {
  const setOption = (index: number, patch: Partial<ProfileFieldConfig["options"][number]>) =>
    onChange({ ...field, options: field.options.map((o, i) => (i === index ? { ...o, ...patch } : o)) });
  const move = (from: number, to: number) => onChange({ ...field, options: moved(field.options, from, to) });
  return (
    <section className={`panel profile-field${field.enabled ? "" : " is-hidden"}`} aria-labelledby={`pf-${id}-title`}>
      <div className="row-between">
        <h3 id={`pf-${id}-title`} className="panel-title">{field.label || "Campo sem nome"}</h3>
        <label className="checkbox"><input type="checkbox" checked={field.enabled} onChange={(e) => onChange({ ...field, enabled: e.target.checked })} /> mostrar ao participante</label>
      </div>
      <div className="field">
        <label htmlFor={`pf-${id}-label`}>Pergunta exibida</label>
        <input id={`pf-${id}-label`} className="input" value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
      </div>
      <p className="field-label">Opções</p>
      <ol className="profile-options">
        {field.options.map((o, i) => (
          <li key={o.code || `new-${i}`} className={`profile-option${o.active ? "" : " is-inactive"}`}>
            <input className="input grow" aria-label={`Opção ${i + 1} de ${field.label}`} value={o.label} placeholder="Nome da opção" onChange={(e) => setOption(i, { label: e.target.value })} />
            <label className="checkbox"><input type="checkbox" checked={o.active} onChange={(e) => setOption(i, { active: e.target.checked })} /> ativa</label>
            <span className="row profile-option-actions">
              <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Subir ${o.label}`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp /></button>
              <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Descer ${o.label}`} disabled={i === field.options.length - 1} onClick={() => move(i, i + 1)}><ArrowDown /></button>
              {!o.code && (
                <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Remover ${o.label || "opção nova"}`} onClick={() => onChange({ ...field, options: field.options.filter((_, j) => j !== i) })}><Trash2 /></button>
              )}
            </span>
          </li>
        ))}
      </ol>
      <div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange({ ...field, options: [...field.options, { code: "", label: "", active: true }] })}><Plus /> Adicionar opção</button>
      </div>
    </section>
  );
}

export function ProfileFormPanel({ onDone }: { onDone: (m: string) => void }) {
  const state = useAsync((signal) => api<ProfileForm>(PATH, { signal }), []);
  // `saved` é a versão gravada; `form` é o rascunho em edição.
  const [saved, setSaved] = useState<ProfileForm | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSaved(state.data);
    setForm(state.data);
  }, [state.data]);
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState error={state.error} />;
  if (!form || !saved) return null;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = await api<ProfileForm>(PATH, { method: "PUT", body: form });
      setSaved(result);
      setForm(result);
      onDone("Tela de perfil salva — já vale para novos participantes");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="stack-lg">
      <section className="panel" aria-labelledby="pf-texts">
        <h2 id="pf-texts" className="panel-title">Textos da tela de perfil</h2>
        <p className="panel-note">Etapa que o participante vê logo depois de começar, antes das perguntas. Vale para todos os questionários.</p>
        <div className="field"><label htmlFor="pf-title">Título</label><input id="pf-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="pf-subtitle">Texto de apoio</label><textarea id="pf-subtitle" className="textarea" rows={2} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
        <div className="field">
          <label htmlFor="pf-prof">Pergunta da categoria profissional (obrigatória)</label>
          <input id="pf-prof" className="input" value={form.professionLabel} onChange={(e) => setForm({ ...form, professionLabel: e.target.value })} />
          <span className="panel-note">As opções desta pergunta ficam na aba Categorias profissionais.</span>
        </div>
      </section>
      <p className="panel-note">Os campos abaixo são opcionais para o participante. Renomear uma opção atualiza também as respostas antigas nos relatórios; para tirar uma opção do formulário, desmarque “ativa”.</p>
      {PROFILE_FIELD_KEYS.map((key) => (
        <FieldEditor key={key} id={key} field={form.fields[key]} onChange={(f) => setForm({ ...form, fields: { ...form.fields, [key]: f } })} />
      ))}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={save}><Save /> {saving ? "Salvando…" : "Salvar"}</button>
        {dirty && <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => { setForm(saved); setError(null); }}>Descartar alterações</button>}
      </div>
    </div>
  );
}
