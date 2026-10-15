import { expect, test } from "@playwright/test";
import { SHOTS, surveySlug } from "./helpers.ts";

test("participante responde o questionário completo", async ({ page, request }, info) => {
  const mobile = info.project.name === "mobile";
  const { slug } = await surveySlug(request);
  await page.goto(`/r/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Avaliação de Interface");
  await expect(page.getByText("Participação anônima")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-01-welcome.png`, fullPage: true });
  await page.getByRole("button", { name: /Começar/ }).click();

  // Perfil: categoria obrigatória
  await page.getByRole("button", { name: /Próxima/ }).click();
  await expect(page.getByText("Selecione uma opção em “Categoria profissional”")).toBeVisible();
  await page.getByRole("radio", { name: mobile ? "Médico residente de Neonatologia" : "Fisioterapeuta" }).click();
  await page.getByRole("radio", { name: "1–3 anos" }).click();
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-02-profile.png`, fullPage: true });
  await page.getByRole("button", { name: /Próxima/ }).click();

  // 10 perguntas Likert
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`Pergunta ${i} de 15`)).toBeVisible();
    if (i === 1) {
      // obrigatória: não avança sem nota
      await page.getByRole("button", { name: /Próxima/ }).click();
      await expect(page.getByText("Esta pergunta é obrigatória.")).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/${info.project.name}-03-likert.png`, fullPage: true });
    }
    if (i === 7) {
      await page.getByRole("button", { name: "Não utilizei este recurso" }).click();
    } else if (!mobile && i <= 3) {
      await page.keyboard.press(String(4 + (i % 2))); // atalho de teclado 4/5
      await expect(page.getByRole("radio", { checked: true })).toBeVisible();
    } else {
      await page.getByRole("radio", { name: new RegExp(i % 2 ? "Concordo totalmente" : "Concordo parcialmente") }).click();
    }
    if (i === 2) await page.getByLabel(/Comentários ou sugestões sobre este item/).fill(mobile ? "Tive dificuldade para localizar o menu." : "Curvas muito claras e loops excelentes.");
    await page.getByRole("button", { name: /Próxima/ }).click();
  }

  // 5 abertas
  for (let i = 11; i <= 15; i++) {
    await expect(page.getByText(`Pergunta ${i} de 15`)).toBeVisible();
    if (i === 11) await page.getByLabel("Sua resposta").fill(mobile ? "Gostei das curvas e do pulmão 3D." : "Os loops e a EIT são excelentes; gasometria simulada ajuda.");
    if (i === 12) await page.getByLabel("Sua resposta").fill(mobile ? "No início a interface confusa me atrapalhou." : "O simulador travou uma vez.");
    await page.getByRole("button", { name: i === 15 ? /Revisar/ : /Próxima/ }).click();
  }

  await expect(page.getByRole("heading", { name: "Confira suas respostas" })).toBeVisible();
  await expect(page.locator(".review-item")).toHaveCount(15);
  await expect(page.getByText("Não utilizei este recurso").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-04-review.png`, fullPage: true });

  // Rascunho local: recarregar não perde as respostas
  await page.reload();
  await expect(page.getByRole("heading", { name: "Confira suas respostas" })).toBeVisible();

  await page.getByRole("button", { name: /Enviar respostas/ }).click();
  await expect(page.getByRole("heading", { name: "Obrigado por participar!" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-05-thanks.png`, fullPage: true });

  // Persistiu no PostgreSQL (via API administrativa)
  const res = await request.get("/api/admin/surveys");
  const s = (await res.json()).data.find((x: { slug: string }) => x.slug === slug);
  expect(s.responseCount).toBe(mobile ? 1 : 2);

  // Aviso no aparelho: abrir de novo mostra "já respondeu", com saída para aparelho compartilhado.
  await page.goto(`/r/${slug}`);
  await expect(page.getByRole("heading", { name: "Você já respondeu esta pesquisa neste aparelho" })).toBeVisible();
  await page.getByRole("button", { name: "Outra pessoa vai responder" }).click();
  await expect(page.getByRole("button", { name: /Começar/ })).toBeVisible();
});
