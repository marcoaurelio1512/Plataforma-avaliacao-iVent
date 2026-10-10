import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loading } from "./components/States.tsx";

// A área pública carrega só o necessário; o painel (gráficos, editor) vem sob demanda.
const SurveyPage = lazy(() => import("./participant/SurveyPage.tsx"));
const AdminApp = lazy(() => import("./admin/AdminApp.tsx"));

export function App() {
  return (
    <Suspense fallback={<Loading label="Carregando…" />}>
      <Routes>
        <Route path="/r/:slug" element={<SurveyPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}
