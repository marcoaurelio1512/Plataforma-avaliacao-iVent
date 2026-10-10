/**
 * Servidor dos testes E2E: zera o banco dedicado (*_e2e) e sobe a aplicação real.
 * Recusa qualquer banco cujo nome não termine em "_e2e".
 */
import pg from "pg";

const url = process.env.DATABASE_URL ?? "";
const dbName = url ? new URL(url).pathname.slice(1) : "";
if (!dbName.endsWith("_e2e")) {
  throw new Error(`Recusado: "${dbName}" não é um banco E2E (_e2e).`);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
await client.end();

await import("../server/index.ts");
