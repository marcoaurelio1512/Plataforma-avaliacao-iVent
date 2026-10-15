/**
 * Configurações → Usuários (só administradores): cadastro com senha provisória,
 * perfil, ativação e redefinição de senha. O servidor impede alterar o próprio
 * perfil ou desativar o próprio acesso; aqui esses controles ficam desabilitados.
 */
import { Copy, KeyRound, Save, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { USER_ROLE_LABELS, USER_ROLES, type UserRole } from "../../../shared/domain.ts";
import { ErrorState, Loading } from "../../components/States.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { dateTime } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { useSession } from "../session.tsx";

interface PanelUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

const ROLE_HELP: Record<UserRole, string> = {
  admin: "Acesso total: questionários, convites, configurações e usuários.",
  researcher: "Consulta e analisa os dados e baixa relatórios; não altera pesquisas nem configurações.",
};

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const GENERATED_LENGTH = 12;

/** Senha provisória forte e legível (sem 0/O, 1/l), sempre com letras e números. */
function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(GENERATED_LENGTH));
  const password = Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
  return /\d/.test(password) && /[A-Za-z]/.test(password) ? password : generatePassword();
}

const EMPTY_FORM = { name: "", email: "", role: "researcher" as UserRole, password: "" };

export function UsersPanel({ onDone }: { onDone: (m: string) => void }) {
  const { user: me } = useSession();
  const state = useAsync((signal) => api<PanelUser[]>("/api/admin/users", { signal }), []);
  const [editing, setEditing] = useState<PanelUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  /** Senha provisória recém-definida, mostrada uma única vez para ser entregue à pessoa. */
  const [handoff, setHandoff] = useState<{ email: string; password: string } | null>(null);

  const startEdit = (u: PanelUser) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role, password: "" });
    setError(null);
    setHandoff(null);
  };

  const clearForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const run = async (action: () => Promise<unknown>, message: string): Promise<boolean> => {
    setError(null);
    try {
      await action();
      state.reload();
      onDone(message);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      const body = editing.id === me.id ? { name: form.name } : { name: form.name, role: form.role };
      if (await run(() => api(`/api/admin/users/${editing.id}`, { method: "PATCH", body }), "Usuário atualizado")) clearForm();
      return;
    }
    const created = { email: form.email.trim(), password: form.password };
    if (await run(() => api("/api/admin/users", { method: "POST", body: form }), "Usuário cadastrado")) {
      clearForm();
      setHandoff(created);
    }
  };

  const resetPassword = async () => {
    if (!editing) return;
    if (!window.confirm(`Gerar uma nova senha provisória para ${editing.email}? As sessões abertas dessa pessoa serão encerradas.`)) return;
    const password = generatePassword();
    const email = editing.email;
    if (await run(() => api(`/api/admin/users/${editing.id}/password`, { method: "POST", body: { password } }), "Senha provisória redefinida")) {
      clearForm();
      setHandoff({ email, password });
    }
  };

  const toggleActive = (u: PanelUser) => {
    if (u.active && !window.confirm(`Desativar o acesso de ${u.email}? A pessoa sai imediatamente e não consegue mais entrar.`)) return;
    void run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }), u.active ? "Acesso desativado" : "Acesso reativado");
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  const users = state.data ?? [];
  const isSelf = editing?.id === me.id;

  return (
    <div className="split split-list-first">
      <section className="panel">
        <h2 className="panel-title">Usuários com acesso</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Usuário</th><th>Perfil</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name || "—"}</strong>{u.id === me.id && <span className="dim"> (você)</span>}
                    <div className="dim">{u.email}</div>
                  </td>
                  <td><span className={`badge${u.role === "admin" ? " badge-accent" : ""}`}>{USER_ROLE_LABELS[u.role]}</span></td>
                  <td>
                    {u.active ? <span className="badge badge-ok">Ativo</span> : <span className="badge">Inativo</span>}
                    <div className="dim">
                      {u.active && u.mustChangePassword ? "Aguardando primeiro acesso" : u.lastLoginAt ? `Último acesso ${dateTime(u.lastLoginAt)}` : "Nunca acessou"}
                    </div>
                  </td>
                  <td>
                    <div className="row">
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => startEdit(u)} aria-label={`Editar ${u.email}`}>Editar</button>
                      {u.id !== me.id && (
                        <button type="button" className={`btn btn-sm btn-ghost${u.active ? " btn-danger" : ""}`} onClick={() => toggleActive(u)} aria-label={`${u.active ? "Desativar" : "Reativar"} ${u.email}`}>
                          {u.active ? "Desativar" : "Reativar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-note">Desativar encerra as sessões da pessoa na hora, sem apagar o histórico da auditoria.</p>
      </section>

      <form className="panel" onSubmit={submit}>
        <h2 className="panel-title">{editing ? `Editar ${editing.name || editing.email}` : "Novo usuário"}</h2>
        {handoff && (
          <div className="alert alert-info" role="status">
            <KeyRound />
            <div className="stack-sm">
              <span>Senha provisória de <b>{handoff.email}</b> — anote e entregue à pessoa. Ela não será exibida de novo.</span>
              <div className="row">
                <code className="num">{handoff.password}</code>
                <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard.writeText(handoff.password).then(() => onDone("Senha copiada"), () => onDone("Não foi possível copiar; anote a senha"))}><Copy /> Copiar</button>
              </div>
            </div>
          </div>
        )}
        <div className="field"><label htmlFor="u-name">Nome</label><input id="u-name" className="input" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field">
          <label htmlFor="u-email">E-mail</label>
          <input id="u-email" type="email" className="input" required disabled={Boolean(editing)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {editing && <span className="panel-note">O e-mail é o login e não pode ser alterado.</span>}
        </div>
        <div className="field">
          <label htmlFor="u-role">Perfil</label>
          <select id="u-role" className="select" disabled={isSelf} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            {USER_ROLES.map((r) => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
          </select>
          <span className="panel-note">{isSelf ? "Você não pode alterar o próprio perfil." : ROLE_HELP[form.role]}</span>
        </div>
        {!editing && (
          <div className="field">
            <label htmlFor="u-pass">Senha provisória</label>
            <div className="row">
              <input id="u-pass" className="input grow num" required minLength={10} autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="btn" onClick={() => setForm({ ...form, password: generatePassword() })}>Gerar</button>
            </div>
            <span className="panel-note">Mínimo de 10 caracteres, com letras e números. No primeiro acesso a pessoa cria uma senha própria.</span>
          </div>
        )}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="row">
          <button type="submit" className="btn btn-primary">{editing ? <><Save /> Salvar</> : <><UserPlus /> Cadastrar</>}</button>
          {editing && !isSelf && <button type="button" className="btn" onClick={() => void resetPassword()}><KeyRound /> Redefinir senha</button>}
          {editing && <button type="button" className="btn btn-ghost" onClick={clearForm}>Cancelar</button>}
        </div>
        {isSelf && <p className="panel-note">Para mudar a sua senha, use a aba Segurança.</p>}
      </form>
    </div>
  );
}
