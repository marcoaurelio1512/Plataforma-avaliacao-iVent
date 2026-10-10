/**
 * Testes de integração ponta a ponta (API real + PostgreSQL real).
 * Cobrem a lista de testes obrigatórios do projeto.
 */
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, initPool, query } from "../db.ts";
import { runSeed } from "../services/seed.ts";
import { analyzeFeedback, verifyAiResult, buildPrompt } from "../services/ai.ts";
import { signStart } from "../security.ts";
import { AdminClient, ADMIN, idempotencyKey, makeApp, resetDatabase, TEST_DB_URL, testConfig, type TestApp } from "./helpers.ts";

let app: TestApp;
let admin: AdminClient;
let surveyId: string;
let slug: string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

async function publicSurvey(): Promise<Json> {
  const res = await app.request(`/api/public/surveys/${slug}`);
  return ((await res.json()) as Json).data;
}

interface SubmitOptions {
  profession: string;
  scores: (number | "not_used")[];
  comments?: Record<number, string>;
  open?: Record<number, string>;
  key?: string;
  startedAt?: number;
  website?: string;
  versionId?: string;
  inviteCode?: string;
}

async function submit(o: SubmitOptions, payload?: Json): Promise<Response> {
  const survey = payload ?? (await publicSurvey());
  const quant = survey.questions.filter((q: Json) => q.section === "quantitative");
  const open = survey.questions.filter((q: Json) => q.section === "open");
  const answers = [
    ...quant.map((q: Json, i: number) => {
      const score = o.scores[i] ?? 4;
      return {
        questionId: q.id,
        numericValue: score === "not_used" ? null : score,
        special: score === "not_used" ? "not_used" : null,
        comment: o.comments?.[i] ?? null,
      };
    }),
    ...open.map((q: Json, i: number) => ({ questionId: q.id, textValue: o.open?.[i] ?? null })),
  ];
  return app.request(`/api/public/surveys/${slug}/responses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: o.key ?? idempotencyKey(),
      versionId: o.versionId ?? survey.versionId,
      startedAt: o.startedAt ?? Date.now() - 120_000,
      // Token assinado como o servidor emitiria há `startedAt` ms (o servidor confia só nele).
      startToken: signStart(slug, o.startedAt ?? Date.now() - 120_000, testConfig.ipHashSalt),
      deviceClass: "mobile",
      website: o.website ?? "",
      inviteCode: o.inviteCode,
      profile: { profession: o.profession, experienceYears: "1to3", simulatorExperience: "basic", iventExperience: "first" },
      answers,
    }),
  });
}

beforeAll(async () => {
  await resetDatabase();
  app = makeApp();
  admin = new AdminClient(app);
});

afterAll(async () => {
  await closePool();
});

describe("migrations e seed", () => {
  it("cria o questionário inicial com 10 perguntas quantitativas e 5 abertas", async () => {
    const rows = await query<{ section: string; n: number }>(
      `SELECT q.section, count(*) AS n FROM questions q JOIN surveys s ON s.current_version_id = q.survey_version_id
        WHERE s.seed_key IS NOT NULL GROUP BY q.section`,
    );
    const bySection = Object.fromEntries(rows.map((r) => [r.section, r.n]));
    expect(bySection).toEqual({ quantitative: 10, open: 5 });
    const q7 = await query<{ allow_not_used: boolean }>(`SELECT allow_not_used FROM questions WHERE question_key = 'recursos_complementares'`);
    expect(q7[0]!.allow_not_used).toBe(true);
  });

  it("seed é idempotente: rodar de novo não duplica perguntas, pesquisa, categorias nem admin", async () => {
    await runSeed({ ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password } as NodeJS.ProcessEnv);
    await runSeed({ ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password } as NodeJS.ProcessEnv);
    const [counts] = await query<{ surveys: number; questions: number; professions: number; admins: number; versions: number }>(
      `SELECT (SELECT count(*) FROM surveys) AS surveys, (SELECT count(*) FROM questions) AS questions,
              (SELECT count(*) FROM professional_categories) AS professions, (SELECT count(*) FROM admin_users) AS admins,
              (SELECT count(*) FROM ivent_versions) AS versions`,
    );
    expect(counts).toEqual({ surveys: 1, questions: 15, professions: 2, admins: 1, versions: 1 });
  });

  it("migrations ficam registradas e não reaplicam", async () => {
    const rows = await query<{ id: string }>(`SELECT id FROM schema_migrations`);
    expect(rows.map((r) => r.id)).toContain("001_init.sql");
  });
});

describe("autenticação", () => {
  it("bloqueia a área administrativa sem login", async () => {
    const res = await app.request("/api/admin/surveys");
    expect(res.status).toBe(401);
  });

  it("recusa senha incorreta", async () => {
    const res = await new AdminClient(app).login(ADMIN.email, "senhaErrada999");
    expect(res.status).toBe(401);
  });

  it("autentica com cookie httpOnly e SameSite=Strict", async () => {
    const res = await admin.login();
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it("exige cabeçalho CSRF em mutações administrativas", async () => {
    const res = await admin.request("/api/admin/surveys", { method: "POST", body: { title: "x" }, csrf: false });
    expect(res.status).toBe(403);
  });
});

describe("gerenciador de questionários", () => {
  it("lista a pesquisa inicial e permite publicar, gerando link e QR Code", async () => {
    const surveys = await admin.json("/api/admin/surveys");
    expect(surveys).toHaveLength(1);
    surveyId = surveys[0].id;
    slug = surveys[0].slug;
    expect(surveys[0].publicUrl).toBe(`https://avaliacao.exemplo.com/r/${slug}`);

    const closedRes = await app.request(`/api/public/surveys/${slug}`);
    expect(((await closedRes.json()) as Json).data.acceptingResponses).toBe(false);

    await admin.json(`/api/admin/surveys/${surveyId}/status`, { method: "POST", body: { action: "publish" } });
    const pub = await publicSurvey();
    expect(pub.acceptingResponses).toBe(true);
    expect(pub.questions).toHaveLength(15);

    const qr = await admin.request(`/api/admin/surveys/${surveyId}/qr.png?download=1`);
    expect(qr.status).toBe(200);
    expect(qr.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await qr.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("cria, edita (sem respostas, no lugar) e duplica uma pesquisa", async () => {
    const created = await admin.json("/api/admin/surveys", {
      method: "POST",
      body: {
        title: "Pesquisa de teste",
        instructions: "",
        questions: [
          { section: "quantitative", type: "numeric_scale", text: "Nota de 0 a 10", scaleMin: 0, scaleMax: 10, required: true },
          { section: "quantitative", type: "multiple_choice", text: "Recursos usados", options: [{ label: "Curvas" }, { label: "EIT" }] },
          { section: "open", type: "short_text", text: "Uma palavra" },
        ],
      },
    });
    expect(created.status).toBe("draft");
    expect(created.questions).toHaveLength(3);
    const edit = await admin.json(`/api/admin/surveys/${created.id}/content`, {
      method: "PUT",
      body: { title: "Pesquisa de teste editada", instructions: "x", questions: created.questions.slice(0, 2) },
    });
    expect(edit.versionCreated).toBe(false);
    expect(edit.survey.questions).toHaveLength(2);
    // Reescrita no lugar preserva o id das perguntas mantidas (rascunhos de participantes seguem válidos).
    expect(edit.survey.questions.map((q: Json) => q.id)).toEqual(created.questions.slice(0, 2).map((q: Json) => q.id));
    const copy = await admin.json(`/api/admin/surveys/${created.id}/duplicate`, { method: "POST" });
    expect(copy.title).toContain("(cópia)");
    expect(copy.questions.map((q: Json) => q.key)).toEqual(edit.survey.questions.map((q: Json) => q.key));
    const del = await admin.request(`/api/admin/surveys/${copy.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
  });

  it("valida perguntas inválidas (escolha sem opções)", async () => {
    const res = await admin.request("/api/admin/surveys", {
      method: "POST",
      body: { title: "Inválida", questions: [{ section: "quantitative", type: "single_choice", text: "Escolha", options: [] }] },
    });
    expect(res.status).toBe(400);
  });
});

describe("submissão pública", () => {
  it("rejeita token de início forjado ou ausente", async () => {
    const survey = await publicSurvey();
    expect(survey.startToken).toMatch(/^\d+\./);
    const forged = `${Date.now() - 600_000}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const res = await app.request(`/api/public/surveys/${slug}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: idempotencyKey(), versionId: survey.versionId, startedAt: Date.now() - 600_000, startToken: forged, profile: { profession: "physiotherapist" }, answers: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("token recém-emitido pelo servidor não permite envio imediato (relógio do cliente é ignorado)", async () => {
    const survey = await publicSurvey();
    const res = await app.request(`/api/public/surveys/${slug}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: idempotencyKey(), versionId: survey.versionId, startedAt: Date.now() - 3_600_000, startToken: survey.startToken, profile: { profession: "physiotherapist" }, answers: [] }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as Json).error.message).toMatch(/rápido/);
  });

  it("rejeita envio rápido demais (proteção contra automação)", async () => {
    const res = await submit({ profession: "physiotherapist", scores: [5], startedAt: Date.now() - 1000 });
    expect(res.status).toBe(400);
  });

  it("campo-armadilha preenchido não grava nada", async () => {
    const res = await submit({ profession: "physiotherapist", scores: [5], website: "http://spam" });
    expect(res.status).toBe(201);
    const [{ n }] = await query<{ n: number }>(`SELECT count(*) AS n FROM survey_responses`);
    expect(n).toBe(0);
  });

  it("rejeita resposta sem as perguntas obrigatórias", async () => {
    const survey = await publicSurvey();
    const res = await app.request(`/api/public/surveys/${slug}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: idempotencyKey(), versionId: survey.versionId, startedAt: Date.now() - 60_000, startToken: signStart(slug, Date.now() - 60_000, testConfig.ipHashSalt), profile: { profession: "physiotherapist" }, answers: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("grava resposta completa e é idempotente no reenvio", async () => {
    const key = idempotencyKey();
    const first = await submit({ profession: "resident_neonatology", scores: [5, 4, 4, 3, 5, 5, "not_used", 4, 3, 5], key, comments: { 0: "=HYPERLINK(\"x\") interface ótima" }, open: { 0: "Gostei muito das curvas e do pulmão 3D." } });
    expect(first.status).toBe(201);
    const again = await submit({ profession: "resident_neonatology", scores: [1], key });
    expect(again.status).toBe(200);
    expect(((await again.json()) as Json).data.duplicate).toBe(true);
    const [{ n }] = await query<{ n: number }>(`SELECT count(*) AS n FROM survey_responses`);
    expect(n).toBe(1);
  });

  it("dois envios simultâneos com a mesma chave gravam uma vez e ambos recebem sucesso", async () => {
    const payload = await publicSurvey();
    const key = idempotencyKey();
    const [a, b] = await Promise.all([
      submit({ profession: "physiotherapist", scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], key }, payload),
      submit({ profession: "physiotherapist", scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], key }, payload),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    const [{ n }] = await query<{ n: number }>(`SELECT count(*) AS n FROM survey_responses WHERE idempotency_key = $1`, [key]);
    expect(n).toBe(1);
    // Remove a resposta extra para manter as contagens dos testes seguintes.
    await query(`UPDATE survey_responses SET status = 'invalidated' WHERE idempotency_key = $1`, [key]);
  });

  it("coleta respostas de residentes e fisioterapeutas (celular e computador)", async () => {
    const payload = await publicSurvey();
    const data: SubmitOptions[] = [
      { profession: "resident_neonatology", scores: [4, 2, 4, 4, 4, 5, 4, 5, 4, 5], comments: { 1: "Difícil localizar o menu de modos" }, open: { 1: "Tive dificuldade para localizar alguns controles." } },
      { profession: "resident_neonatology", scores: [3, 2, 3, 4, 4, 4, "not_used", 3, 3, 4], open: { 0: "As curvas ventilatórias são excelentes.", 2: "Interface confusa no início." } },
      { profession: "physiotherapist", scores: [5, 3, 5, 5, 5, 5, 5, 4, 4, 5], comments: { 2: "Curvas muito claras" }, open: { 0: "Curvas e loops claros; a gasometria simulada ajuda.", 3: "Gostaria de NAVA e VAFO." } },
      { profession: "physiotherapist", scores: [4, 3, 4, 5, 4, 5, 4, 2, 4, 5], comments: { 7: "O simulador travou duas vezes" }, open: { 1: "Travamentos ocasionais.", 4: "Ajustar PEEP e FiO₂ foi intuitivo." } },
    ];
    for (const d of data) {
      const res = await submit(d, payload);
      expect(res.status).toBe(201);
    }
    const [{ n }] = await query<{ n: number }>(`SELECT count(*) AS n FROM survey_responses`);
    expect(n).toBe(6);
  });

  it("preserva textos originais exatamente como enviados", async () => {
    const rows = await query<{ text: string }>(`SELECT text FROM answer_comments WHERE text LIKE '=HYPERLINK%'`);
    expect(rows[0]!.text).toBe("=HYPERLINK(\"x\") interface ótima");
  });
});

describe("estatísticas e dashboard", () => {
  it("calcula média, mediana e DP excluindo 'Não utilizei' e informando n válido", async () => {
    const d = await admin.json(`/api/admin/dashboard?surveyId=${surveyId}`);
    expect(d.overview.completedResponses).toBe(5);
    expect(d.overview.totalParticipants).toBe(5);
    const q1 = d.stats.find((s: Json) => s.key === "interface_visual");
    // notas: 5, 4, 3, 5, 4 → média 4,2; mediana 4; DP amostral √0,7
    expect(q1.scale.validN).toBe(5);
    expect(q1.scale.mean).toBeCloseTo(4.2, 10);
    expect(q1.scale.median).toBe(4);
    expect(q1.scale.sd).toBeCloseTo(Math.sqrt(0.7), 10);
    const q7 = d.stats.find((s: Json) => s.key === "recursos_complementares");
    // dois "Não utilizei" → 3 válidas (4, 5, 4)
    expect(q7.scale.notUsed).toBe(2);
    expect(q7.scale.validN).toBe(3);
    expect(q7.scale.mean).toBeCloseTo(13 / 3, 10);
    expect(d.priorities.items.length).toBeGreaterThan(0);
    expect(d.priorities.source).toBe("keywords");
  });

  it("data impossível nos filtros devolve 400 (não 500)", async () => {
    const res = await admin.request(`/api/admin/dashboard?surveyId=${surveyId}&from=2026-13-45`);
    expect(res.status).toBe(400);
  });

  it("filtra residentes e fisioterapeutas", async () => {
    const r = await admin.json(`/api/admin/dashboard?surveyId=${surveyId}&profession=resident_neonatology`);
    const f = await admin.json(`/api/admin/dashboard?surveyId=${surveyId}&profession=physiotherapist`);
    expect(r.overview.completedResponses).toBe(3);
    expect(f.overview.completedResponses).toBe(2);
    expect(f.stats.find((s: Json) => s.key === "interface_visual").scale.mean).toBe(4.5);
  });

  it("compara grupos sem afirmar significância", async () => {
    const c = await admin.json(`/api/admin/compare?surveyId=${surveyId}`);
    expect(c.result.groupA.n).toBe(3);
    expect(c.result.groupB.n).toBe(2);
    const q1 = c.result.questions.find((q: Json) => q.key === "interface_visual");
    expect(q1.comparison.a.mean).toBe(4);
    expect(q1.comparison.b.mean).toBe(4.5);
    expect(q1.comparison.note).toMatch(/não indica significância/);
    expect(c.sideB.topWords.length).toBeGreaterThan(0);
  });
});

describe("textos, nuvem e busca", () => {
  it("gera nuvem diferenciando ocorrências de participantes e grava o cache", async () => {
    const cloud = await admin.json(`/api/admin/wordcloud?surveyId=${surveyId}`);
    const curvas = cloud.terms.find((t: Json) => t.label === "curvas");
    expect(curvas).toBeDefined();
    expect(curvas.occurrences).toBeGreaterThanOrEqual(curvas.participants);
    expect(cloud.terms.map((t: Json) => t.label)).toEqual(expect.arrayContaining(["pulmão 3D", "curvas ventilatórias", "FiO₂", "PEEP"]));
    const [{ n }] = await query<{ n: number }>(`SELECT count(*) AS n FROM word_frequencies WHERE cache_key = $1`, [cloud.cacheKey]);
    expect(n).toBeGreaterThan(0);
  });

  it("clique na palavra devolve os comentários originais com pergunta e profissão", async () => {
    const cloud = await admin.json(`/api/admin/wordcloud?surveyId=${surveyId}`);
    const curvas = cloud.terms.find((t: Json) => t.label === "curvas");
    const term = await admin.json(`/api/admin/wordcloud/term?surveyId=${surveyId}&key=${encodeURIComponent(curvas.key)}`);
    expect(term.participants).toBe(curvas.participants);
    expect(term.sources[0].questionText).toBeTruthy();
    expect(term.sources[0].professionLabel).toBeTruthy();
    const [s, e] = term.sources[0].ranges[0];
    expect(term.sources[0].text.slice(s, e).toLowerCase()).toMatch(/curva/);
  });

  it("filtra a nuvem por profissão", async () => {
    const r = await admin.json(`/api/admin/wordcloud?surveyId=${surveyId}&profession=physiotherapist`);
    expect(r.terms.map((t: Json) => t.label)).toContain("loops");
    expect(r.terms.map((t: Json) => t.label)).not.toContain("interface confusa");
  });

  it("busca comentários por palavra, profissão e pergunta", async () => {
    const all = await admin.json(`/api/admin/comments?surveyId=${surveyId}&search=curvas`);
    expect(all.total).toBeGreaterThanOrEqual(2);
    const physio = await admin.json(`/api/admin/comments?surveyId=${surveyId}&search=curvas&profession=physiotherapist`);
    expect(physio.items.every((i: Json) => i.profession === "physiotherapist")).toBe(true);
    const byQuestion = await admin.json(`/api/admin/comments?surveyId=${surveyId}&questionKey=dificuldades`);
    expect(byQuestion.items.every((i: Json) => i.questionKey === "dificuldades")).toBe(true);
  });
});

describe("exportações", () => {
  it("CSV neutraliza fórmulas vindas de texto livre", async () => {
    const res = await admin.request(`/api/admin/reports/csv?surveyId=${surveyId}&kind=comentarios`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("'=HYPERLINK");
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it("Excel tem as 8 abas e células protegidas", async () => {
    const res = await admin.request(`/api/admin/reports/xlsx?surveyId=${surveyId}`);
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Participantes", "Respostas quantitativas", "Comentários", "Perguntas abertas", "Estatísticas",
      "Frequência de palavras", "Residentes × Fisioterapeutas", "Versões do iVent",
    ]);
    const comments = wb.getWorksheet("Comentários")!;
    const values = comments.getColumn(4).values.map(String);
    expect(values.some((v) => v.startsWith("'=HYPERLINK"))).toBe(true);
  });

  it("PDF é gerado", async () => {
    const res = await admin.request(`/api/admin/reports/pdf?surveyId=${surveyId}`);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(10_000);
  });
});

describe("versionamento e preservação histórica", () => {
  it("editar após respostas cria nova versão sem alterar a anterior", async () => {
    const before = await admin.json(`/api/admin/surveys/${surveyId}`);
    const oldVersionId = before.currentVersionId;
    const questions = before.questions.map((q: Json) => (q.key === "interface_visual" ? { ...q, text: `${q.text} (revisada)` } : q));
    const edit = await admin.json(`/api/admin/surveys/${surveyId}/content`, { method: "PUT", body: { title: before.title, instructions: before.instructions, openSectionTitle: before.openSectionTitle, questions } });
    expect(edit.versionCreated).toBe(true);
    expect(edit.versionNumber).toBe(2);
    const oldQs = await admin.json(`/api/admin/surveys/${surveyId}/versions/${oldVersionId}/questions`);
    expect(oldQs.find((q: Json) => q.key === "interface_visual").text).not.toContain("(revisada)");
    const oldDash = await admin.json(`/api/admin/dashboard?surveyId=${surveyId}&versionId=${oldVersionId}`);
    expect(oldDash.overview.completedResponses).toBe(5);
    // Resposta enviada com a versão antiga ainda carregada no navegador continua aceita e ligada a ela.
    const payloadOld = { ...(await publicSurvey()), versionId: oldVersionId, questions: oldQs };
    const late = await submit({ profession: "physiotherapist", scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4] }, payloadOld);
    expect(late.status).toBe(201);
    const newDash = await admin.json(`/api/admin/dashboard?surveyId=${surveyId}&versionId=${edit.versionId}`);
    expect(newDash.overview.completedResponses).toBe(0);
  });

  it("compara versões do iVent apenas em perguntas compatíveis", async () => {
    const v2 = await admin.json("/api/admin/ivent-versions", { method: "POST", body: { label: "iVent 2.0", releasedAt: "2026-12-01", notes: "" } });
    const copy = await admin.json(`/api/admin/surveys/${surveyId}/duplicate`, { method: "POST" });
    await admin.json(`/api/admin/surveys/${copy.id}/meta`, { method: "PUT", body: { iventVersionId: v2.id } });
    await admin.json(`/api/admin/surveys/${copy.id}/status`, { method: "POST", body: { action: "publish" } });
    const prevSlug = slug;
    slug = copy.slug;
    const res = await submit({ profession: "resident_neonatology", scores: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] });
    expect(res.status).toBe(201);
    slug = prevSlug;
    const ev = await admin.json("/api/admin/versions/evolution");
    expect(ev.versions.map((v: Json) => v.label)).toEqual(["iVent 1.0", "iVent 2.0"]);
    const row = ev.rows.find((r: Json) => r.key === "avaliacao_geral");
    expect(row.compatible).toBe(true);
    expect(row.byVersion[v2.id].n).toBe(1);
    const interfaceRow = ev.rows.find((r: Json) => r.key === "interface_visual");
    expect(interfaceRow.textVaries).toBe(true);
  });
});

describe("ciclo de vida do link", () => {
  it("encerrar bloqueia novas respostas; reabrir libera", async () => {
    await admin.json(`/api/admin/surveys/${surveyId}/status`, { method: "POST", body: { action: "close" } });
    const payload = await admin.json(`/api/admin/surveys/${surveyId}/preview`);
    const blocked = await submit({ profession: "physiotherapist", scores: [4] }, payload);
    expect(blocked.status).toBe(409);
    await admin.json(`/api/admin/surveys/${surveyId}/status`, { method: "POST", body: { action: "reopen" } });
    const ok = await submit({ profession: "physiotherapist", scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4] });
    expect(ok.status).toBe(201);
  });
});

describe("IA opcional", () => {
  it("sem chave configurada informa 'não configurado' e o resto do sistema funciona", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.AI_PROVIDER;
    const status = await admin.json("/api/admin/ai/status");
    expect(status.configured).toBe(false);
    const res = await admin.request("/api/admin/ai/analyze", { method: "POST", body: { surveyId } });
    expect(res.status).toBe(503);
    const dash = await admin.request(`/api/admin/dashboard?surveyId=${surveyId}`);
    expect(dash.status).toBe(200);
  });

  it("descarta IDs inventados pela IA e recalcula contagens a partir das fontes reais", async () => {
    const docs = [
      { id: "a1:open", participantId: "p1", text: "Menu difícil", meta: { profession: "physiotherapist", professionLabel: "Fisioterapeuta" } },
      { id: "a2:comment", participantId: "p2", text: "Não achei os controles", meta: { profession: "resident_neonatology", professionLabel: "Residente" } },
    ] as Json;
    const result = await analyzeFeedback({ provider: "anthropic", model: "fake", apiKey: "x" }, docs, async () => ({
      overall_summary: "ok",
      group_comparison: "ok",
      themes: [
        { category: "Navegação", title: "Localizar controles", summary: "s", kinds: ["dificuldade"], comment_ids: ["c1", "c2", "c99"] },
        { category: "Outros", title: "Inventado", summary: "s", kinds: ["critica"], comment_ids: ["c42"] },
      ],
    }));
    expect(result.themes).toHaveLength(1);
    expect(result.themes[0]!.docIds).toEqual(["a1:open", "a2:comment"]);
    expect(result.themes[0]!.count).toBe(2);
    expect(result.discardedIds).toBe(2);
    expect(buildPrompt(docs).text).toContain("[c1]");
    expect(verifyAiResult({ overall_summary: "", group_comparison: "", themes: [] }, new Map(), docs).themes).toEqual([]);
  });
});

describe("persistência após reinício do servidor", () => {
  it("dados continuam disponíveis após fechar e reabrir a conexão", async () => {
    await closePool();
    initPool(TEST_DB_URL, false);
    const fresh = new AdminClient(makeApp());
    await fresh.login();
    const d = await fresh.json(`/api/admin/dashboard?surveyId=${surveyId}`);
    expect(d.overview.completedResponses).toBeGreaterThanOrEqual(1);
    const [{ n }] = await query<{ n: number }>(`SELECT count(*) AS n FROM survey_responses`);
    expect(n).toBe(9);
  });
});

describe("convites de uso único", () => {
  let inviteSurveyId: string;
  let inviteSlug: string;
  const ALL4 = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4];

  it("pesquisa que exige convite não mostra perguntas sem código válido", async () => {
    const copy = await admin.json(`/api/admin/surveys/${surveyId}/duplicate`, { method: "POST" });
    inviteSurveyId = copy.id;
    inviteSlug = copy.slug;
    await admin.json(`/api/admin/surveys/${copy.id}/meta`, { method: "PUT", body: { requireInvite: true } });
    await admin.json(`/api/admin/surveys/${copy.id}/status`, { method: "POST", body: { action: "publish" } });
    const res = await app.request(`/api/public/surveys/${inviteSlug}`);
    const body = ((await res.json()) as Json).data;
    expect(body.acceptingResponses).toBe(false);
    expect(body.inviteStatus).toBe("missing");
    expect(body.questions).toBeUndefined();
    const bad = ((await (await app.request(`/api/public/surveys/${inviteSlug}?c=naoexiste123`)).json()) as Json).data;
    expect(bad.inviteStatus).toBe("invalid");
  });

  it("gera convites, aceita cada um uma única vez e registra o uso", async () => {
    const created = await admin.json(`/api/admin/surveys/${inviteSurveyId}/invites`, { method: "POST", body: { count: 3, label: "Lote teste" } });
    expect(created.created).toBe(3);
    const invites = await admin.json(`/api/admin/surveys/${inviteSurveyId}/invites`);
    expect(invites).toHaveLength(3);
    expect(invites[0].url).toBe(`https://avaliacao.exemplo.com/r/${inviteSlug}?c=${invites[0].code}`);
    const code = invites[0].code;

    const prevSlug = slug;
    slug = inviteSlug;
    try {
      const payload = ((await (await app.request(`/api/public/surveys/${inviteSlug}?c=${code}`)).json()) as Json).data;
      expect(payload.acceptingResponses).toBe(true);
      expect(payload.inviteRequired).toBe(true);

      const noCode = await submit({ profession: "physiotherapist", scores: ALL4 }, payload);
      expect(noCode.status).toBe(400);

      const key = idempotencyKey();
      const first = await submit({ profession: "physiotherapist", scores: ALL4, inviteCode: code, key }, payload);
      expect(first.status).toBe(201);
      // Reenvio idêntico (rede instável): continua idempotente, sem erro de convite.
      const retry = await submit({ profession: "physiotherapist", scores: ALL4, inviteCode: code, key }, payload);
      expect(retry.status).toBe(200);
      // Mesmo convite, nova resposta: recusado.
      const reuse = await submit({ profession: "physiotherapist", scores: ALL4, inviteCode: code }, payload);
      expect(reuse.status).toBe(409);
      const used = ((await (await app.request(`/api/public/surveys/${inviteSlug}?c=${code}`)).json()) as Json).data;
      expect(used.inviteStatus).toBe("used");

      // Convite revogado não serve mais.
      await admin.json(`/api/admin/surveys/${inviteSurveyId}/invites/${invites[1].id}/revoke`, { method: "POST" });
      const revoked = await submit({ profession: "physiotherapist", scores: ALL4, inviteCode: invites[1].code }, payload);
      expect(revoked.status).toBe(409);
    } finally {
      slug = prevSlug;
    }

    const list = await admin.json("/api/admin/surveys");
    const s = list.find((x: Json) => x.id === inviteSurveyId);
    expect(s.requireInvite).toBe(true);
    expect(s.invitesUsed).toBe(1);
    expect(s.invitesTotal).toBe(2);
  });

  it("exporta convites em CSV e folha de QR Codes em PDF", async () => {
    const csv = await (await admin.request(`/api/admin/surveys/${inviteSurveyId}/invites.csv`)).text();
    expect(csv).toContain("utilizado");
    expect(csv).toContain("revogado");
    expect(csv).toContain("disponível");
    const pdf = await admin.request(`/api/admin/surveys/${inviteSurveyId}/invites/qr.pdf`);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
