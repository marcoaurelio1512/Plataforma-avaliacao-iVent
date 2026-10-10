/**
 * Log estruturado em JSON (uma linha por evento), legível no painel do Railway.
 * Nunca registra textos de participantes, senhas ou chaves.
 */
type Level = "info" | "warn" | "error";

function write(level: Level, event: string, data?: Record<string, unknown>): void {
  if (process.env.LOG_SILENT === "true") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...data });
  if (level === "error") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => write("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => write("warn", event, data),
  error: (event: string, error?: unknown, data?: Record<string, unknown>) =>
    write("error", event, {
      ...data,
      error: error instanceof Error ? { message: error.message, stack: error.stack?.split("\n").slice(0, 6).join("\n") } : error,
    }),
};
