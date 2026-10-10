/**
 * Envelope único das respostas da API e erros tipados.
 * { success: true, data } | { success: false, error: { code, message, details? } }
 */
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { log } from "./logger.ts";

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, "bad_request", message, details);
export const notFound = (message = "Recurso não encontrado.") => new HttpError(404, "not_found", message);
export const conflict = (message: string) => new HttpError(409, "conflict", message);
export const unauthorized = (message = "Autenticação necessária.") => new HttpError(401, "unauthorized", message);
export const forbidden = (message = "Acesso negado.") => new HttpError(403, "forbidden", message);
export const tooManyRequests = (message = "Muitas requisições. Tente novamente em instantes.") =>
  new HttpError(429, "rate_limited", message);

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json({ success: true, data }, status);
}

export function handleError(error: unknown, c: Context) {
  if (error instanceof HttpError) {
    return c.json({ success: false, error: { code: error.code, message: error.message, details: error.details } }, error.status);
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return c.json({ success: false, error: { code: "validation_error", message: "Dados inválidos.", details } }, 400);
  }
  if (error instanceof SyntaxError) {
    return c.json({ success: false, error: { code: "bad_json", message: "JSON inválido." } }, 400);
  }
  log.error("unhandled_error", error, { path: c.req.path, method: c.req.method });
  return c.json({ success: false, error: { code: "internal_error", message: "Erro interno. Tente novamente." } }, 500);
}

/** Lê e valida o corpo JSON com um schema zod. */
export async function readJson<T>(c: Context, schema: { parse: (v: unknown) => T }): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Corpo da requisição deve ser JSON válido.");
  }
  return schema.parse(body);
}
