/**
 * Usuários e perfis: administradores gerenciam a equipe; pesquisadores só
 * consultam e analisam. Senha provisória obriga a troca no primeiro acesso.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loginLimiter } from "../auth.ts";
import { closePool } from "../db.ts";
import { AdminClient, ADMIN, makeApp, resetDatabase, type TestApp } from "./helpers.ts";

let app: TestApp;
let admin: AdminClient;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const RESEARCHER = { name: "Ana Pesquisadora", email: "ana@teste.local", role: "researcher", password: "Provisoria123" };
const NEW_PASSWORD = "MinhaSenha2026";

async function createUser(body: Record<string, unknown>): Promise<Response> {
  return admin.request("/api/admin/users", { method: "POST", body });
}

/** Entra com a senha provisória e já troca para NEW_PASSWORD. */
async function readyClient(user: typeof RESEARCHER): Promise<AdminClient> {
  const client = new AdminClient(app);
  await client.login(user.email, user.password);
  await client.json("/api/auth/password", { method: "POST", body: { currentPassword: user.password, newPassword: NEW_PASSWORD } });
  return client;
}

async function userId(email: string): Promise<string> {
  const users: Json[] = await admin.json("/api/admin/users");
  return users.find((u) => u.email === email).id;
}

beforeAll(async () => {
  await resetDatabase();
  app = makeApp();
  admin = new AdminClient(app);
  await admin.login();
});

afterAll(async () => {
  await closePool();
});

describe("cadastro de usuários", () => {
  it("lista o administrador inicial com perfil admin", async () => {
    const users: Json[] = await admin.json("/api/admin/users");
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: ADMIN.email, role: "admin", active: true, mustChangePassword: false });
    expect(JSON.stringify(users[0])).not.toMatch(/scrypt|password_?hash/i);
  });

  it("cria pesquisador com senha provisória e registra na auditoria", async () => {
    const res = await createUser(RESEARCHER);
    expect(res.status).toBe(201);
    const users: Json[] = await admin.json("/api/admin/users");
    expect(users.find((u) => u.email === RESEARCHER.email)).toMatchObject({ name: RESEARCHER.name, role: "researcher", active: true, mustChangePassword: true });
    const log: Json[] = await admin.json("/api/admin/audit");
    expect(log.some((l) => l.action === "user_created")).toBe(true);
  });

  it("recusa e-mail repetido (sem diferenciar maiúsculas), senha fraca e perfil inválido", async () => {
    expect((await createUser({ ...RESEARCHER, email: "ANA@teste.local" })).status).toBe(409);
    expect((await createUser({ ...RESEARCHER, email: "outra@teste.local", password: "curta1" })).status).toBe(400);
    expect((await createUser({ ...RESEARCHER, email: "outra@teste.local", role: "superuser" })).status).toBe(400);
  });
});

describe("troca obrigatória de senha", () => {
  it("bloqueia a área administrativa até trocar a senha provisória", async () => {
    const client = new AdminClient(app);
    expect((await client.login(RESEARCHER.email, RESEARCHER.password)).status).toBe(200);
    expect(await client.json("/api/auth/me")).toMatchObject({ role: "researcher", mustChangePassword: true });

    const blocked = await client.request("/api/admin/surveys");
    expect(blocked.status).toBe(403);
    expect(((await blocked.json()) as Json).error.code).toBe("password_change_required");

    await client.json("/api/auth/password", { method: "POST", body: { currentPassword: RESEARCHER.password, newPassword: NEW_PASSWORD } });
    expect((await client.json("/api/auth/me")).mustChangePassword).toBe(false);
    expect((await client.request("/api/admin/surveys")).status).toBe(200);
  });

  it("a nova senha não pode ser igual à provisória", async () => {
    const user = { ...RESEARCHER, name: "Davi", email: "davi@teste.local" };
    await createUser(user);
    const client = new AdminClient(app);
    await client.login(user.email, user.password);
    const res = await client.request("/api/auth/password", { method: "POST", body: { currentPassword: user.password, newPassword: user.password } });
    expect(res.status).toBe(400);
  });
});

describe("perfil pesquisador", () => {
  let researcher: AdminClient;

  beforeAll(async () => {
    researcher = new AdminClient(app);
    await researcher.login(RESEARCHER.email, NEW_PASSWORD);
  });

  it("consulta dados, estatísticas e configurações", async () => {
    const surveys: Json[] = await researcher.json("/api/admin/surveys");
    for (const path of ["/api/admin/surveys", `/api/admin/dashboard?surveyId=${surveys[0].id}`, `/api/admin/comments?surveyId=${surveys[0].id}`, "/api/admin/professions", "/api/admin/settings"]) {
      expect((await researcher.request(path)).status, path).toBe(200);
    }
  });

  it("não altera questionários, configurações nem usuários", async () => {
    const surveys: Json[] = await researcher.json("/api/admin/surveys");
    const attempts: [string, string, unknown][] = [
      ["POST", "/api/admin/surveys", { title: "Nova" }],
      ["POST", `/api/admin/surveys/${surveys[0].id}/status`, { action: "publish" }],
      ["DELETE", `/api/admin/surveys/${surveys[0].id}`, undefined],
      ["POST", "/api/admin/ivent-versions", { label: "iVent 9" }],
      ["POST", "/api/admin/users", { ...RESEARCHER, email: "x@teste.local" }],
    ];
    for (const [method, path, body] of attempts) {
      const res = await researcher.request(path, { method, body });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it("não vê usuários, auditoria nem convites", async () => {
    const surveys: Json[] = await researcher.json("/api/admin/surveys");
    for (const path of ["/api/admin/users", "/api/admin/audit", `/api/admin/surveys/${surveys[0].id}/invites`]) {
      expect((await researcher.request(path)).status, path).toBe(403);
    }
  });

  it("pode trocar a própria senha", async () => {
    const res = await researcher.request("/api/auth/password", { method: "POST", body: { currentPassword: NEW_PASSWORD, newPassword: "OutraSenha2026" } });
    expect(res.status).toBe(200);
    await researcher.json("/api/auth/password", { method: "POST", body: { currentPassword: "OutraSenha2026", newPassword: NEW_PASSWORD } });
  });
});

describe("gestão de acesso", () => {
  // Estes cenários fazem muitos logins seguidos do mesmo IP de teste.
  beforeEach(() => loginLimiter.reset());

  it("desativar encerra as sessões e impede novo login; reativar libera", async () => {
    const user = { ...RESEARCHER, name: "Bruno", email: "bruno@teste.local" };
    await createUser(user);
    const client = await readyClient(user);
    const id = await userId(user.email);

    await admin.json(`/api/admin/users/${id}`, { method: "PATCH", body: { active: false } });
    expect((await client.request("/api/admin/surveys")).status).toBe(401);
    expect((await new AdminClient(app).login(user.email, NEW_PASSWORD)).status).toBe(401);

    await admin.json(`/api/admin/users/${id}`, { method: "PATCH", body: { active: true } });
    expect((await new AdminClient(app).login(user.email, NEW_PASSWORD)).status).toBe(200);
  });

  it("redefinir senha exige nova troca e encerra as sessões", async () => {
    const id = await userId(RESEARCHER.email);
    const before = new AdminClient(app);
    await before.login(RESEARCHER.email, NEW_PASSWORD);

    await admin.json(`/api/admin/users/${id}/password`, { method: "POST", body: { password: "Temporaria456" } });
    expect((await before.request("/api/admin/surveys")).status).toBe(401);
    const after = new AdminClient(app);
    expect((await after.login(RESEARCHER.email, "Temporaria456")).status).toBe(200);
    expect((await after.json("/api/auth/me")).mustChangePassword).toBe(true);
  });

  it("promover pesquisador a administrador libera a gestão de usuários", async () => {
    const user = { ...RESEARCHER, name: "Carla", email: "carla@teste.local" };
    await createUser(user);
    const client = await readyClient(user);
    expect((await client.request("/api/admin/users")).status).toBe(403);
    await admin.json(`/api/admin/users/${await userId(user.email)}`, { method: "PATCH", body: { role: "admin" } });
    expect((await client.request("/api/admin/users")).status).toBe(200);
  });

  it("ninguém rebaixa, desativa ou redefine a senha de si mesmo pela gestão", async () => {
    const me = await admin.json("/api/auth/me");
    expect((await admin.request(`/api/admin/users/${me.id}`, { method: "PATCH", body: { role: "researcher" } })).status).toBe(400);
    expect((await admin.request(`/api/admin/users/${me.id}`, { method: "PATCH", body: { active: false } })).status).toBe(400);
    expect((await admin.request(`/api/admin/users/${me.id}/password`, { method: "POST", body: { password: "Temporaria456" } })).status).toBe(400);
  });

  it("edita o nome sem afetar o acesso", async () => {
    const id = await userId("carla@teste.local");
    await admin.json(`/api/admin/users/${id}`, { method: "PATCH", body: { name: "Carla Souza" } });
    const users: Json[] = await admin.json("/api/admin/users");
    expect(users.find((u) => u.id === id)).toMatchObject({ name: "Carla Souza", role: "admin", active: true });
  });

  it("usuário inativo e e-mail inexistente recebem a mesma mensagem de erro", async () => {
    await admin.json(`/api/admin/users/${await userId("carla@teste.local")}`, { method: "PATCH", body: { active: false } });
    const inactive = await new AdminClient(app).login("carla@teste.local", NEW_PASSWORD);
    const unknown = await new AdminClient(app).login("ninguem@teste.local", NEW_PASSWORD);
    expect(inactive.status).toBe(401);
    expect(((await inactive.json()) as Json).error.message).toBe(((await unknown.json()) as Json).error.message);
  });
});
