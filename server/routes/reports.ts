/** Downloads de relatórios: PDF, Excel e CSV (sempre com os mesmos filtros das telas). */
import { Hono } from "hono";
import { z } from "zod";
import { audit } from "../auth.ts";
import type { AppEnv } from "../context.ts";
import { loadDataset } from "../services/dataset.ts";
import { buildCsv } from "../services/exports/csv.ts";
import { buildPdf } from "../services/exports/pdf.ts";
import { buildReportData } from "../services/exports/reportData.ts";
import { buildXlsx } from "../services/exports/xlsx.ts";
import { parseFilters } from "./adminData.ts";

const stamp = () => new Date().toISOString().slice(0, 10);

export function createReportRoutes() {
  const app = new Hono<AppEnv>();

  app.get("/api/admin/reports/pdf", async (c) => {
    const ds = await loadDataset(parseFilters(c));
    const pdf = await buildPdf(await buildReportData(ds));
    await audit(c.get("admin").id, "export_pdf", { entity: "survey", entityId: ds.survey.id, ipHash: c.get("ipHash") });
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="relatorio-ivent-${ds.survey.slug}-${stamp()}.pdf"`);
    return c.body(new Uint8Array(pdf));
  });

  app.get("/api/admin/reports/xlsx", async (c) => {
    const ds = await loadDataset(parseFilters(c));
    const xlsx = await buildXlsx(await buildReportData(ds));
    await audit(c.get("admin").id, "export_xlsx", { entity: "survey", entityId: ds.survey.id, ipHash: c.get("ipHash") });
    c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    c.header("Content-Disposition", `attachment; filename="avaliacao-ivent-${ds.survey.slug}-${stamp()}.xlsx"`);
    return c.body(new Uint8Array(xlsx));
  });

  app.get("/api/admin/reports/csv", async (c) => {
    const kind = z.enum(["respostas", "comentarios", "estatisticas"]).catch("respostas").parse(c.req.query("kind"));
    const ds = await loadDataset(parseFilters(c));
    const csv = buildCsv(ds, kind);
    await audit(c.get("admin").id, "export_csv", { entity: "survey", entityId: ds.survey.id, details: { kind }, ipHash: c.get("ipHash") });
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${kind}-ivent-${ds.survey.slug}-${stamp()}.csv"`);
    return c.body(csv);
  });

  return app;
}
