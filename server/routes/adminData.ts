/** Rotas de análise (dashboard, respostas, textos, nuvem, grupos, versões, IA). */
import { Hono, type Context } from "hono";
import { z } from "zod";
import { PHYSIO, RESIDENT, isQuantitative } from "../../shared/domain.ts";
import { profileOptionLabel } from "../../shared/profileForm.ts";
import { buildWordCloud } from "../../shared/text.ts";
import { PRIORITY_FORMULA } from "../../shared/themes.ts";
import { audit } from "../auth.ts";
import type { AppEnv } from "../context.ts";
import { query, queryOne } from "../db.ts";
import { HttpError, notFound, ok, readJson, tooManyRequests } from "../http.ts";
import { RateLimiter } from "../security.ts";
import { aiConfig, analyzeFeedback, type AiAnalysisResult } from "../services/ai.ts";
import { compareProfessions, overview, questionStats, textDocuments, timeline, type TextMeta } from "../services/analytics.ts";
import { loadDataset, type Dataset } from "../services/dataset.ts";
import { latestAiAnalysis, professionLabels } from "../services/exports/reportData.ts";
import { computePriorities, keywordThemeAssignments } from "../services/priorities.ts";
import { getTextSettings } from "../services/textSettings.ts";
import { versionEvolution } from "../services/versions.ts";
import { cloudCacheKey, computeCloud, storeFrequencies } from "../services/wordcloud.ts";
import { analysisFiltersSchema, type AnalysisFilters } from "../validation.ts";

const aiLimiter = new RateLimiter(10, 60 * 60 * 1000);

export function parseFilters(c: Context): AnalysisFilters {
  const raw = Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v !== "" && v !== undefined));
  return analysisFiltersSchema.parse(raw);
}

async function versionOptions(surveyId: string) {
  return query<{ id: string; version_number: number; response_count: number }>(
    `SELECT v.id, v.version_number,
            (SELECT count(*) FROM survey_responses r WHERE r.survey_version_id = v.id AND r.status = 'submitted') AS response_count
       FROM survey_versions v WHERE v.survey_id = $1 ORDER BY v.version_number DESC`,
    [surveyId],
  );
}

function docView(d: { id: string; participantId: string; text: string; meta: TextMeta }) {
  return { id: d.id, text: d.text, ...d.meta };
}

async function priorityBundle(ds: Dataset, preferAi: boolean) {
  const docs = textDocuments(ds);
  const ai = preferAi ? await latestAiAnalysis(ds.version.id) : null;
  const assignments = ai ? ai.result.themes.map((t) => ({ theme: t.category, docIds: t.docIds })) : keywordThemeAssignments(docs);
  return { source: ai ? "ai" : "keywords", formula: PRIORITY_FORMULA, items: computePriorities(ds, docs, assignments) };
}

export function createAdminDataRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/api/admin/dashboard", async (c) => {
    const filters = parseFilters(c);
    const ds = await loadDataset(filters);
    const stats = questionStats(ds.questions, ds.responses);
    const ranked = stats.filter((s) => s.scale && s.scale.mean !== null && s.type === "likert").sort((a, b) => b.scale!.mean! - a.scale!.mean!);
    const labels = await professionLabels();
    return ok(c, {
      survey: ds.survey,
      version: ds.version,
      versions: (await versionOptions(ds.survey.id)).map((v) => ({ id: v.id, number: v.version_number, responseCount: v.response_count })),
      overview: overview(ds),
      stats,
      top: ranked.slice(0, 3).map((s) => s.questionId),
      bottom: ranked.slice(-3).reverse().map((s) => s.questionId),
      timeline: timeline(ds),
      groups: compareProfessions(ds, RESIDENT, PHYSIO, labels),
      priorities: await priorityBundle(ds, c.req.query("prioritySource") !== "keywords"),
    });
  });

  app.get("/api/admin/priorities/docs", async (c) => {
    const ds = await loadDataset(parseFilters(c));
    const ids = new Set((c.req.query("ids") ?? "").split(",").filter(Boolean).slice(0, 2000));
    return ok(c, textDocuments(ds).filter((d) => ids.has(d.id)).map(docView));
  });

  app.get("/api/admin/participants", async (c) => {
    const ds = await loadDataset(parseFilters(c));
    const count = (pick: (r: Dataset["responses"][number]) => string) => {
      const map = new Map<string, number>();
      for (const r of ds.responses) map.set(pick(r), (map.get(pick(r)) ?? 0) + 1);
      return [...map.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
    };
    return ok(c, {
      participants: ds.responses.map((r) => ({
        code: r.participantCode,
        responseId: r.id,
        profession: r.professionLabel,
        experienceYears: profileOptionLabel(ds.profileForm, "experienceYears", r.experienceYears),
        simulatorExperience: profileOptionLabel(ds.profileForm, "simulatorExperience", r.simulatorExperience),
        iventExperience: profileOptionLabel(ds.profileForm, "iventExperience", r.iventExperience),
        deviceClass: r.deviceClass,
        submittedAt: r.submittedAt.toISOString(),
      })),
      distributions: {
        profession: count((r) => r.professionLabel),
        experienceYears: count((r) => profileOptionLabel(ds.profileForm, "experienceYears", r.experienceYears)),
        simulatorExperience: count((r) => profileOptionLabel(ds.profileForm, "simulatorExperience", r.simulatorExperience)),
        iventExperience: count((r) => profileOptionLabel(ds.profileForm, "iventExperience", r.iventExperience)),
        device: count((r) => r.deviceClass ?? "Não informado"),
      },
    });
  });

  app.get("/api/admin/responses", async (c) => {
    const ds = await loadDataset(parseFilters(c));
    return ok(c, {
      version: ds.version,
      questions: ds.questions,
      responses: ds.responses.map((r) => ({
        id: r.id,
        participantCode: r.participantCode,
        profession: r.professionLabel,
        submittedAt: r.submittedAt.toISOString(),
        deviceClass: r.deviceClass,
        iventVersionLabel: r.iventVersionLabel,
        answers: ds.questions.map((q) => {
          const a = r.answers.get(q.id!);
          return { questionId: q.id, numeric: a?.numeric ?? null, text: a?.text ?? null, choices: a?.choices ?? null, special: a?.special ?? null, comment: a?.comment ?? null };
        }),
      })),
    });
  });

  app.get("/api/admin/comments", async (c) => {
    const filters = parseFilters(c);
    const ds = await loadDataset(filters);
    const kind = c.req.query("kind");
    const sort = c.req.query("sort") ?? "recent";
    let docs = textDocuments(ds, { questionKey: filters.questionKey, search: filters.search });
    if (kind === "open" || kind === "comment") docs = docs.filter((d) => d.meta.kind === kind);
    const sorted = [...docs].sort((a, b) => {
      if (sort === "oldest") return a.meta.submittedAt.localeCompare(b.meta.submittedAt);
      if (sort === "profession") return a.meta.professionLabel.localeCompare(b.meta.professionLabel, "pt-BR");
      if (sort === "question") return a.meta.questionKey.localeCompare(b.meta.questionKey);
      if (sort === "length") return b.text.length - a.text.length;
      return b.meta.submittedAt.localeCompare(a.meta.submittedAt);
    });
    return ok(c, {
      total: sorted.length,
      questions: ds.questions.filter((q) => q.section === "open" || q.allowComment).map((q) => ({ key: q.key, text: q.text })),
      items: sorted.slice(0, 3000).map(docView),
    });
  });

  app.get("/api/admin/wordcloud", async (c) => {
    const filters = parseFilters(c);
    const ds = await loadDataset(filters);
    const settings = await getTextSettings();
    const terms = computeCloud(ds, settings, filters.questionKey);
    const cacheKey = cloudCacheKey(ds, settings, filters.questionKey);
    await storeFrequencies(ds, cacheKey, terms);
    const limit = Math.min(Number(c.req.query("limit") ?? 120) || 120, 300);
    return ok(c, {
      cacheKey,
      documents: textDocuments(ds, { questionKey: filters.questionKey }).length,
      questions: ds.questions.filter((q) => q.section === "open" || q.allowComment).map((q) => ({ key: q.key, text: q.text })),
      terms: terms.slice(0, limit).map((t) => ({
        key: t.key,
        label: t.label,
        occurrences: t.occurrences,
        participants: t.participants,
        byProfession: Object.entries(
          t.sources.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.meta.professionLabel]: (acc[s.meta.professionLabel] ?? 0) + 1 }), {}),
        ).map(([label, docs]) => ({ label, docs })),
      })),
    });
  });

  app.get("/api/admin/wordcloud/term", async (c) => {
    const filters = parseFilters(c);
    const key = z.string().min(1).max(200).parse(c.req.query("key"));
    const ds = await loadDataset(filters);
    const term = computeCloud(ds, await getTextSettings(), filters.questionKey).find((t) => t.key === key);
    if (!term) throw notFound("Termo não encontrado com os filtros atuais.");
    return ok(c, {
      key: term.key,
      label: term.label,
      occurrences: term.occurrences,
      participants: term.participants,
      sources: term.sources.map((s) => ({ ...docView({ id: s.docId, participantId: s.participantId, text: s.text, meta: s.meta }), ranges: s.ranges })),
    });
  });

  app.get("/api/admin/compare", async (c) => {
    const filters = parseFilters(c);
    const ds = await loadDataset({ ...filters, profession: undefined });
    const labels = await professionLabels();
    const a = c.req.query("a") || RESIDENT;
    const b = c.req.query("b") || PHYSIO;
    const settings = await getTextSettings();
    const docs = textDocuments(ds, { questionKey: filters.questionKey });
    const side = (code: string) => {
      const groupDocs = docs.filter((d) => d.meta.profession === code);
      const themes = keywordThemeAssignments(groupDocs).map((t) => ({ theme: t.theme, comments: t.docIds.length })).sort((x, y) => y.comments - x.comments);
      return {
        topWords: buildWordCloud(groupDocs, settings).slice(0, 25).map((t) => ({ key: t.key, label: t.label, occurrences: t.occurrences, participants: t.participants })),
        themes,
        comments: groupDocs.slice(0, 200).map(docView),
        commentCount: groupDocs.length,
      };
    };
    return ok(c, {
      professions: [...labels.entries()].map(([code, label]) => ({ code, label })),
      result: compareProfessions(ds, a, b, labels),
      sideA: side(a),
      sideB: side(b),
    });
  });

  app.get("/api/admin/versions/evolution", async (c) => {
    const profession = c.req.query("profession") || undefined;
    return ok(c, await versionEvolution({ profession }));
  });

  app.get("/api/admin/ai/status", (c) => {
    const cfg = aiConfig();
    return ok(c, cfg ? { configured: true, provider: cfg.provider, model: cfg.model } : { configured: false });
  });

  app.post("/api/admin/ai/analyze", async (c) => {
    const cfg = aiConfig();
    if (!cfg) throw new HttpError(503, "ai_not_configured", "Análise por IA não configurada (defina ANTHROPIC_API_KEY ou AI_PROVIDER/AI_API_KEY).");
    const admin = c.get("admin");
    if (!aiLimiter.take(admin.id)) throw tooManyRequests("Limite de análises por hora atingido.");
    const filters = analysisFiltersSchema.parse(await readJson(c, z.record(z.string(), z.unknown())));
    const ds = await loadDataset(filters);
    const docs = textDocuments(ds, { questionKey: filters.questionKey });
    const result = await analyzeFeedback(cfg, docs);
    const row = await queryOne<{ id: string; created_at: Date }>(
      `INSERT INTO text_analyses (survey_id, survey_version_id, filters, provider, model, source_count, result, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at`,
      [ds.survey.id, ds.version.id, JSON.stringify(filters), cfg.provider, cfg.model, docs.length, JSON.stringify(result), admin.id],
    );
    await audit(admin.id, "ai_analysis", { entity: "text_analysis", entityId: row!.id, details: { sources: docs.length }, ipHash: c.get("ipHash") });
    return ok(c, { id: row!.id, createdAt: row!.created_at.toISOString(), provider: cfg.provider, model: cfg.model, sourceCount: docs.length, result }, 201);
  });

  app.get("/api/admin/ai/analyses", async (c) => {
    const surveyId = z.uuid().parse(c.req.query("surveyId"));
    const rows = await query<{ id: string; created_at: Date; provider: string; model: string; source_count: number; filters: unknown; version_number: number | null }>(
      `SELECT t.id, t.created_at, t.provider, t.model, t.source_count, t.filters, v.version_number
         FROM text_analyses t LEFT JOIN survey_versions v ON v.id = t.survey_version_id
        WHERE t.survey_id = $1 ORDER BY t.created_at DESC LIMIT 50`,
      [surveyId],
    );
    return ok(c, rows.map((r) => ({ id: r.id, createdAt: r.created_at.toISOString(), provider: r.provider, model: r.model, sourceCount: r.source_count, filters: r.filters, versionNumber: r.version_number })));
  });

  /** Resultado + comentários originais que fundamentam cada tema (lidos do banco). */
  app.get("/api/admin/ai/analyses/:id", async (c) => {
    const id = z.uuid().parse(c.req.param("id"));
    const row = await queryOne<{ survey_id: string; survey_version_id: string; result: AiAnalysisResult; created_at: Date; provider: string; model: string; source_count: number }>(
      `SELECT survey_id, survey_version_id, result, created_at, provider, model, source_count FROM text_analyses WHERE id = $1`,
      [id],
    );
    if (!row) throw notFound("Análise não encontrada.");
    const ds = await loadDataset({ surveyId: row.survey_id, versionId: row.survey_version_id });
    const docs = new Map(textDocuments(ds).map((d) => [d.id, d]));
    return ok(c, {
      id,
      createdAt: row.created_at.toISOString(),
      provider: row.provider,
      model: row.model,
      sourceCount: row.source_count,
      result: row.result,
      sources: Object.fromEntries(
        row.result.themes.flatMap((t) => t.docIds).filter((d) => docs.has(d)).map((d) => [d, docView(docs.get(d)!)]),
      ),
    });
  });

  app.get("/api/admin/questions/scale", async (c) => {
    const ds = await loadDataset(parseFilters(c));
    return ok(c, ds.questions.filter((q) => isQuantitative(q.type)).map((q) => ({ key: q.key, text: q.text })));
  });

  return app;
}
