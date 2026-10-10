import { LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BrandMark } from "../components/Brand.tsx";
import { ThemeToggle } from "../components/ThemeToggle.tsx";
import { api, errorMessage } from "../lib/api.ts";
import type { AdminUser } from "./AdminApp.tsx";

export function LoginPage({ onLogin }: { onLogin: (u: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await api<AdminUser>("/api/auth/login", { method: "POST", body: { email, password } });
      onLogin(user);
      navigate((location.state as { from?: string } | null)?.from ?? "/admin", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-theme"><ThemeToggle /></div>
      <form className="login-card" onSubmit={submit} aria-labelledby="login-title">
        <svg className="login-trace" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 40 H60 L72 12 L84 52 L96 8 L108 40 H170 L182 12 L194 52 L206 8 L218 40 H280 L292 12 L304 52 L316 8 L328 40 H400" />
        </svg>
        <div className="row">
          <BrandMark size={40} />
          <div>
            <p className="eyebrow">Área administrativa</p>
            <h1 id="login-title" className="login-title">iVent NeoPed — Avaliação</h1>
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          <LogIn /> {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
