import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Loading } from "./components/States.tsx";
import { lazyPage } from "./lib/lazyPage.ts";

// A área pública carrega só o necessário; o painel (gráficos, editor) vem sob demanda.
const SurveyPage = lazyPage(() => import("./participant/SurveyPage.tsx"));
const AdminApp = lazyPage(() => import("./admin/AdminApp.tsx"));

export function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading label="Carregando…" />}>
        <Routes>
          <Route path="/r/:slug" element={<SurveyPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
