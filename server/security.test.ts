import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { clientIp, RateLimiter, signStart, verifyStart } from "./security.ts";

describe("clientIp atrás de proxy", () => {
  it("usa a entrada acrescentada pelo proxy (fim da lista), não a forjada pelo cliente", async () => {
    const app = new Hono();
    app.get("/", (c) => c.text(clientIp(c, true, 1)));
    const res = await app.request("/", { headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9" } });
    expect(await res.text()).toBe("203.0.113.9");
  });
});

describe("RateLimiter", () => {
  it("bloqueia após o limite e libera após a janela", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.take("a", 0)).toBe(true);
    expect(rl.take("a", 10)).toBe(true);
    expect(rl.take("a", 20)).toBe(false);
    expect(rl.take("a", 1500)).toBe(true);
  });

  it("não cresce sem limite sob chaves aleatórias", () => {
    const rl = new RateLimiter(5, 60_000);
    for (let i = 0; i < 60_000; i++) rl.take(`k${i}`, 1);
    expect(rl.size).toBeLessThanOrEqual(50_000);
  });
});

describe("token de início assinado", () => {
  it("verifica o token íntegro e rejeita adulteração ou outra pesquisa", () => {
    const t = signStart("abc123", 1_700_000_000_000, "segredo-de-teste-123");
    expect(verifyStart(t, "abc123", "segredo-de-teste-123")).toBe(1_700_000_000_000);
    expect(verifyStart(t.replace(/^\d/, "9"), "abc123", "segredo-de-teste-123")).toBeNull();
    expect(verifyStart(t, "outra", "segredo-de-teste-123")).toBeNull();
  });
});
