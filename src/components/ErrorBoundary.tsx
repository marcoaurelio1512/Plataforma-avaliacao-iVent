/**
 * Rede de proteção da interface: um erro ao montar uma tela mostra uma
 * mensagem com saída (recarregar) em vez de deixar a página em branco.
 */
import { RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Fica no console do navegador para diagnóstico; a pessoa vê a mensagem abaixo.
    console.error("Falha ao exibir a tela", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="alert alert-error" role="alert">
        <div className="stack-sm">
          <strong>Não foi possível abrir esta tela.</strong>
          <span>Isso costuma acontecer logo depois de uma atualização da plataforma. Recarregue a página para continuar; nenhum dado foi perdido.</span>
          <div>
            <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}><RefreshCw /> Recarregar a página</button>
          </div>
        </div>
      </div>
    );
  }
}
