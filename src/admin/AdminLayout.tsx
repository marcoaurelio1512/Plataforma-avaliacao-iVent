import {
  BarChart3,
  Bot,
  Cloud,
  FileDown,
  FilePlus2,
  GitCompareArrows,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  Users,
  X,
  ClipboardList,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { SURVEY_STATUS_LABELS } from "../../shared/domain.ts";
import { Brand } from "../components/Brand.tsx";
import { ThemeToggle } from "../components/ThemeToggle.tsx";
import type { AdminUser } from "./AdminApp.tsx";
import { useScope, useScopedLink } from "./scope.tsx";

const NAV: { group: string; items: { to: string; label: string; icon: ReactNode; end?: boolean }[] }[] = [
  {
    group: "Visão geral",
    items: [
      { to: "/admin", label: "Dashboard", icon: <LayoutDashboard />, end: true },
      { to: "/admin/pesquisas", label: "Pesquisas", icon: <ClipboardList />, end: true },
      { to: "/admin/pesquisas/nova", label: "Criar Questionário", icon: <FilePlus2 /> },
    ],
  },
  {
    group: "Dados coletados",
    items: [
      { to: "/admin/participantes", label: "Participantes", icon: <Users /> },
      { to: "/admin/respostas", label: "Respostas", icon: <ListChecks /> },
      { to: "/admin/comentarios", label: "Comentários e Sugestões", icon: <MessageSquareText /> },
    ],
  },
  {
    group: "Análise",
    items: [
      { to: "/admin/nuvem", label: "Nuvem de Palavras", icon: <Cloud /> },
      { to: "/admin/ia", label: "Análise por IA", icon: <Bot /> },
      { to: "/admin/grupos", label: "Comparação entre Grupos", icon: <GitCompareArrows /> },
      { to: "/admin/versoes", label: "Comparação entre Versões", icon: <History /> },
      { to: "/admin/relatorios", label: "Relatórios", icon: <FileDown /> },
    ],
  },
  { group: "Sistema", items: [{ to: "/admin/configuracoes", label: "Configurações", icon: <Settings /> }] },
];

export function AdminLayout({ user, onLogout, children }: { user: AdminUser; onLogout: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const link = useScopedLink();
  const { surveys, surveyId, setSurveyId, survey } = useScope();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className={`admin${open ? " nav-open" : ""}`}>
      <aside className="sidebar" aria-label="Menu principal">
        <div className="sidebar-head">
          <Brand />
          <button type="button" className="btn btn-ghost btn-icon sidebar-close" aria-label="Fechar menu" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <p className="sidebar-title">iVent NeoPed — Avaliações</p>
        <nav className="sidebar-nav">
          {NAV.map((section) => (
            <div key={section.group} className="nav-group">
              <p className="nav-group-label">{section.group}</p>
              {section.items.map((item) => (
                <NavLink key={item.to} to={link(item.to)} end={item.end} className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip" title={user.email}>
            <span className="user-avatar">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Sair" title="Sair" onClick={onLogout}>
            <LogOut />
          </button>
        </div>
      </aside>
      <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="admin-main">
        <header className="topbar">
          <button type="button" className="btn btn-ghost btn-icon menu-btn" aria-label="Abrir menu" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div className="scope-picker">
            <BarChart3 aria-hidden="true" />
            <label htmlFor="scope-survey" className="sr-only">Pesquisa em análise</label>
            <select id="scope-survey" className="select scope-select" value={surveyId ?? ""} onChange={(e) => setSurveyId(e.target.value)} disabled={!surveys.length}>
              {!surveys.length && <option value="">Nenhuma pesquisa</option>}
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {SURVEY_STATUS_LABELS[s.status]} · {s.responseCount} resp.
                </option>
              ))}
            </select>
            {survey && <span className={`badge status-${survey.status}`}>{SURVEY_STATUS_LABELS[survey.status]}</span>}
          </div>
          <ThemeToggle />
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
