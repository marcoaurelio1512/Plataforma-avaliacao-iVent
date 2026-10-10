-- Convites de uso único: garantem uma resposta por convite sem identificar a pessoa.
ALTER TABLE surveys ADD COLUMN require_invite BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE survey_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id   UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,
  -- Rótulo opcional do administrador (ex.: "Lote sala 2"). Evite nomes de pessoas.
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at     TIMESTAMPTZ,
  response_id UUID REFERENCES survey_responses(id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX survey_invites_survey_idx ON survey_invites (survey_id, created_at);
