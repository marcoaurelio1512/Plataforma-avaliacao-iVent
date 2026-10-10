/** Convites de uso único: geração, revogação, CSV e folha de QR Codes para impressão. */
import { Hono } from "hono";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { z } from "zod";
import { toCsv } from "../../shared/spreadsheetSafe.ts";
import { audit } from "../auth.ts";
import type { AppEnv } from "../context.ts";
import { ok, readJson } from "../http.ts";
import { pdfText } from "../services/exports/pdf.ts";
import { createInvites, listInvites, revokeInvite } from "../services/invites.ts";
import { getSurveyDetail } from "../services/surveys.ts";
import { publicUrlFor } from "./adminSurveys.ts";

const idParam = z.uuid();

export function createAdminInviteRoutes() {
  const app = new Hono<AppEnv>();

  const inviteUrl = (c: Parameters<typeof publicUrlFor>[0], slug: string, code: string, base: string | null) => `${publicUrlFor(c, slug, base)}?c=${code}`;

  app.get("/api/admin/surveys/:id/invites", async (c) => {
    const survey = await getSurveyDetail(idParam.parse(c.req.param("id")));
    const base = c.get("config").publicBaseUrl;
    const invites = await listInvites(survey.id);
    return ok(c, invites.map((i) => ({ ...i, url: inviteUrl(c, survey.slug, i.code, base) })));
  });

  app.post("/api/admin/surveys/:id/invites", async (c) => {
    const id = idParam.parse(c.req.param("id"));
    const body = await readJson(c, z.object({ count: z.number().int().min(1).max(500), label: z.string().trim().max(80).nullish() }));
    const created = await createInvites(id, body.count, body.label || null);
    await audit(c.get("admin").id, "invites_created", { entity: "survey", entityId: id, details: { count: created }, ipHash: c.get("ipHash") });
    return ok(c, { created }, 201);
  });

  app.post("/api/admin/surveys/:id/invites/:inviteId/revoke", async (c) => {
    const id = idParam.parse(c.req.param("id"));
    const inviteId = idParam.parse(c.req.param("inviteId"));
    await revokeInvite(id, inviteId);
    await audit(c.get("admin").id, "invite_revoked", { entity: "survey_invite", entityId: inviteId, ipHash: c.get("ipHash") });
    return ok(c, { revoked: true });
  });

  app.get("/api/admin/surveys/:id/invites.csv", async (c) => {
    const survey = await getSurveyDetail(idParam.parse(c.req.param("id")));
    const base = c.get("config").publicBaseUrl;
    const invites = await listInvites(survey.id);
    const status = (i: (typeof invites)[number]) => (i.revokedAt ? "revogado" : i.usedAt ? "utilizado" : "disponível");
    const csv = toCsv(
      ["codigo", "link", "rotulo", "situacao", "criado_em", "utilizado_em"],
      invites.map((i) => [i.code, inviteUrl(c, survey.slug, i.code, base), i.label, status(i), i.createdAt, i.usedAt]),
    );
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="convites-${survey.slug}.csv"`);
    return c.body(csv);
  });

  /** Folha A4 com 8 cartões recortáveis (QR + link curto), apenas convites disponíveis. */
  app.get("/api/admin/surveys/:id/invites/qr.pdf", async (c) => {
    const survey = await getSurveyDetail(idParam.parse(c.req.param("id")));
    const base = c.get("config").publicBaseUrl;
    const invites = (await listInvites(survey.id)).filter((i) => !i.usedAt && !i.revokedAt);
    const doc = new PDFDocument({ size: "A4", margin: 36, info: { Title: `Convites — ${survey.title}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (b: Buffer) => chunks.push(b));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
    const cols = 2;
    const rows = 4;
    const cardW = (595.28 - 72) / cols;
    const cardH = (841.89 - 72) / rows;
    if (!invites.length) doc.fontSize(12).text("Não há convites disponíveis para imprimir.");
    for (const [n, inv] of invites.entries()) {
      if (n > 0 && n % (cols * rows) === 0) doc.addPage();
      const slot = n % (cols * rows);
      const x = 36 + (slot % cols) * cardW;
      const y = 36 + Math.floor(slot / cols) * cardH;
      const url = inviteUrl(c, survey.slug, inv.code, base);
      const png = await QRCode.toBuffer(url, { width: 400, margin: 1, errorCorrectionLevel: "M" });
      doc.save().dash(3, { space: 3 }).lineWidth(0.5).strokeColor("#9aa6b8").rect(x + 4, y + 4, cardW - 8, cardH - 8).stroke().restore();
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a2230").text("iVent NeoPed — Avaliação", x + 16, y + 16, { width: cardW - 32 });
      doc.font("Helvetica").fontSize(7.5).fillColor("#4a586e").text(pdfText(survey.title), x + 16, y + 30, { width: cardW - 32, height: 20, ellipsis: true });
      const qr = 112;
      doc.image(png, x + (cardW - qr) / 2, y + 52, { width: qr, height: qr });
      doc.font("Helvetica").fontSize(7).fillColor("#1a2230").text("Convite individual · uso único · resposta anônima", x + 16, y + 52 + qr + 6, { width: cardW - 32, align: "center" });
      doc.font("Courier").fontSize(7).fillColor("#4a586e").text(url, x + 16, y + 52 + qr + 18, { width: cardW - 32, align: "center" });
    }
    doc.end();
    const pdf = await done;
    await audit(c.get("admin").id, "invites_qr_sheet", { entity: "survey", entityId: survey.id, details: { count: invites.length }, ipHash: c.get("ipHash") });
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="convites-qr-${survey.slug}.pdf"`);
    return c.body(new Uint8Array(pdf));
  });

  return app;
}
