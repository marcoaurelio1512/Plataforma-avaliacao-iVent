import { expect, test } from "@playwright/test";
import { AUTH_FILE, loginUi, SHOTS } from "./helpers.ts";

test("admin publica o questionário inicial e obtém link e QR Code", async ({ page }) => {
  await loginUi(page);
  await page.getByRole("navigation").getByRole("link", { name: "Pesquisas" }).click();
  const card = page.locator(".survey-card").filter({ hasText: "Avaliação de Interface, Usabilidade" });
  await expect(card).toContainText("Rascunho");
  await card.getByRole("button", { name: "Publicar" }).click();
  await expect(card).toContainText("Publicada");
  await card.getByRole("button", { name: "Link e QR" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".url-box")).toContainText("/r/");
  const qr = dialog.getByRole("img", { name: /QR Code/ });
  await expect(qr).toBeVisible();
  // a imagem realmente carregou (largura natural > 0)
  await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);
  await page.screenshot({ path: `${SHOTS}/admin-share.png` });
  await page.context().storageState({ path: AUTH_FILE });
});
