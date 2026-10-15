/**
 * Usuários do painel (exclusivo de administradores, ver enforceAccess):
 * cadastro com senha provisória, perfil, ativação e redefinição de senha.
 * Ninguém altera o próprio perfil ou a própria ativação por aqui; assim
 * sempre resta ao menos um administrador ativo (quem está agindo).
 */
import { Hono } from "hono";
import { z } from "zod";
import { USER_ROLES, type UserRole } from "../../shared/domain.ts";
import { audit } from "../auth.ts";
import type { AppEnv } from "../context.ts";
import { query, queryOne } from "../db.ts";
import { badRequest, conflict, notFound, ok, readJson } from "../http.ts";
import { hashPassword, passwordPolicyError } from "../password.ts";

const nameSchema = z.string().trim().min(2, "Informe o nome.").max(120);

const createSchema = z.object({
  name: nameSchema,
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
  role: z.enum(USER_ROLES),
  password: z.string().max(200),
});

const updateSchema = z
  .object({ name: nameSchema.optional(), role: z.enum(USER_ROLES).optional(), active: z.boolean().optional() })
  .refine((v) => v.name !== undefined || v.role !== undefined || v.active !== undefined, "Nada para alterar.");

const resetSchema = z.object({ password: z.string().max(200) });

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  must_change_password: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

const USER_COLUMNS = "id, email, name, role, active, must_change_password, created_at, last_login_at";

const toUser = (r: UserRow) => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  active: r.active,
  mustChangePassword: r.must_change_password,
  createdAt: r.created_at.toISOString(),
  lastLoginAt: r.last_login_at?.toISOString() ?? null,
});

function assertPolicy(password: string): void {
  const policy = passwordPolicyError(password);
  if (policy) throw badRequest(policy);
}

export function createAdminUserRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/api/admin/users", async (c) => {
    const rows = await query<UserRow>(`SELECT ${USER_COLUMNS} FROM admin_users ORDER BY active DESC, lower(name), lower(email)`);
    return ok(c, rows.map(toUser));
  });

  app.post("/api/admin/users", async (c) => {
    const body = await readJson(c, createSchema);
    assertPolicy(body.password);
    const row = await queryOne<{ id: string }>(
      `INSERT INTO admin_users (email, name, role, password_hash, must_change_password)
       VALUES ($1, $2, $3, $4, true) ON CONFLICT DO NOTHING RETURNING id`,
      [body.email, body.name, body.role, await hashPassword(body.password)],
    );
    if (!row) throw conflict("Já existe um usuário com este e-mail.");
    await audit(c.get("admin").id, "user_created", { entity: "user", entityId: row.id, details: { email: body.email, role: body.role }, ipHash: c.get("ipHash") });
    return ok(c, { id: row.id }, 201);
  });

  app.patch("/api/admin/users/:id", async (c) => {
    const id = z.uuid().parse(c.req.param("id"));
    const body = await readJson(c, updateSchema);
    if (c.get("admin").id === id && (body.role !== undefined || body.active !== undefined)) {
      throw badRequest("Você não pode alterar o próprio perfil nem desativar o próprio acesso.");
    }
    const row = await queryOne<UserRow>(
      `UPDATE admin_users SET name = COALESCE($2, name), role = COALESCE($3, role), active = COALESCE($4, active)
        WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [id, body.name ?? null, body.role ?? null, body.active ?? null],
    );
    if (!row) throw notFound("Usuário não encontrado.");
    if (body.active === false) await query(`DELETE FROM admin_sessions WHERE admin_id = $1`, [id]);
    await audit(c.get("admin").id, "user_updated", { entity: "user", entityId: id, details: body, ipHash: c.get("ipHash") });
    return ok(c, toUser(row));
  });

  app.post("/api/admin/users/:id/password", async (c) => {
    const id = z.uuid().parse(c.req.param("id"));
    const { password } = await readJson(c, resetSchema);
    if (c.get("admin").id === id) throw badRequest("Para mudar a sua senha, use Configurações → Segurança.");
    assertPolicy(password);
    const row = await queryOne<{ id: string }>(
      `UPDATE admin_users SET password_hash = $2, must_change_password = true WHERE id = $1 RETURNING id`,
      [id, await hashPassword(password)],
    );
    if (!row) throw notFound("Usuário não encontrado.");
    await query(`DELETE FROM admin_sessions WHERE admin_id = $1`, [id]);
    await audit(c.get("admin").id, "user_password_reset", { entity: "user", entityId: id, ipHash: c.get("ipHash") });
    return ok(c, { reset: true });
  });

  return app;
}
