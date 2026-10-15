import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { testConfig } from "./test/helpers.ts";

let root: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "iva-static-"));
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "index.html"), "<!doctype html><title>app</title>");
  writeFileSync(join(root, "assets", "page-abc123.js"), "export default 1;");
  app = createApp({ ...testConfig, staticRoot: root });
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("arquivos estáticos após uma nova publicação", () => {
  it("arquivo de código inexistente (versão antiga) responde 404, não a página HTML", async () => {
    const res = await app.request("/assets/page-antigo999.js");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type") ?? "").not.toMatch(/text\/html/);
  });

  it("arquivo de código existente continua com cache longo", async () => {
    const res = await app.request("/assets/page-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/immutable/);
  });

  it("a página da aplicação é sempre revalidada pelo navegador", async () => {
    for (const path of ["/", "/admin/comentarios"]) {
      const res = await app.request(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toMatch(/text\/html/);
      expect(res.headers.get("cache-control"), path).toMatch(/no-cache/);
    }
  });
});
