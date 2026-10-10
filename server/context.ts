/** Tipos do contexto Hono compartilhados pelas rotas. */
import type { AppConfig } from "./config.ts";

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
}

export interface AppEnv {
  Variables: {
    admin: AdminIdentity;
    ipHash: string;
    config: AppConfig;
  };
}
