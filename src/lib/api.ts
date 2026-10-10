/**
 * Cliente da API. Mutações enviam o cabeçalho anti-CSRF; respostas seguem o
 * envelope { success, data | error }.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined | null>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal } = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") headers["x-iva-csrf"] = "1";
  if (init.body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(withQuery(path, init.query), {
      method,
      headers,
      credentials: "same-origin",
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "network", "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }
  let body: { success?: boolean; data?: T; error?: { code: string; message: string; details?: unknown } } = {};
  try {
    body = await res.json();
  } catch {
    // resposta sem JSON
  }
  if (!res.ok || body.success === false) {
    if (res.status === 401 && path.startsWith("/api/admin")) {
      window.dispatchEvent(new CustomEvent("iva:unauthorized"));
    }
    throw new ApiError(res.status, body.error?.code ?? "http_error", body.error?.message ?? `Erro ${res.status}`, body.error?.details);
  }
  return body.data as T;
}

/** Baixa um arquivo autenticado (relatórios) preservando o nome sugerido pelo servidor. */
export async function download(path: string, query?: Query): Promise<void> {
  const res = await fetch(withQuery(path, query), { credentials: "same-origin" });
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, "download_failed", message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "arquivo";
  saveBlob(blob, name);
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Erro inesperado.";
}
