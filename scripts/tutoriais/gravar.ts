/**
 * Grava os vídeos narrados do "Como usar" (pt-BR, com legendas na tela).
 *
 *   npm run tutoriais                 # todos os vídeos
 *   npm run tutoriais -- dashboard    # só os roteiros indicados (ids de roteiros.ts)
 *
 * Sobe a aplicação real num banco descartável (*_e2e, zerado a cada execução),
 * semeia respostas fictícias e grava cada roteiro com o Chromium do Playwright.
 * Requer macOS (voz "Luciana" do comando `say`) e ffmpeg no PATH.
 * Saída: public/tutoriais/<id>.mp4 e <id>.jpg (capa).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, type Browser, type BrowserContextOptions } from "@playwright/test";
import { Director, mux } from "./diretor.ts";
import { SCENES, type Scene, type SceneContext } from "./roteiros.ts";
import { seedResponses } from "./seed.ts";

const PORT = Number(process.env.TUTORIAL_PORT ?? 8792);
const BASE_URL = `http://localhost:${PORT}`;
const DATABASE_URL = process.env.TUTORIAL_DATABASE_URL ?? "postgresql://localhost:5432/ivent_avaliacao_videos_e2e";
const ADMIN = { email: "coordenacao@ivent.local", password: "SenhaDemonstracao2026" };
const VIEWPORT = { width: 1280, height: 800 };
const OUT_DIR = resolve("public/tutoriais");
const WORK_DIR = join(tmpdir(), "ivent-tutoriais");
/** Instante de tela parada antes da primeira fala. */
const LEAD_IN_MS = 600;
const TAIL_MS = 1500;

type StorageState = BrowserContextOptions["storageState"];

function startServer(): ChildProcess {
  return spawn(process.execPath, ["--import", "tsx", "e2e/server.ts"], {
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_URL,
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      IP_HASH_SALT: "tutoriais-salt-0123456789",
      PUBLIC_BASE_URL: BASE_URL,
      MIN_FILL_SECONDS: "0",
      LOG_SILENT: "true",
    },
  });
}

async function waitForHealth(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await fetch(`${BASE_URL}/health`).then((r) => r.ok, () => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Servidor não respondeu em ${BASE_URL}/health.`);
}

/** Publica a pesquisa inicial e envia as respostas fictícias; devolve o slug dela. */
async function prepareData(): Promise<string> {
  const headers = { "content-type": "application/json", "x-iva-csrf": "1" };
  const login = await fetch(`${BASE_URL}/api/auth/login`, { method: "POST", headers, body: JSON.stringify(ADMIN) });
  if (!login.ok) throw new Error(`Login da preparação falhou (${login.status}).`);
  const authed = { ...headers, cookie: login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
  const list = (await (await fetch(`${BASE_URL}/api/admin/surveys`, { headers: authed })).json()) as { data: { id: string; slug: string }[] };
  const main = list.data[0];
  if (!main) throw new Error("Pesquisa inicial não encontrada.");
  const pub = await fetch(`${BASE_URL}/api/admin/surveys/${main.id}/status`, { method: "POST", headers: authed, body: JSON.stringify({ action: "publish" }) });
  if (!pub.ok) throw new Error(`Falha ao publicar a pesquisa inicial (${pub.status}).`);
  await seedResponses(BASE_URL, main.slug);
  return main.slug;
}

async function adminStorageState(browser: Browser): Promise<StorageState> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(ADMIN.email);
  await page.getByLabel("Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("navigation").getByRole("link", { name: "Dashboard" }).waitFor();
  const state = await context.storageState();
  await context.close();
  return state;
}

async function recordScene(browser: Browser, scene: Scene, ctx: SceneContext, storageState: StorageState): Promise<void> {
  const workDir = join(WORK_DIR, scene.id);
  rmSync(workDir, { recursive: true, force: true });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: VIEWPORT,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: "light",
    storageState: scene.authenticated ? storageState : undefined,
    recordVideo: { dir: join(workDir, "video"), size: VIEWPORT },
  });
  context.setDefaultTimeout(15_000);
  const page = await context.newPage();
  const director = new Director(page, join(workDir, "audio"));
  director.markRecordingStart();
  await Director.prepare(page);
  await page.goto(scene.startPath.replace("{mainSlug}", ctx.mainSlug));
  await page.waitForLoadState("networkidle");
  await director.pause(LEAD_IN_MS + 400);
  try {
    await scene.run(director, ctx);
    await director.pause(TAIL_MS);
  } finally {
    await context.close();
  }
  const video = page.video();
  if (!video) throw new Error(`Sem vídeo gravado para ${scene.id}.`);
  const trimStart = Math.max(0, director.firstCueAt - LEAD_IN_MS);
  mux(await video.path(), director.cues, trimStart, join(OUT_DIR, `${scene.id}.mp4`), join(OUT_DIR, `${scene.id}.jpg`));
  console.log(`✓ ${scene.id}.mp4 — ${scene.title}`);
}

function selectScenes(requested: string[]): Scene[] {
  const unknown = requested.filter((id) => !SCENES.some((s) => s.id === id));
  if (unknown.length) throw new Error(`Roteiro(s) desconhecido(s): ${unknown.join(", ")}. Disponíveis: ${SCENES.map((s) => s.id).join(", ")}`);
  // "publicar-compartilhar" depende do rascunho criado em "criar-questionario".
  const wanted = new Set(requested.includes("publicar-compartilhar") ? [...requested, "criar-questionario"] : requested);
  return SCENES.filter((s) => !wanted.size || wanted.has(s.id));
}

async function main(): Promise<void> {
  const scenes = selectScenes(process.argv.slice(2));
  mkdirSync(OUT_DIR, { recursive: true });
  const server = startServer();
  const browser = await chromium.launch({ args: ["--lang=pt-BR"], env: { ...process.env, LANG: "pt_BR.UTF-8" } });
  try {
    await waitForHealth();
    const ctx: SceneContext = { mainSlug: await prepareData(), adminEmail: ADMIN.email, adminPassword: ADMIN.password };
    const storageState = await adminStorageState(browser);
    for (const scene of scenes) await recordScene(browser, scene, ctx, storageState);
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
