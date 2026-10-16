/**
 * Configurações → Tela de perfil: editor completo da etapa "Conte um pouco
 * sobre você" — textos, perguntas (criar, editar, reordenar, ocultar, apagar)
 * e opções, incluindo as categorias profissionais. Apagar pergunta ou opção
 * apaga também as respostas já recebidas; o servidor devolve o impacto e o
 * administrador confirma antes.
 */
import { AlertTriangle, Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProfileField, ProfileForm } from "../../../shared/profileForm.ts";
import { ErrorState, Loading } from "../../components/States.tsx";
import { ApiError, api, errorMessage } from "../../lib/api.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { useScope } from "../scope.tsx";
import { NEW_OPTION, ProfileQuestionEditor, moved } from "./ProfileQuestionEditor.tsx";

const PATH = "/api/admin/profile-form";
const NEW_FIELD: ProfileField = { key: "", label: "", type: "single", required: false, enabled: true, options: [NEW_OPTION] };
const NEW_PROFESSION: NonNullable<ProfileForm["profession"]> = { label: "Categoria profissional", required: true, enabled: true, options: [NEW_OPTION] };

interface Impact {
  label: string;
  answers: number;
}

function impactsOf(err: unknown): Impact[] | null {
  if (!(err instanceof ApiError) || err.code !== "confirm_deletions") return null;
  return (err.details as { impacts?: Impact[] } | undefined)?.impacts ?? [];
}

function ConfirmDeletions({ impacts, saving, onConfirm, onCancel }: { impacts: Impact[]; saving: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="alert alert-warning profile-confirm" role="alertdialog" aria-labelledby="pf-confirm-title">
      <AlertTriangle />
      <div className="stack-sm grow">
        <p id="pf-confirm-title"><strong>Esta alteração apaga respostas já recebidas. Não é possível desfazer.</strong></p>
        <ul className="report-list">
          {impacts.map((i) => <li key={i.label}>{i.label}: {i.answers} {i.answers === 1 ? "participante perde a resposta" : "participantes perdem a resposta"}</li>)}
        </ul>
        <div className="row">
          <button type="button" className="btn btn-danger" disabled={saving} onClick={onConfirm}>Apagar e salvar</button>
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={onCancel}>Voltar e revisar</button>
        </div>
      </div>
    </div>
  );
}

export function ProfileFormPanel({ onDone }: { onDone: (m: string) => void }) {
  const { reloadReference } = useScope();
  const state = useAsync((signal) => api<ProfileForm>(PATH, { signal }), []);
  // `saved` é a versão gravada; `form` é o rascunho em edição.
  const [saved, setSaved] = useState<ProfileForm | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [impacts, setImpacts] = useState<Impact[] | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSaved(state.data);
    setForm(state.data);
  }, [state.data]);
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState error={state.error} />;
  if (!form || !saved) return null;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const savedKeys = new Set(saved.fields.map((f) => f.key));
  const setField = (index: number, next: ProfileField) => setForm({ ...form, fields: form.fields.map((f, i) => (i === index ? next : f)) });
  const offset = form.profession ? 1 : 0;

  const save = async (confirmDeletions = false) => {
    setError(null);
    setSaving(true);
    try {
      const result = await api<ProfileForm>(PATH, { method: "PUT", body: { ...form, confirmDeletions } });
      setSaved(result);
      setForm(result);
      setImpacts(null);
      reloadReference();
      onDone("Tela de perfil salva — já vale para novos participantes");
    } catch (err) {
      const found = impactsOf(err);
      if (found) setImpacts(found);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-lg">
      <section className="panel" aria-labelledby="pf-texts">
        <h2 id="pf-texts" className="panel-title">Textos da tela de perfil</h2>
        <p className="panel-note">Etapa que o participante vê logo depois de começar, antes das perguntas do questionário. Vale para todos os questionários.</p>
        <div className="field"><label htmlFor="pf-title">Título</label><input id="pf-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="pf-subtitle">Texto de apoio</label><textarea id="pf-subtitle" className="textarea" rows={2} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
      </section>

      <section className="stack-sm" aria-labelledby="pf-questions">
        <h2 id="pf-questions" className="panel-title">Perguntas</h2>
        <p className="panel-note">Renomear atualiza também as respostas antigas nos relatórios. Para tirar algo do formulário sem perder dados, desmarque “mostrar ao participante” ou “ativa”. <strong>Apagar remove também as respostas já recebidas.</strong></p>
      </section>
      <ol className="profile-questions">
        {form.profession && (
          <ProfileQuestionEditor
            id="pf-profession"
            index={1}
            question={form.profession}
            typeLocked
            badge="Categoria profissional: usada nos filtros, na comparação entre grupos e nos indicadores do dashboard."
            onChange={(profession) => setForm({ ...form, profession })}
            onDelete={() => setForm({ ...form, profession: null })}
          />
        )}
        {form.fields.map((field, i) => (
          <ProfileQuestionEditor
            key={field.key || `new-${i}`}
            id={`pf-${field.key || `new-${i}`}`}
            index={i + 1 + offset}
            question={field}
            typeLocked={savedKeys.has(field.key)}
            onChange={(next) => setField(i, next)}
            onDelete={() => setForm({ ...form, fields: form.fields.filter((_, j) => j !== i) })}
            onMove={(delta) => setForm({ ...form, fields: moved(form.fields, i, i + delta) })}
            isFirst={i === 0}
            isLast={i === form.fields.length - 1}
          />
        ))}
      </ol>
      <div className="row">
        <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, fields: [...form.fields, NEW_FIELD] })}><Plus /> Adicionar pergunta</button>
        {!form.profession && (
          <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, profession: NEW_PROFESSION })}><Plus /> Adicionar pergunta de categoria profissional</button>
        )}
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {impacts && <ConfirmDeletions impacts={impacts} saving={saving} onConfirm={() => save(true)} onCancel={() => setImpacts(null)} />}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!dirty || saving || Boolean(impacts)} onClick={() => save()}><Save /> {saving ? "Salvando…" : "Salvar"}</button>
        {dirty && <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => { setForm(saved); setError(null); setImpacts(null); }}>Descartar alterações</button>}
      </div>
    </div>
  );
}
