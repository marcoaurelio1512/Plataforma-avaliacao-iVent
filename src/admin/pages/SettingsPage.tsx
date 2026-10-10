import { Plus, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ErrorState, Loading } from "../../components/States.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { date, dateTime } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { useToast } from "../components/useToast.tsx";
import { useScope } from "../scope.tsx";
import type { IventVersion, Profession } from "../types.ts";

type Tab = "versions" | "professions" | "text" | "security" | "audit";
const TABS: { id: Tab; label: string }[] = [
  { id: "versions", label: "Versões do iVent" },
  { id: "professions", label: "Categorias profissionais" },
  { id: "text", label: "Análise textual" },
  { id: "security", label: "Segurança" },
  { id: "audit", label: "Auditoria" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("versions");
  const toast = useToast();
  return (
    <>
      <PageHeader eyebrow="Sistema" title="Configurações" />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === "versions" && <VersionsTab onDone={toast.show} />}
      {tab === "professions" && <ProfessionsTab onDone={toast.show} />}
      {tab === "text" && <TextTab onDone={toast.show} />}
      {tab === "security" && <SecurityTab onDone={toast.show} />}
      {tab === "audit" && <AuditTab />}
      {toast.node}
    </>
  );
}

function VersionsTab({ onDone }: { onDone: (m: string) => void }) {
  const { iventVersions, reloadReference } = useScope();
  const [form, setForm] = useState({ label: "", releasedAt: "", notes: "" });
  const [editing, setEditing] = useState<IventVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const body = { label: form.label, releasedAt: form.releasedAt || null, notes: form.notes };
      if (editing) await api(`/api/admin/ivent-versions/${editing.id}`, { method: "PUT", body });
      else await api("/api/admin/ivent-versions", { method: "POST", body });
      setForm({ label: "", releasedAt: "", notes: "" });
      setEditing(null);
      reloadReference();
      onDone("Versão salva");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <div className="split">
      <section className="panel">
        <h2 className="panel-title">Versões cadastradas</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Versão</th><th>Lançamento</th><th className="num">Pesquisas</th><th className="num">Respostas</th><th /></tr></thead>
            <tbody>
              {iventVersions.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.label}</strong>{v.notes && <div className="dim clamp-2">{v.notes}</div>}</td>
                  <td>{date(v.releasedAt)}</td>
                  <td className="num">{v.surveys}</td>
                  <td className="num">{v.responses}</td>
                  <td><button type="button" className="btn btn-sm btn-ghost" onClick={() => { setEditing(v); setForm({ label: v.label, releasedAt: v.releasedAt ?? "", notes: v.notes }); }}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form className="panel" onSubmit={submit}>
        <h2 className="panel-title">{editing ? `Editar ${editing.label}` : "Nova versão"}</h2>
        <div className="field"><label htmlFor="iv-label">Nome</label><input id="iv-label" className="input" required placeholder="iVent 2.0" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
        <div className="field"><label htmlFor="iv-date">Data de lançamento</label><input id="iv-date" type="date" className="input" value={form.releasedAt} onChange={(e) => setForm({ ...form, releasedAt: e.target.value })} /></div>
        <div className="field"><label htmlFor="iv-notes">Notas (o que mudou)</label><textarea id="iv-notes" className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="row">
          <button type="submit" className="btn btn-primary"><Save /> Salvar</button>
          {editing && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setForm({ label: "", releasedAt: "", notes: "" }); }}>Cancelar</button>}
        </div>
        <p className="panel-note">A ordem cronológica usa a data de lançamento. Associe a versão a uma pesquisa no editor do questionário.</p>
      </form>
    </div>
  );
}

function ProfessionsTab({ onDone }: { onDone: (m: string) => void }) {
  const { reloadReference } = useScope();
  const state = useAsync((signal) => api<Profession[]>("/api/admin/professions", { signal }), []);
  const [form, setForm] = useState({ code: "", label: "" });
  const [error, setError] = useState<string | null>(null);
  const save = async (p: Profession, patch: Partial<Profession>) => {
    setError(null);
    try {
      const next = { ...p, ...patch };
      await api(`/api/admin/professions/${p.code}`, { method: "PUT", body: { label: next.label, position: next.position, active: next.active } });
      state.reload();
      reloadReference();
      onDone("Categoria atualizada");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/admin/professions", { method: "POST", body: { code: form.code, label: form.label, position: (state.data?.length ?? 0) + 1, active: true } });
      setForm({ code: "", label: "" });
      state.reload();
      reloadReference();
      onDone("Categoria criada");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  if (state.loading) return <Loading />;
  return (
    <div className="split">
      <section className="panel">
        <h2 className="panel-title">Categorias</h2>
        <p className="panel-note">Inativar remove a opção do formulário, sem apagar respostas já recebidas.</p>
        <ul className="dist-list">
          {state.data?.map((p) => (
            <li key={p.code} className="row-between profession-row">
              <ProfessionLabel profession={p} onSave={(label) => save(p, { label })} />
              <span className="dim num">{p.participants} part.</span>
              <label className="checkbox"><input type="checkbox" checked={p.active} onChange={(e) => save(p, { active: e.target.checked })} /> ativa</label>
            </li>
          ))}
        </ul>
      </section>
      <form className="panel" onSubmit={add}>
        <h2 className="panel-title">Nova categoria</h2>
        <div className="field"><label htmlFor="p-label">Nome exibido</label><input id="p-label" className="input" required value={form.label} placeholder="Enfermeiro(a)" onChange={(e) => setForm({ label: e.target.value, code: form.code || e.target.value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) })} /></div>
        <div className="field"><label htmlFor="p-code">Código (permanente)</label><input id="p-code" className="input num" required pattern="[a-z0-9_]{2,60}" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary"><Plus /> Adicionar</button>
      </form>
    </div>
  );
}

function ProfessionLabel({ profession, onSave }: { profession: Profession; onSave: (label: string) => void }) {
  const [value, setValue] = useState(profession.label);
  useEffect(() => setValue(profession.label), [profession.label]);
  return (
    <input className="input grow" aria-label={`Nome de ${profession.code}`} value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => value.trim() && value !== profession.label && onSave(value.trim())} />
  );
}

interface SettingsData { textSettings: { extraStopwords: string[]; extraPhrases: string[]; extraProtected: string[] }; defaults: { phrases: string[]; protectedTerms: string[]; stopwordCount: number }; ai: { configured: boolean; provider?: string; model?: string } }

function TextTab({ onDone }: { onDone: (m: string) => void }) {
  const state = useAsync((signal) => api<SettingsData>("/api/admin/settings", { signal }), []);
  const [values, setValues] = useState({ extraStopwords: "", extraPhrases: "", extraProtected: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!state.data) return;
    const t = state.data.textSettings;
    setValues({ extraStopwords: t.extraStopwords.join("\n"), extraPhrases: t.extraPhrases.join("\n"), extraProtected: t.extraProtected.join("\n") });
  }, [state.data]);
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState error={state.error} />;
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
  const save = async () => {
    setError(null);
    try {
      await api("/api/admin/settings/text", { method: "PUT", body: { extraStopwords: lines(values.extraStopwords), extraPhrases: lines(values.extraPhrases), extraProtected: lines(values.extraProtected) } });
      onDone("Configurações da análise textual salvas — a nuvem será recalculada");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const d = state.data!.defaults;
  return (
    <section className="panel">
      <h2 className="panel-title">Vocabulário da nuvem de palavras</h2>
      <p className="muted">Um item por linha. O texto original nunca é alterado; estas regras valem só para o agrupamento e a contagem.</p>
      <div className="q-grid">
        <div className="field"><label htmlFor="t-stop">Stopwords adicionais</label><textarea id="t-stop" className="textarea" rows={8} value={values.extraStopwords} onChange={(e) => setValues({ ...values, extraStopwords: e.target.value })} /><span className="panel-note">{d.stopwordCount} stopwords padrão em português, além de “ivent” e “neoped”.</span></div>
        <div className="field"><label htmlFor="t-phr">Expressões compostas adicionais</label><textarea id="t-phr" className="textarea" rows={8} value={values.extraPhrases} onChange={(e) => setValues({ ...values, extraPhrases: e.target.value })} /><span className="panel-note">Padrão: {d.phrases.join(", ")}.</span></div>
        <div className="field"><label htmlFor="t-prot">Termos técnicos protegidos adicionais</label><textarea id="t-prot" className="textarea" rows={8} value={values.extraProtected} onChange={(e) => setValues({ ...values, extraProtected: e.target.value })} /><span className="panel-note">Padrão: {d.protectedTerms.join(", ")}.</span></div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div><button type="button" className="btn btn-primary" onClick={save}><Save /> Salvar</button></div>
      <p className="panel-note">IA: {state.data!.ai.configured ? `configurada (${state.data!.ai.provider}, ${state.data!.ai.model})` : "não configurada"}.</p>
    </section>
  );
}

function SecurityTab({ onDone }: { onDone: (m: string) => void }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) {
      setError("A confirmação não confere.");
      return;
    }
    try {
      await api("/api/auth/password", { method: "POST", body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      onDone("Senha alterada; outras sessões foram encerradas");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <form className="panel narrow-panel" onSubmit={submit}>
      <h2 className="panel-title">Alterar senha</h2>
      <div className="field"><label htmlFor="pw-cur">Senha atual</label><input id="pw-cur" type="password" className="input" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></div>
      <div className="field"><label htmlFor="pw-new">Nova senha</label><input id="pw-new" type="password" className="input" autoComplete="new-password" required minLength={10} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /><span className="panel-note">Mínimo de 10 caracteres, com letras e números.</span></div>
      <div className="field"><label htmlFor="pw-conf">Confirmar nova senha</label><input id="pw-conf" type="password" className="input" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></div>
      {error && <div className="alert alert-error">{error}</div>}
      <div><button type="submit" className="btn btn-primary"><Save /> Alterar senha</button></div>
    </form>
  );
}

function AuditTab() {
  const state = useAsync((signal) => api<{ id: number; action: string; entity: string | null; entityId: string | null; createdAt: string; adminEmail: string | null }[]>("/api/admin/audit", { signal }), []);
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState error={state.error} />;
  return (
    <div className="table-wrap">
      <table className="table table-compact">
        <thead><tr><th>Quando</th><th>Ação</th><th>Entidade</th><th>Administrador</th></tr></thead>
        <tbody>
          {state.data!.map((l) => (
            <tr key={l.id}><td>{dateTime(l.createdAt)}</td><td className="num">{l.action}</td><td className="dim">{l.entity ?? "—"}</td><td>{l.adminEmail ?? "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
