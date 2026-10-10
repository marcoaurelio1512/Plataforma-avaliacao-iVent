import { expect, test } from "@playwright/test";
import { openAdmin, SHOTS } from "./helpers.ts";

test.describe.configure({ mode: "serial" });

test("dashboard mostra contagens, estatísticas e oportunidades de melhoria", async ({ page }) => {
  await openAdmin(page);
  await expect(page.locator(".kpi").filter({ hasText: "Respostas concluídas" })).toContainText("2");
  await expect(page.locator(".kpi").filter({ hasText: "Médicos residentes" })).toContainText("1");
  await expect(page.locator(".kpi").filter({ hasText: "Fisioterapeutas" })).toContainText("1");
  await expect(page.getByRole("heading", { name: "Média de cada pergunta" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Principais oportunidades de melhoria" })).toBeVisible();
  await expect(page.getByText("Ferramenta operacional — não é evidência científica")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/admin-dashboard.png`, fullPage: true });

  // filtro por profissão recalcula
  await page.getByLabel("Profissão").selectOption({ label: "Fisioterapeuta" });
  await expect(page.locator(".kpi").filter({ hasText: "Respostas concluídas" })).toContainText("1");
});

test("nuvem de palavras: clique abre comentários originais com ocorrências × participantes", async ({ page }) => {
  await openAdmin(page);
  await page.getByRole("navigation").getByRole("link", { name: "Nuvem de Palavras" }).click();
  const word = page.getByRole("button", { name: "curvas: ver comentários" });
  await expect(word).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/admin-wordcloud.png`, fullPage: true });
  await word.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("CURVAS — mencionada por 2 participantes");
  await expect(dialog).toContainText("ocorrências");
  await expect(dialog).toContainText("Fisioterapeuta");
  await expect(dialog).toContainText("Médico residente de Neonatologia");
  await expect(dialog.locator("mark.hl").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/admin-wordcloud-term.png` });
  await page.keyboard.press("Escape");

  // filtro Fisioterapeutas recalcula a nuvem
  await page.getByRole("tab", { name: "Fisioterapeutas" }).click();
  await expect(page.getByRole("button", { name: "loops: ver comentários" })).toBeVisible();
  await expect(page.getByRole("button", { name: "interface confusa: ver comentários" })).toHaveCount(0);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG" }).click();
  expect((await download).suggestedFilename()).toMatch(/nuvem-de-palavras-.*\.png/);
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF" }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
});

test("comentários: busca por palavra e filtro por profissão", async ({ page }) => {
  await openAdmin(page);
  await page.getByRole("navigation").getByRole("link", { name: "Comentários e Sugestões" }).click();
  await page.getByLabel("Pesquisar por palavra").fill("curvas");
  await expect(page.getByText(/2 texto\(s\) encontrado/)).toBeVisible();
  await page.getByLabel("Profissão").selectOption({ label: "Fisioterapeuta" });
  await expect(page.getByText(/1 texto\(s\) encontrado/)).toBeVisible();
  await expect(page.locator(".source-item mark.hl").first()).toBeVisible();
});

test("comparação entre grupos e relatórios PDF, Excel e CSV", async ({ page }) => {
  await openAdmin(page);
  await page.getByRole("navigation").getByRole("link", { name: "Comparação entre Grupos" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Médico residente de Neonatologia × Fisioterapeuta");
  await expect(page.getByText(/não indica significância estatística/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/admin-groups.png`, fullPage: true });

  await page.getByRole("navigation").getByRole("link", { name: "Relatórios" }).click();
  for (const [button, pattern] of [["Baixar PDF", /\.pdf$/], ["Baixar Excel", /\.xlsx$/], ["Respostas (formato longo)", /\.csv$/]] as const) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: button }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(pattern);
    expect((await file.path()) ?? "").not.toBe("");
  }
});

test("editor: criar questionário, reordenar, prévia e versionar pesquisa com respostas", async ({ page }) => {
  await openAdmin(page);
  await page.getByRole("navigation").getByRole("link", { name: "Criar Questionário" }).click();
  await page.getByLabel("Título", { exact: true }).fill("Pesquisa rápida E2E");
  await page.getByLabel("Texto da pergunta").first().fill("A interface é clara?");
  await page.getByRole("button", { name: "Sim/Não" }).click();
  await page.getByLabel("Texto da pergunta").nth(1).fill("Você usou a EIT?");
  await page.getByRole("button", { name: "Mover para cima" }).nth(1).click();
  await expect(page.locator(".q-text").first()).toHaveText("Você usou a EIT?");
  await page.getByRole("button", { name: "Salvar como rascunho" }).click();
  await expect(page).toHaveURL(/\/admin\/pesquisas\/[0-9a-f-]{36}/);
  await page.getByRole("link", { name: "Prévia" }).click();
  await expect(page.getByText("Prévia — respostas não são enviadas")).toBeVisible();

  // Editar a pesquisa inicial (que já tem respostas) cria a versão 2
  await page.getByRole("navigation").getByRole("link", { name: "Pesquisas" }).click();
  await page.locator(".survey-card").filter({ hasText: "Avaliação de Interface, Usabilidade" }).getByRole("link", { name: "Editar" }).click();
  await expect(page.getByText(/já recebeu 2 resposta\(s\)/)).toBeVisible();
  await page.getByLabel("Título da seção de perguntas abertas").fill("Sua opinião sobre o iVent NeoPed (revisado)");
  await page.locator(".q-summary").first().click();
  await page.getByLabel("Texto da pergunta").first().fill("A interface do iVent é clara e organizada?");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText(/Nova versão v2 criada/)).toBeVisible();
  await expect(page.locator(".version-list")).toContainText("v2");
  await expect(page.locator(".version-list")).toContainText("v1");
});

test("configurações: cadastrar versão do iVent", async ({ page }) => {
  await openAdmin(page);
  await page.getByRole("navigation").getByRole("link", { name: "Configurações" }).click();
  await page.getByLabel("Nome").fill("iVent 2.0");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.locator("table")).toContainText("iVent 2.0");
});

test("convites de uso único: exigir, gerar, baixar e acesso do participante", async ({ page, browser }) => {
  await openAdmin(page);
  await page.getByRole("navigation").getByRole("link", { name: "Pesquisas" }).click();
  const card = page.locator(".survey-card").filter({ hasText: "Pesquisa rápida E2E" });
  await card.getByRole("button", { name: "Publicar" }).click();
  await expect(card).toContainText("Publicada");
  await card.getByRole("button", { name: "Convites" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Exigir convite de uso único/).check();
  await expect(dialog.locator(".invite-mode.is-on")).toBeVisible();
  await dialog.getByLabel("Quantidade").fill("2");
  await dialog.getByRole("button", { name: "Gerar convites" }).click();
  await expect(dialog.locator("tbody tr")).toHaveCount(2);
  await expect(dialog.getByText("Disponível")).toHaveCount(2);
  const pdf = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /Folha de QR Codes/ }).click();
  expect((await pdf).suggestedFilename()).toMatch(/convites-qr-.*\.pdf/);
  await page.screenshot({ path: `${SHOTS}/admin-invites.png` });
  const code = (await dialog.locator("tbody tr td.num").first().textContent())!.trim();
  await page.keyboard.press("Escape");
  await expect(card).toContainText("Convite obrigatório");

  // Participante (navegador sem sessão administrativa)
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  const href = await card.getByRole("button", { name: "Ver resultados" }).count(); // garante que o card segue visível
  expect(href).toBe(1);
  const surveys = await (await page.request.get("/api/admin/surveys")).json();
  const slug = surveys.data.find((s: { title: string }) => s.title === "Pesquisa rápida E2E").slug;
  await visitor.goto(`/r/${slug}`);
  await expect(visitor.getByText(/respondida por convite/)).toBeVisible();
  await visitor.goto(`/r/${slug}?c=codigoinvalido1`);
  await expect(visitor.getByText(/convite não é válido/)).toBeVisible();
  await visitor.goto(`/r/${slug}?c=${code}`);
  await expect(visitor.getByRole("button", { name: /Começar/ })).toBeVisible();
  await ctx.close();
});

test("guia Como usar: abre pelo menu, índice navega e cabe no celular", async ({ page }) => {
  await openAdmin(page);
  await page.getByRole("link", { name: "Como usar", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Como usar" })).toBeVisible();
  await page.getByRole("navigation", { name: "Índice do guia" }).getByRole("link", { name: /Convites de uso único/ }).click();
  await expect(page).toHaveURL(/#convites$/);
  await expect(page.getByRole("heading", { name: /8\. Convites de uso único/ })).toBeInViewport();
  await page.screenshot({ path: `${SHOTS}/admin-help.png` });
  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
