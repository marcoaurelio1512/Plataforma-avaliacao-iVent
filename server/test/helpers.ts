/**
 * Infraestrutura dos testes de integração: banco PostgreSQL real e dedicado.
 * Por segurança, só aceita bancos cujo nome termina em "_test".
 */
import type { Hono } from "hono";
import { createApp } from "../app.ts";
import type { AppConfig } from "../config.ts";
import type { AppEnv } from "../context.ts";
import { closePool, getPool, initPool } from "../db.ts";
import { runMigrations } from "../migrate.ts";
import { runSeed } from "../services/seed.ts";
import { loginLimiter } from "../auth.ts";
import { submissionLimiter, surveySubmissionLimiter } from "../routes/public.ts";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/ivent_avaliacao_test";
export const ADMIN = { email: "admin@teste.local", password: "SenhaForte123" };

export const testConfig: AppConfig = {
  port: 0,
  isProduction: false,
  databaseUrl: TEST_DB_URL,
  databaseSsl: false,
  staticRoot: "__no_static__",
  publicBaseUrl: "https://avaliacao.exemplo.com",
  sessionTtlHours: 1,
  minFillSeconds: 5,
  ipHashSalt: "test-salt-0123456789",
  trustProxy: false,
  proxyHops: 1,
};

export async function resetDatabase(): Promise<void> {
  const dbName = new URL(TEST_DB_URL).pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`Recusado: ${dbName} não é um banco de teste (_test).`);
  await closePool();
  initPool(TEST_DB_URL, false);
  await getPool().query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await runMigrations();
  await runSeed({ ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, NODE_ENV: "test" } as NodeJS.ProcessEnv);
  loginLimiter.reset();
  submissionLimiter.reset();
  surveySubmissionLimiter.reset();
}

export type TestApp = Hono<AppEnv>;

export function makeApp(): TestApp {
  return createApp(testConfig);
}

/** Cliente mínimo que guarda o cookie de sessão e envia o cabeçalho CSRF. */
export class AdminClient {
  cookie = "";
  constructor(private readonly app: TestApp) {}

  async login(email = ADMIN.email, password = ADMIN.password): Promise<Response> {
    const res = await this.app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-iva-csrf": "1" },
      body: JSON.stringify({ email, password }),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0]!;
    return res;
  }

  request(path: string, init: { method?: string; body?: unknown; csrf?: boolean } = {}): Promise<Response> {
    const headers: Record<string, string> = { cookie: this.cookie };
    if (init.csrf !== false) headers["x-iva-csrf"] = "1";
    if (init.body !== undefined) headers["content-type"] = "application/json";
    return Promise.resolve(
      this.app.request(path, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) }),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async json<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await this.request(path, init);
    const body = (await res.json()) as { success: boolean; data: T; error?: unknown };
    if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${JSON.stringify(body.error)}`);
    return body.data;
  }
}

let keyCounter = 0;
export function idempotencyKey(): string {
  keyCounter += 1;
  return `test-key-${Date.now().toString(36)}-${keyCounter.toString().padStart(6, "0")}`;
}
