/** Gerenciador de questionários (área administrativa). */
import { Hono } from "hono";
import QRCode from "qrcode";
import { z } from "zod";
import { audit } from "../auth.ts";
import type { AppEnv } from "../context.ts";
import { ok, readJson } from "../http.ts";
import {
  changeStatus,
  createSurvey,
  deleteDraftSurvey,
  duplicateSurvey,
  getSurveyDetail,
  getVersionQuestions,
  listSurveys,
  updateSurveyContent,
  updateSurveyMeta,
  type StatusAction,
} from "../services/surveys.ts";
import { surveyContentSchema, surveyCreateSchema, surveyMetaSchema } from "../validation.ts";
import { publicSurveyPayload } from "./public.ts";

const idParam = z.uuid();

export function publicUrlFor(c: { req: { url: string; header: (n: string) => string | undefined } }, slug: string, base: string | null): string {
  if (base) return `${base}/r/${slug}`;
  // Sem URL configurada (desenvolvimento): usa a origem da própria requisição, nunca X-Forwarded-Host.
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}/r/${slug}`;
}

export function createAdminSurveyRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/api/admin/surveys", async (c) => {
    const base = c.get("config").publicBaseUrl;
    const surveys = await listSurveys();
    return ok(c, surveys.map((s) => ({ ...s, publicUrl: publicUrlFor(c, s.slug, base) })));
  });

  app.post("/api/admin/surveys", async (c) => {
    // Conteúdo e metadados validados juntos antes de gravar: nada é criado pela metade.
    const { meta, ...content } = await readJson(c, surveyCreateSchema);
    const id = await createSurvey(content);
    if (meta) await updateSurveyMeta(id, meta);
    await audit(c.get("admin").id, "survey_created", { entity: "survey", entityId: id, ipHash: c.get("ipHash") });
    return ok(c, await getSurveyDetail(id), 201);
  });

  app.get("/api/admin/surveys/:id", async (c) => {
    const detail = await getSurveyDetail(idParam.parse(c.req.param("id")));
    return ok(c, { ...detail, publicUrl: publicUrlFor(c, detail.slug, c.get("config").publicBaseUrl) });
  });

  app.get("/api/admin/surveys/:id/versions/:versionId/questions", async (c) => {
    idParam.parse(c.req.param("id"));
    return ok(c, await getVersionQuestions(idParam.parse(c.req.param("versionId"))));
  });

  /** Prévia: o mesmo payload que o participante recebe, mesmo antes de publicar. */
  app.get("/api/admin/surveys/:id/preview", async (c) => {
    return ok(c, await publicSurveyPayload({ id: idParam.parse(c.req.param("id")) }));
  });

  app.put("/api/admin/surveys/:id/content", async (c) => {
    const id = idParam.parse(c.req.param("id"));
    const content = await readJson(c, surveyContentSchema);
    const result = await updateSurveyContent(id, content);
    await audit(c.get("admin").id, result.versionCreated ? "survey_version_created" : "survey_updated", {
      entity: "survey",
      entityId: id,
      details: { versionNumber: result.versionNumber },
      ipHash: c.get("ipHash"),
    });
    return ok(c, { ...result, survey: await getSurveyDetail(id) });
  });

  app.put("/api/admin/surveys/:id/meta", async (c) => {
    const id = idParam.parse(c.req.param("id"));
    await updateSurveyMeta(id, await readJson(c, surveyMetaSchema));
    await audit(c.get("admin").id, "survey_meta_updated", { entity: "survey", entityId: id, ipHash: c.get("ipHash") });
    return ok(c, await getSurveyDetail(id));
  });

  app.post("/api/admin/surveys/:id/status", async (c) => {
    const id = idParam.parse(c.req.param("id"));
    const { action } = await readJson(c, z.object({ action: z.enum(["publish", "close", "reopen", "archive", "unarchive"]) }));
    const status = await changeStatus(id, action as StatusAction);
    await audit(c.get("admin").id, `survey_${action}`, { entity: "survey", entityId: id, ipHash: c.get("ipHash") });
    return ok(c, { status });
  });

  app.post("/api/admin/surveys/:id/duplicate", async (c) => {
    const id = idParam.parse(c.req.param("id"));
    const newId = await duplicateSurvey(id);
    await audit(c.get("admin").id, "survey_duplicated", { entity: "survey", entityId: newId, details: { from: id }, ipHash: c.get("ipHash") });
    return ok(c, await getSurveyDetail(newId), 201);
  });

  app.delete("/api/admin/surveys/:id", async (c) => {
    const id = idParam.parse(c.req.param("id"));
    await deleteDraftSurvey(id);
    await audit(c.get("admin").id, "survey_deleted", { entity: "survey", entityId: id, ipHash: c.get("ipHash") });
    return ok(c, { deleted: true });
  });

  app.get("/api/admin/surveys/:id/qr.png", async (c) => {
    const detail = await getSurveyDetail(idParam.parse(c.req.param("id")));
    const url = publicUrlFor(c, detail.slug, c.get("config").publicBaseUrl);
    const png = await QRCode.toBuffer(url, { type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M", color: { dark: "#1a2230", light: "#ffffff" } });
    c.header("Content-Type", "image/png");
    c.header("Cache-Control", "no-store");
    if (c.req.query("download")) c.header("Content-Disposition", `attachment; filename="qrcode-${detail.slug}.png"`);
    return c.body(new Uint8Array(png));
  });

  return app;
}
