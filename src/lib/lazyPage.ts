/**
 * Páginas carregadas sob demanda que sobrevivem a uma nova publicação.
 * Quem estava com o painel aberto ainda pede os arquivos da versão anterior,
 * que já não existem: em vez de quebrar a tela, recarrega uma vez e abre a versão nova.
 */
import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "iva:stale-reload-at";
/** Evita recarregar em laço se o arquivo continuar faltando (aí o ErrorBoundary assume). */
const RELOAD_COOLDOWN_MS = 30_000;

/** Recarrega a página uma vez por janela de tempo; devolve false se já tentou há pouco. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Sem sessionStorage (modo privado restrito): não arrisca um laço de recarga.
    return false;
  }
  window.location.reload();
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((error: unknown) => {
      // Enquanto a página recarrega, mantém o carregamento pendente em vez de mostrar erro.
      if (reloadForNewVersion()) return new Promise<{ default: T }>(() => undefined);
      throw error;
    }),
  );
}
