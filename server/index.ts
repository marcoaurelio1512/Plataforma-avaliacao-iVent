/**
 * Boot: valida configuração → conecta → migra → seed idempotente → serve.
 * Callers: npm start / Dockerfile CMD.
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { closePool, initPool } from "./db.ts";
import { log } from "./logger.ts";
import { runMigrations } from "./migrate.ts";
import { aiConfig } from "./services/ai.ts";
import { runSeed } from "./services/seed.ts";

async function main(): Promise<void> {
  const config = loadConfig();
  initPool(config.databaseUrl, config.databaseSsl);
  const applied = await runMigrations();
  log.info("migrations_done", { applied });
  if (process.env.ADMIN_RESET_PASSWORD === "true") {
    log.warn("admin_reset_password_enabled", { hint: "Remova ADMIN_RESET_PASSWORD após o uso: a senha é redefinida a cada reinício." });
  }
  const seed = await runSeed();
  log.info("seed_done", {
    professionsInserted: seed.professionsInserted,
    iventVersionCreated: seed.iventVersionCreated,
    surveyCreated: seed.surveyCreated,
    admin: seed.admin,
  });
  if (seed.generatedPassword) {
    // Apenas fora de produção, quando ADMIN_PASSWORD não foi definido.
    log.warn("admin_password_generated", { email: process.env.ADMIN_EMAIL, password: seed.generatedPassword });
  }
  if (config.isProduction && !config.publicBaseUrl) {
    log.warn("public_base_url_missing", { hint: "Defina PUBLIC_BASE_URL para links e QR Codes estáveis." });
  }
  const ai = aiConfig();
  log.info("ai_config", ai ? { configured: true, provider: ai.provider, model: ai.model } : { configured: false });

  const app = createApp(config);
  const server = serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" }, (info) => {
    log.info("server_listening", { port: info.port, production: config.isProduction });
  });

  const shutdown = (signal: string) => {
    log.info("shutdown", { signal });
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  log.error("boot_failed", error);
  process.exit(1);
});
