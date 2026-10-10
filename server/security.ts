/**
 * Proteções transversais: limite de requisições, IP anonimizado e CSRF.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { forbidden, tooManyRequests } from "./http.ts";

/** Teto de chaves por limitador: protege a memória mesmo sob abuso. */
const MAX_KEYS = 50_000;

/** Janela deslizante em memória (uma instância). Suficiente para o volume do estudo. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Registra uma tentativa; devolve false quando o limite estourou. */
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    // Reinsere no fim: a ordem do Map vira "menos recente primeiro".
    this.hits.delete(key);
    this.hits.set(key, [...recent, now]);
    if (this.hits.size > MAX_KEYS) this.prune(now);
    return true;
  }

  reset(): void {
    this.hits.clear();
  }

  private prune(now: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
    // Ainda acima do teto: descarta as chaves usadas há mais tempo.
    for (const key of this.hits.keys()) {
      if (this.hits.size <= MAX_KEYS * 0.9) break;
      this.hits.delete(key);
    }
  }

  get size(): number {
    return this.hits.size;
  }
}

/**
 * IP do cliente. Atrás de proxy (Railway), o proxy ACRESCENTA o IP real ao fim
 * de X-Forwarded-For; o início da lista é controlado pelo cliente e pode ser
 * forjado. Por isso usamos a entrada a `proxyHops` posições do fim.
 */
export function clientIp(c: Context, trustProxy: boolean, proxyHops = 1): string {
  if (trustProxy) {
    const chain = (c.req.header("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const candidate = chain[chain.length - Math.max(1, proxyHops)];
    if (candidate) return candidate;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** IP nunca é gravado em claro (LGPD): só um hash com sal, para limitar abuso e auditar. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function rateLimit(limiter: RateLimiter, keyOf: (c: Context) => string): MiddlewareHandler {
  return async (c, next) => {
    if (!limiter.take(keyOf(c))) throw tooManyRequests();
    await next();
  };
}

export const CSRF_HEADER = "x-iva-csrf";

/**
 * Mutação administrativa exige cabeçalho próprio, que um formulário de outro
 * site não consegue enviar sem CORS — somado ao cookie SameSite=Strict.
 */
export const requireCsrfHeader: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && c.req.header(CSRF_HEADER) !== "1") {
    throw forbidden("Requisição sem cabeçalho de proteção CSRF.");
  }
  await next();
};

/** Token de início assinado: o servidor atesta quando o formulário foi aberto. */
export function signStart(slug: string, issuedAt: number, secret: string): string {
  const mac = createHmac("sha256", secret).update(`${slug}.${issuedAt}`).digest("base64url").slice(0, 32);
  return `${issuedAt}.${mac}`;
}

export function verifyStart(token: string, slug: string, secret: string): number | null {
  const [ts, mac] = token.split(".");
  const issuedAt = Number(ts);
  if (!Number.isSafeInteger(issuedAt) || !mac) return null;
  const expected = signStart(slug, issuedAt, secret).split(".")[1]!;
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? issuedAt : null;
}
