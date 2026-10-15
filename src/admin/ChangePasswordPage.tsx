/**
 * Primeiro acesso com senha provisória: a pessoa define a própria senha
 * antes de ver qualquer dado (o servidor também bloqueia até a troca).
 */
import { KeyRound, LogOut } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BrandMark } from "../components/Brand.tsx";
import { ThemeToggle } from "../components/ThemeToggle.tsx";
import { api, errorMessage } from "../lib/api.ts";
import type { AdminUser } from "./session.tsx";

export function ChangePasswordPage({ user, onChanged, onLogout }: { user: AdminUser; onChanged: () => void; onLogout: () => void }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/password", { method: "POST", body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-theme"><ThemeToggle /></div>
      <form className="login-card" onSubmit={submit} aria-labelledby="pw-title">
        <div className="row">
          <BrandMark size={40} />
          <div>
            <p className="eyebrow">Primeiro acesso</p>
            <h1 id="pw-title" className="login-title">Crie sua senha</h1>
          </div>
        </div>
        <p className="muted">
          Olá, {user.name || user.email}. Você entrou com uma senha provisória. Defina uma senha pessoal para continuar — só você deve conhecê-la.
        </p>
        <div className="field">
          <label htmlFor="pw-current">Senha provisória</label>
          <input id="pw-current" className="input" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pw-new">Nova senha</label>
          <input id="pw-new" className="input" type="password" autoComplete="new-password" required minLength={10} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          <span className="panel-note">Mínimo de 10 caracteres, com letras e números.</span>
        </div>
        <div className="field">
          <label htmlFor="pw-confirm">Confirmar nova senha</label>
          <input id="pw-confirm" className="input" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          <KeyRound /> {busy ? "Salvando…" : "Salvar e continuar"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onLogout}><LogOut /> Sair</button>
      </form>
    </div>
  );
}
