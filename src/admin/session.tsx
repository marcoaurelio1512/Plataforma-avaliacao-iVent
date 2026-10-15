/**
 * Usuário logado e o que o perfil dele pode fazer.
 * A interface só esconde ações; quem garante as permissões é o servidor (enforceAccess).
 */
import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "../../shared/domain.ts";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
}

interface Session {
  user: AdminUser;
  /** Administrador: cria e altera pesquisas, configurações e usuários. */
  canManage: boolean;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ user, children }: { user: AdminUser; children: ReactNode }) {
  return <SessionContext.Provider value={{ user, canManage: user.role === "admin" }}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession fora de SessionProvider.");
  return session;
}
