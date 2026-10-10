/**
 * Autenticação administrativa: sessão opaca em cookie httpOnly + SameSite=Strict,
 * guardada no banco apenas como hash (vazamento do banco não entrega sessões).
 */
import { createHash, randomBytes } from "node:crypto";
import { Hono, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "./context.ts";
import { query, queryOne } from "./db.ts";
import { badRequest, ok, readJson, tooManyRequests, unauthorized } from "./http.ts";
import { hashPassword, passwordPolicyError, verifyPassword } from "./password.ts";
import { RateLimiter } from "./security.ts";
import { loginSchema } from "./validation.ts";

export const SESSION_COOKIE = "iva_session";
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export const loginLimiter = new RateLimiter(10, 15 * 60 * 1000);

// Hash fixo para igualar o tempo de resposta quando o e-mail não existe.
const DUMMY_HASH = `scrypt$16384$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;

export async function audit(
  adminId: string | null,
  action: string,
  opts: { entity?: string; entityId?: string; details?: Record<string, unknown>; ipHash?: string } = {},
): Promise<void> {
  await query(`INSERT INTO audit_logs (admin_id, action, entity, entity_id, details, ip_hash) VALUES ($1,$2,$3,$4,$5,$6)`, [
    adminId,
    action,
    opts.entity ?? null,
    opts.entityId ?? null,
    JSON.stringify(opts.details ?? {}),
    opts.ipHash ?? null,
  ]);
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) throw unauthorized();
  const row = await queryOne<{ id: string; email: string; name: string }>(
    `SELECT a.id, a.email, a.name FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  if (!row) throw unauthorized("Sessão expirada. Entre novamente.");
  c.set("admin", row);
  await next();
};

export function createAuthRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/api/auth/login", async (c) => {
    const cfg = c.get("config");
    const { email, password } = await readJson(c, loginSchema);
    const ipHash = c.get("ipHash");
    if (!loginLimiter.take(`${ipHash}:${email}`) || !loginLimiter.take(`ip:${ipHash}`)) {
      throw tooManyRequests("Muitas tentativas de login. Aguarde alguns minutos.");
    }
    const admin = await queryOne<{ id: string; email: string; name: string; password_hash: string }>(
      `SELECT id, email, name, password_hash FROM admin_users WHERE lower(email) = $1`,
      [email],
    );
    const valid = await verifyPassword(password, admin?.password_hash ?? DUMMY_HASH);
    if (!admin || !valid) {
      await audit(null, "login_failed", { details: { email }, ipHash });
      throw unauthorized("E-mail ou senha incorretos.");
    }
    const token = randomBytes(32).toString("base64url");
    await query(`DELETE FROM admin_sessions WHERE expires_at < now()`);
    await query(`INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES ($1, $2, now() + make_interval(hours => $3))`, [
      sha256(token),
      admin.id,
      cfg.sessionTtlHours,
    ]);
    await query(`UPDATE admin_users SET last_login_at = now() WHERE id = $1`, [admin.id]);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: cfg.isProduction,
      sameSite: "Strict",
      path: "/",
      maxAge: cfg.sessionTtlHours * 3600,
    });
    await audit(admin.id, "login", { ipHash });
    return ok(c, { id: admin.id, email: admin.email, name: admin.name });
  });

  app.post("/api/auth/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [sha256(token)]);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return ok(c, { loggedOut: true });
  });

  app.get("/api/auth/me", requireAdmin, (c) => ok(c, c.get("admin")));

  app.post("/api/auth/password", requireAdmin, async (c) => {
    const body = await readJson(c, z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().max(200) }));
    const admin = c.get("admin");
    const row = await queryOne<{ password_hash: string }>(`SELECT password_hash FROM admin_users WHERE id = $1`, [admin.id]);
    if (!row || !(await verifyPassword(body.currentPassword, row.password_hash))) throw badRequest("Senha atual incorreta.");
    const policy = passwordPolicyError(body.newPassword);
    if (policy) throw badRequest(policy);
    await query(`UPDATE admin_users SET password_hash = $1 WHERE id = $2`, [await hashPassword(body.newPassword), admin.id]);
    // Encerra as outras sessões; a atual continua válida.
    const current = sha256(getCookie(c, SESSION_COOKIE) ?? "");
    await query(`DELETE FROM admin_sessions WHERE admin_id = $1 AND token_hash <> $2`, [admin.id, current]);
    await audit(admin.id, "password_changed", { ipHash: c.get("ipHash") });
    return ok(c, { changed: true });
  });

  return app;
}
