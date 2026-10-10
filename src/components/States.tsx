import { AlertTriangle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "../lib/api.ts";

export function Loading({ label = "Carregando dados…" }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      <AlertTriangle />
      <div className="stack-sm grow">
        <span>{errorMessage(error)}</span>
        {onRetry && (
          <div>
            <button type="button" className="btn btn-sm" onClick={onRetry}>
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox />}
      <strong>{title}</strong>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}
