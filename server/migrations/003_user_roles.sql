-- Vários usuários com perfis: administrador (acesso total) e pesquisador (consulta e análise).
-- Usuários existentes continuam administradores.
ALTER TABLE admin_users
  ADD COLUMN role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'researcher')),
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT true,
  -- Senha provisória definida por um administrador: troca obrigatória no próximo acesso.
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
