import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Loading } from "../components/States.tsx";
import { api } from "../lib/api.ts";
import { AdminLayout } from "./AdminLayout.tsx";
import { LoginPage } from "./LoginPage.tsx";
import { ScopeProvider } from "./scope.tsx";
import "../styles/admin.css";

const DashboardPage = lazy(() => import("./pages/DashboardPage.tsx"));
const SurveysPage = lazy(() => import("./pages/SurveysPage.tsx"));
const SurveyEditorPage = lazy(() => import("./pages/SurveyEditorPage.tsx"));
const PreviewPage = lazy(() => import("./pages/PreviewPage.tsx"));
const ParticipantsPage = lazy(() => import("./pages/ParticipantsPage.tsx"));
const ResponsesPage = lazy(() => import("./pages/ResponsesPage.tsx"));
const CommentsPage = lazy(() => import("./pages/CommentsPage.tsx"));
const WordCloudPage = lazy(() => import("./pages/WordCloudPage.tsx"));
const AiPage = lazy(() => import("./pages/AiPage.tsx"));
const ComparePage = lazy(() => import("./pages/ComparePage.tsx"));
const VersionsPage = lazy(() => import("./pages/VersionsPage.tsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.tsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.tsx"));

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export default function AdminApp() {
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = "iVent NeoPed — Avaliações";
    api<AdminUser>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("iva:unauthorized", onUnauthorized);
    return () => window.removeEventListener("iva:unauthorized", onUnauthorized);
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    navigate("/admin/login");
  }, [navigate]);

  if (user === undefined) return <Loading label="Verificando sessão…" />;
  if (user === null) {
    if (location.pathname !== "/admin/login") return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
    return <LoginPage onLogin={setUser} />;
  }
  if (location.pathname === "/admin/login") return <Navigate to="/admin" replace />;

  return (
    <ScopeProvider>
      <AdminLayout user={user} onLogout={logout}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="pesquisas" element={<SurveysPage />} />
            <Route path="pesquisas/nova" element={<SurveyEditorPage />} />
            <Route path="pesquisas/:id" element={<SurveyEditorPage />} />
            <Route path="pesquisas/:id/previa" element={<PreviewPage />} />
            <Route path="participantes" element={<ParticipantsPage />} />
            <Route path="respostas" element={<ResponsesPage />} />
            <Route path="comentarios" element={<CommentsPage />} />
            <Route path="nuvem" element={<WordCloudPage />} />
            <Route path="ia" element={<AiPage />} />
            <Route path="grupos" element={<ComparePage />} />
            <Route path="versoes" element={<VersionsPage />} />
            <Route path="relatorios" element={<ReportsPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </AdminLayout>
    </ScopeProvider>
  );
}
