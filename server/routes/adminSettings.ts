/** Configurações: categorias profissionais, versões do iVent, vocabulário da análise textual e auditoria. */
import { Hono } from "hono";
import { z } from "zod";
import { DEFAULT_PHRASES, PROTECTED_TERMS } from "../../shared/text.ts";
import { PT_STOPWORDS } from "../../shared/stopwords.ts";
import { audit } from "../auth.ts";
import type { AppEnv } from "../context.ts";
import { query, queryOne } from "../db.ts";
import { conflict, notFound, ok, readJson } from "../http.ts";
import { aiConfig } from "../services/ai.ts";
import { getTextSettings, saveTextSettings, textSettingsSchema } from "../services/textSettings.ts";

const professionSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_]{2,60}$/, "Código: letras minúsculas, números e _."),
  label: z.string().trim().min(2).max(120),
  position: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

const iventVersionSchema = z.object({
  label: z.string().trim().min(1).max(60),
  releasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().trim().max(2000).default(""),
});

export function createAdminSettingsRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/api/admin/settings", async (c) => {
    const ai = aiConfig();
    return ok(c, {
      textSettings: await getTextSettings(),
      defaults: { phrases: DEFAULT_PHRASES, protectedTerms: Object.values(PROTECTED_TERMS), stopwordCount: PT_STOPWORDS.size },
      ai: ai ? { configured: true, provider: ai.provider, model: ai.model } : { configured: false },
      publicBaseUrl: c.get("config").publicBaseUrl,
    });
  });

  app.put("/api/admin/settings/text", async (c) => {
    const settings = await readJson(c, textSettingsSchema);
    await saveTextSettings(settings);
    await audit(c.get("admin").id, "text_settings_updated", { ipHash: c.get("ipHash") });
    return ok(c, settings);
  });

  app.get("/api/admin/professions", async (c) => {
    const rows = await query<{ code: string; label: string; position: number; active: boolean; participants: number }>(
      `SELECT pc.code, pc.label, pc.position, pc.active, (SELECT count(*) FROM participants p WHERE p.profession_code = pc.code) AS participants
         FROM professional_categories pc ORDER BY pc.position, pc.label`,
    );
    return ok(c, rows);
  });

  app.post("/api/admin/professions", async (c) => {
    const p = await readJson(c, professionSchema);
    const inserted = await query(`INSERT INTO professional_categories (code, label, position, active) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING code`, [
      p.code, p.label, p.position, p.active,
    ]);
    if (!inserted.length) throw conflict("Já existe uma categoria com este código.");
    await audit(c.get("admin").id, "profession_created", { entity: "profession", entityId: p.code, ipHash: c.get("ipHash") });
    return ok(c, p, 201);
  });

  // O código não muda (respostas antigas o referenciam); rótulo, ordem e ativação sim.
  app.put("/api/admin/professions/:code", async (c) => {
    const code = c.req.param("code");
    const p = await readJson(c, professionSchema.omit({ code: true }));
    const updated = await query(`UPDATE professional_categories SET label = $2, position = $3, active = $4 WHERE code = $1 RETURNING code`, [
      code, p.label, p.position, p.active,
    ]);
    if (!updated.length) throw notFound("Categoria não encontrada.");
    await audit(c.get("admin").id, "profession_updated", { entity: "profession", entityId: code, ipHash: c.get("ipHash") });
    return ok(c, { code, ...p });
  });

  app.get("/api/admin/ivent-versions", async (c) => {
    const rows = await query<{ id: string; label: string; released_at: Date | null; notes: string; surveys: number; responses: number }>(
      `SELECT v.id, v.label, v.released_at, v.notes,
              (SELECT count(*) FROM surveys s WHERE s.ivent_version_id = v.id) AS surveys,
              (SELECT count(*) FROM survey_responses r WHERE r.ivent_version_id = v.id AND r.status = 'submitted') AS responses
         FROM ivent_versions v ORDER BY COALESCE(v.released_at, v.created_at::date), v.created_at`,
    );
    return ok(c, rows.map((r) => ({ id: r.id, label: r.label, releasedAt: r.released_at ? r.released_at.toISOString().slice(0, 10) : null, notes: r.notes, surveys: r.surveys, responses: r.responses })));
  });

  app.post("/api/admin/ivent-versions", async (c) => {
    const v = await readJson(c, iventVersionSchema);
    const row = await queryOne<{ id: string }>(`INSERT INTO ivent_versions (label, released_at, notes) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`, [
      v.label, v.releasedAt ?? null, v.notes,
    ]);
    if (!row) throw conflict("Já existe uma versão com este nome.");
    await audit(c.get("admin").id, "ivent_version_created", { entity: "ivent_version", entityId: row.id, ipHash: c.get("ipHash") });
    return ok(c, { id: row.id, ...v }, 201);
  });

  app.put("/api/admin/ivent-versions/:id", async (c) => {
    const id = z.uuid().parse(c.req.param("id"));
    const v = await readJson(c, iventVersionSchema);
    try {
      const updated = await query(`UPDATE ivent_versions SET label = $2, released_at = $3, notes = $4 WHERE id = $1 RETURNING id`, [id, v.label, v.releasedAt ?? null, v.notes]);
      if (!updated.length) throw notFound("Versão não encontrada.");
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw conflict("Já existe uma versão com este nome.");
      throw error;
    }
    await audit(c.get("admin").id, "ivent_version_updated", { entity: "ivent_version", entityId: id, ipHash: c.get("ipHash") });
    return ok(c, { id, ...v });
  });

  app.get("/api/admin/audit", async (c) => {
    const rows = await query<{ id: number; action: string; entity: string | null; entity_id: string | null; details: unknown; created_at: Date; email: string | null }>(
      `SELECT l.id, l.action, l.entity, l.entity_id, l.details, l.created_at, a.email
         FROM audit_logs l LEFT JOIN admin_users a ON a.id = l.admin_id ORDER BY l.created_at DESC LIMIT 200`,
    );
    return ok(c, rows.map((r) => ({ id: r.id, action: r.action, entity: r.entity, entityId: r.entity_id, details: r.details, createdAt: r.created_at.toISOString(), adminEmail: r.email })));
  });

  return app;
}
