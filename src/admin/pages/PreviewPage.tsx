import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ErrorState, Loading } from "../../components/States.tsx";
import { api } from "../../lib/api.ts";
import { useAsync } from "../../lib/useAsync.ts";
import SurveyPage from "../../participant/SurveyPage.tsx";
import type { PublicSurvey } from "../../participant/types.ts";
import { useSession } from "../session.tsx";

/** Prévia fiel ao que o participante verá — inclusive antes de publicar. Nada é enviado. */
export default function PreviewPage() {
  const { id = "" } = useParams();
  const { canManage } = useSession();
  const state = useAsync((signal) => api<PublicSurvey>(`/api/admin/surveys/${id}/preview`, { signal }), [id]);
  return (
    <div className="stack">
      <div className="row">
        {canManage ? (
          <Link className="btn btn-sm" to={`/admin/pesquisas/${id}`}><ArrowLeft /> Voltar ao editor</Link>
        ) : (
          <Link className="btn btn-sm" to="/admin/pesquisas"><ArrowLeft /> Voltar às pesquisas</Link>
        )}
      </div>
      {state.loading && <Loading />}
      {state.error != null && <ErrorState error={state.error} />}
      {state.data && (
        <div className="preview-frame">
          <SurveyPage preview={state.data} />
        </div>
      )}
    </div>
  );
}
