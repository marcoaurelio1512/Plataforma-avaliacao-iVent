/** npm run migrate — aplica migrations pendentes. */
import { loadConfig } from "../config.ts";
import { closePool, initPool } from "../db.ts";
import { log } from "../logger.ts";
import { runMigrations } from "../migrate.ts";

const config = loadConfig();
initPool(config.databaseUrl, config.databaseSsl);
runMigrations()
  .then((applied) => log.info("migrations_done", { applied }))
  .catch((error) => {
    log.error("migrations_failed", error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
