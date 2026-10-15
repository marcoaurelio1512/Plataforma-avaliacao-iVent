/**
 * "Diretor" dos vídeos do Como usar: conduz a página com cursor visível,
 * desenha as legendas na própria tela (ficam gravadas no vídeo) e sincroniza
 * cada passo com a narração em pt-BR gerada pela voz do macOS.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";

const VOICE = process.env.TUTORIAL_VOICE ?? "Luciana";
const SPEECH_RATE = "175";
/** Respiro entre um passo narrado e o próximo. */
const STEP_GAP_MS = 250;
const CAPTION_MAX_CHARS = 95;

/** Ajustes de pronúncia: a legenda mantém a grafia, a voz recebe a forma falada. */
const PRONUNCIATION: [RegExp, string][] = [
  [/\biVent\b/g, "ái Vent"],
  [/\bNeoPed\b/g, "Neo Péd"],
  [/\bCSV\b/g, "cê ésse vê"],
  [/\bLikert\b/g, "Líkert"],
  [/\bIA\b/g, "í á"],
  [/\bEIT\b/g, "ê í tê"],
];

export type Cue = { startMs: number; audioFile: string };

/** Overlay injetado em todas as páginas: cursor, anel de clique e faixa de legenda. */
const OVERLAY_SCRIPT = `(() => {
  const css = \`
    #tut-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
    #tut-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f59e0b;z-index:2147483646;pointer-events:none;opacity:0;transform:scale(.4)}
    #tut-ring.on{animation:tut-ring .5s ease-out}
    @keyframes tut-ring{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(1.4)}}
    #tut-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:min(1040px,92vw);z-index:2147483645;pointer-events:none;
      background:rgba(12,18,28,.86);color:#fff;font:600 23px/1.38 "Noto Sans",system-ui,sans-serif;padding:12px 22px;border-radius:10px;text-align:center;
      box-shadow:0 6px 24px rgba(0,0,0,.28);opacity:0;transition:opacity .2s}
    #tut-cap.on{opacity:1}
  \`;
  const mount = () => {
    if (document.getElementById("tut-cap")) return;
    const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
    const cursor = document.createElement("div"); cursor.id = "tut-cursor";
    cursor.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.9L4 20z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const ring = document.createElement("div"); ring.id = "tut-ring";
    const cap = document.createElement("div"); cap.id = "tut-cap"; cap.setAttribute("aria-hidden", "true");
    document.body.append(cursor, ring, cap);
    const pos = JSON.parse(sessionStorage.getItem("tut-pos") || "[640,400]");
    const place = (x, y) => { cursor.style.transform = "translate(" + (x - 4) + "px," + (y - 2) + "px)"; sessionStorage.setItem("tut-pos", JSON.stringify([x, y])); };
    place(pos[0], pos[1]);
    addEventListener("mousemove", (e) => place(e.clientX, e.clientY), true);
    addEventListener("mousedown", (e) => { ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px"; ring.classList.remove("on"); void ring.offsetWidth; ring.classList.add("on"); }, true);
    window.__tutCaption = (text) => { sessionStorage.setItem("tut-cap", text); cap.textContent = text; cap.classList.toggle("on", !!text); };
    window.__tutCaption(sessionStorage.getItem("tut-cap") || "");
  };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();`;

/** Quebra a fala em legendas curtas: por frase e, se longa, por vírgula. */
export function splitCaption(text: string): string[] {
  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  return sentences.flatMap((s) => {
    if (s.length <= CAPTION_MAX_CHARS) return [s];
    const parts: string[] = [];
    let current = "";
    for (const piece of s.split(/(?<=[,;:—])\s+/)) {
      if (current && `${current} ${piece}`.length > CAPTION_MAX_CHARS) {
        parts.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
    return current ? [...parts, current] : parts;
  });
}

export function spoken(text: string): string {
  return PRONUNCIATION.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

function synthesize(text: string, file: string): number {
  execFileSync("say", ["-v", VOICE, "-r", SPEECH_RATE, "-o", file, spoken(text)]);
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString();
  return Math.round(parseFloat(out) * 1000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Director {
  readonly cues: Cue[] = [];
  private stepIndex = 0;
  private recordingStartedAt = 0;
  firstCueAt = -1;

  constructor(readonly page: Page, private readonly audioDir: string) {
    mkdirSync(audioDir, { recursive: true });
  }

  static async prepare(page: Page): Promise<void> {
    await page.addInitScript(OVERLAY_SCRIPT);
  }

  markRecordingStart(): void {
    this.recordingStartedAt = Date.now();
  }

  private async caption(text: string): Promise<void> {
    await this.page.evaluate((t) => (window as unknown as { __tutCaption?: (s: string) => void }).__tutCaption?.(t), text).catch(() => undefined);
  }

  /** Narra o texto (voz + legenda) enquanto executa a ação; avança quando ambos terminam. */
  async step(text: string, action?: () => Promise<void>): Promise<void> {
    const audioFile = join(this.audioDir, `${String(this.stepIndex++).padStart(3, "0")}.aiff`);
    const durationMs = synthesize(text, audioFile);
    const startMs = Date.now() - this.recordingStartedAt;
    if (this.firstCueAt < 0) this.firstCueAt = startMs;
    this.cues.push({ startMs, audioFile });

    const chunks = splitCaption(text);
    const totalChars = chunks.reduce((n, c) => n + c.length, 0);
    const captions = (async () => {
      for (const chunk of chunks) {
        await this.caption(chunk);
        await sleep((durationMs * chunk.length) / totalChars);
      }
    })();
    await Promise.all([captions, action?.()]);
    await this.caption("");
    await sleep(STEP_GAP_MS);
  }

  async pause(ms: number): Promise<void> {
    await sleep(ms);
  }

  /** Move o cursor visivelmente até o elemento (rolando se preciso). */
  async pointAt(target: Locator): Promise<void> {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`Elemento sem posição na tela: ${target}`);
    await this.page.mouse.move(box.x + Math.min(box.width / 2, 60), box.y + box.height / 2, { steps: 22 });
    await sleep(250);
  }

  async click(target: Locator): Promise<void> {
    await this.pointAt(target);
    await target.click();
    await sleep(350);
  }

  async type(target: Locator, text: string, delay = 35): Promise<void> {
    await this.click(target);
    // Seleciona e digita por cima: esvaziar campos numéricos controlados pode reinserir um valor mínimo.
    await target.press("ControlOrMeta+a");
    await target.pressSequentially(text, { delay });
  }

  async select(target: Locator, label: string): Promise<void> {
    await this.pointAt(target);
    await target.selectOption({ label });
    await sleep(400);
  }

  /** Rolagem suave até o elemento chegar ao topo da tela. */
  async scrollTo(target: Locator): Promise<void> {
    await target.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    await sleep(900);
  }

  async scrollBy(dy: number): Promise<void> {
    await this.page.evaluate((d) => window.scrollBy({ top: d, behavior: "smooth" }), dy);
    await sleep(900);
  }
}

/** Junta o vídeo silencioso com as falas, cortando o início em branco. */
export function mux(videoFile: string, cues: Cue[], trimStartMs: number, outFile: string, posterFile: string): void {
  const inputs = cues.flatMap((c) => ["-i", c.audioFile]);
  const delays = cues.map((c, i) => {
    const ms = Math.max(0, c.startMs - trimStartMs);
    return `[${i + 1}:a]aresample=44100,adelay=${ms}|${ms}[a${i}]`;
  });
  const mix = `${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5[aout]`;
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-ss", (trimStartMs / 1000).toFixed(3), "-i", videoFile,
    ...inputs,
    "-filter_complex", [...delays, mix].join(";"),
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-r", "25",
    "-c:a", "aac", "-b:a", "96k", "-ac", "1",
    "-shortest", "-movflags", "+faststart", outFile,
  ]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "2", "-i", outFile, "-frames:v", "1", "-q:v", "4", posterFile]);
}
