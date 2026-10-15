/** Tipos do contexto Hono compartilhados pelas rotas. */
import type { UserRole } from "../shared/domain.ts";
import type { AppConfig } from "./config.ts";

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AppEnv {
  Variables: {
    admin: AdminIdentity;
    ipHash: string;
    config: AppConfig;
  };
}
