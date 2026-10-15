/**
 * Montagem da aplicação Hono. Separada do boot para os testes de integração
 * exercitarem a API real sem abrir porta.
 */
import { existsSync } from "node:fs";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { createAuthRoutes, enforceAccess, requireAdmin } from "./auth.ts";
import type { AppConfig } from "./config.ts";
import type { AppEnv } from "./context.ts";
import { getPool } from "./db.ts";
import { handleError, HttpError } from "./http.ts";
import { createAdminDataRoutes } from "./routes/adminData.ts";
import { createAdminSettingsRoutes } from "./routes/adminSettings.ts";
import { createAdminSurveyRoutes } from "./routes/adminSurveys.ts";
import { createAdminInviteRoutes } from "./routes/adminInvites.ts";
import { createPublicRoutes } from "./routes/public.ts";
import { createAdminUserRoutes } from "./routes/adminUsers.ts";
import { createReportRoutes } from "./routes/reports.ts";
import { clientIp, hashIp, requireCsrfHeader } from "./security.ts";

export function createApp(config: AppConfig) {
  const app = new Hono<AppEnv>();

  /*
   * CSP apertada: tudo é servido por este processo, a IA é chamada pelo
   * servidor (nunca pelo navegador) e o QR é gerado aqui. `style-src
   * 'unsafe-inline'` porque os gráficos aplicam estilo por atributo.
   */
  app.use(
    "*",
    secureHeaders({
      strictTransportSecurity: "max-age=31536000; includeSubDomains",
      xFrameOptions: "DENY",
      xContentTypeOptions: "nosniff",
      referrerPolicy: "strict-origin-when-cross-origin",
      permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    }),
  );

  app.use("*", async (c, next) => {
    c.set("config", config);
    c.set("ipHash", hashIp(clientIp(c, config.trustProxy, config.proxyHops), config.ipHashSalt));
    await next();
  });

  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 512 * 1024,
      onError: () => {
        throw new HttpError(413, "payload_too_large", "Conteúdo muito grande.");
      },
    }),
  );

  app.get("/health", async (c) => {
    try {
      await getPool().query("SELECT 1");
      return c.json({ status: "ok", db: "ok" });
    } catch {
      return c.json({ status: "degraded", db: "unreachable" }, 503);
    }
  });

  app.route("/", createPublicRoutes());
  app.use("/api/auth/*", requireCsrfHeader);
  app.route("/", createAuthRoutes());

  app.use("/api/admin/*", requireCsrfHeader, requireAdmin, enforceAccess);
  app.route("/", createAdminUserRoutes());
  app.route("/", createAdminSurveyRoutes());
  app.route("/", createAdminInviteRoutes());
  app.route("/", createAdminDataRoutes());
  app.route("/", createAdminSettingsRoutes());
  app.route("/", createReportRoutes());

  app.all("/api/*", (c) => c.json({ success: false, error: { code: "not_found", message: "Rota não encontrada." } }, 404));

  if (existsSync(config.staticRoot)) {
    app.use("/assets/*", async (c, next) => {
      await next();
      c.header("Cache-Control", "public, max-age=31536000, immutable");
    });
    // A página da aplicação é sempre revalidada, para nunca apontar para arquivos já removidos.
    app.use("*", async (c, next) => {
      await next();
      if (c.res.headers.get("content-type")?.startsWith("text/html")) c.header("Cache-Control", "no-cache");
    });
    app.use("/*", serveStatic({ root: config.staticRoot }));
    // Arquivo de uma publicação anterior: 404 claro. Devolver o index.html faria o
    // navegador tentar executar HTML como código e a tela ficaria em branco.
    app.get("/assets/*", (c) => c.text("Arquivo não encontrado.", 404));
    app.get("*", serveStatic({ root: config.staticRoot, path: "index.html" }));
  }

  app.onError(handleError);
  return app;
}
