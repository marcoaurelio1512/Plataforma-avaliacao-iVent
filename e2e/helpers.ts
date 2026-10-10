import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@e2e.local", password: "E2eSenhaForte123" };
export const SHOTS = "test-results/screens";
export const AUTH_FILE = "test-results/.auth-admin.json";

/** Sessão reaproveitada (storageState): evita estourar o limite de tentativas de login. */
export async function openAdmin(page: Page, path = "/admin"): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Dashboard" })).toBeVisible();
}

export async function loginUi(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Dashboard" })).toBeVisible();
}

export async function surveySlug(request: APIRequestContext): Promise<{ id: string; slug: string }> {
  await request.post("/api/auth/login", { data: ADMIN, headers: { "x-iva-csrf": "1" } });
  const res = await request.get("/api/admin/surveys");
  const body = await res.json();
  const s = body.data.find((x: { title: string }) => x.title.startsWith("Avaliação de Interface"));
  return { id: s.id, slug: s.slug };
}
