/**
 * Configuração lida do ambiente, validada na subida.
 * Nenhum segredo tem valor padrão no código.
 */
export interface AppConfig {
  port: number;
  isProduction: boolean;
  databaseUrl: string;
  databaseSsl: boolean;
  staticRoot: string;
  publicBaseUrl: string | null;
  sessionTtlHours: number;
  minFillSeconds: number;
  ipHashSalt: string;
  trustProxy: boolean;
  proxyHops: number;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definida. Configure o PostgreSQL (veja .env.example).");
  }
  const isProduction = env.NODE_ENV === "production";
  const ipHashSalt = env.IP_HASH_SALT?.trim() || "";
  if (isProduction && ipHashSalt.length < 16) {
    throw new Error("IP_HASH_SALT deve ter pelo menos 16 caracteres em produção.");
  }
  const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl) || databaseUrl.includes("host=/");
  return {
    port: Number(env.PORT ?? env.API_PORT ?? 8788),
    isProduction,
    databaseUrl,
    databaseSsl: bool(env.DATABASE_SSL, !isLocalDb && isProduction),
    staticRoot: env.STATIC_ROOT ?? "dist",
    // Railway informa o domínio público automaticamente (RAILWAY_PUBLIC_DOMAIN).
    publicBaseUrl:
      env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
      (env.RAILWAY_PUBLIC_DOMAIN?.trim() ? `https://${env.RAILWAY_PUBLIC_DOMAIN.trim()}` : null),
    sessionTtlHours: Number(env.SESSION_TTL_HOURS ?? 12),
    minFillSeconds: Number(env.MIN_FILL_SECONDS ?? 20),
    ipHashSalt: ipHashSalt || "dev-only-salt-not-for-production",
    trustProxy: bool(env.TRUST_PROXY, isProduction),
    proxyHops: Math.max(1, Number(env.TRUST_PROXY_HOPS ?? 1) || 1),
  };
}
