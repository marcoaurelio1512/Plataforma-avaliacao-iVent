/** npm run seed — dados iniciais (idempotente: pode rodar várias vezes). */
import { loadConfig } from "../config.ts";
import { closePool, initPool } from "../db.ts";
import { log } from "../logger.ts";
import { runMigrations } from "../migrate.ts";
import { runSeed } from "../services/seed.ts";

const config = loadConfig();
initPool(config.databaseUrl, config.databaseSsl);
runMigrations()
  .then(() => runSeed())
  .then((result) => {
    log.info("seed_done", { ...result, generatedPassword: undefined });
    // Só ocorre fora de produção, quando ADMIN_PASSWORD não foi definido.
    if (result.generatedPassword) log.warn("admin_password_generated", { email: process.env.ADMIN_EMAIL, password: result.generatedPassword });
  })
  .catch((error) => {
    log.error("seed_failed", error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
