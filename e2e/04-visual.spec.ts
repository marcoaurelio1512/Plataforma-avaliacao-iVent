import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openAdmin, SHOTS, surveySlug } from "./helpers.ts";

const WIDTHS = [320, 768, 1024, 1440];

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "sem rolagem horizontal").toBeLessThanOrEqual(1);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    localStorage.setItem("iva-theme", t);
    document.documentElement.dataset.theme = t;
  }, theme);
}

test("participante: breakpoints, temas e acessibilidade", async ({ page, request }) => {
  const { slug } = await surveySlug(request);
  for (const theme of ["dark", "light"] as const) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/r/${slug}`);
      await setTheme(page, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noHorizontalOverflow(page);
      await page.screenshot({ path: `${SHOTS}/visual-participant-${theme}-${width}.png`, fullPage: true });
    }
  }
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""}`).slice(0, 4).join(" | ")}`)).toEqual([]);
});

test("admin: breakpoints, temas e acessibilidade do dashboard", async ({ page }) => {
  await openAdmin(page);
  for (const theme of ["dark", "light"] as const) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin");
      await setTheme(page, theme);
      await expect(page.getByText("Dashboard de Avaliação iVent NeoPed")).toBeVisible();
      await expect(page.locator(".recharts-surface").first()).toBeVisible();
      await noHorizontalOverflow(page);
      await page.screenshot({ path: `${SHOTS}/visual-dashboard-${theme}-${width}.png`, fullPage: true });
    }
  }
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".recharts-wrapper").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
});

test("sair encerra a sessão e protege as rotas administrativas", async ({ page }) => {
  await openAdmin(page);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("heading", { name: "iVent NeoPed — Avaliação" })).toBeVisible();
  await page.goto("/admin/respostas");
  await expect(page).toHaveURL(/\/admin\/login/);
});
