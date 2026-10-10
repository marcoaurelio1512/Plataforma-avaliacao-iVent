-- iVent NeoPed — Avaliação: esquema inicial.
-- Convenções: UUID gerado no banco, timestamps com fuso, textos originais
-- preservados exatamente como enviados (nenhuma coluna de texto é reescrita).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AdminUser ------------------------------------------------------------------
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX admin_users_email_uq ON admin_users (lower(email));

CREATE TABLE admin_sessions (
  token_hash  TEXT PRIMARY KEY,
  admin_id    UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX admin_sessions_expires_idx ON admin_sessions (expires_at);

-- Categorias profissionais (extensível pelo admin) -----------------------------
CREATE TABLE professional_categories (
  code       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  position   INT  NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IventVersion ----------------------------------------------------------------
CREATE TABLE ivent_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  released_at DATE,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ivent_versions_label_uq ON ivent_versions (lower(label));

-- Survey ------------------------------------------------------------------------
CREATE TABLE surveys (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Chave estável para o seed idempotente (NULL em pesquisas criadas pelo admin).
  seed_key           TEXT UNIQUE,
  slug               TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  ivent_version_id   UUID REFERENCES ivent_versions(id) ON DELETE SET NULL,
  current_version_id UUID,
  -- Campos para uso científico futuro (todos opcionais).
  consent_text       TEXT,
  participant_info   TEXT,
  protocol_number    TEXT,
  institution        TEXT,
  lead_researcher    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at       TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ
);
CREATE INDEX surveys_status_idx ON surveys (status);

-- SurveyVersion: snapshot imutável depois que recebe a primeira resposta ---------
CREATE TABLE survey_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id      UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  version_number INT  NOT NULL,
  title          TEXT NOT NULL,
  instructions   TEXT NOT NULL DEFAULT '',
  open_section_title TEXT NOT NULL DEFAULT 'Sua opinião',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id, version_number)
);
ALTER TABLE surveys
  ADD CONSTRAINT surveys_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES survey_versions(id) ON DELETE SET NULL;

-- Question -----------------------------------------------------------------------
CREATE TABLE questions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_version_id    UUID NOT NULL REFERENCES survey_versions(id) ON DELETE CASCADE,
  position             INT  NOT NULL,
  -- Identidade estável entre versões: base da comparação metodológica.
  question_key         TEXT NOT NULL,
  section              TEXT NOT NULL CHECK (section IN ('quantitative', 'open')),
  type                 TEXT NOT NULL CHECK (type IN
                       ('likert','numeric_scale','yes_no','single_choice','multiple_choice','short_text','long_text')),
  text                 TEXT NOT NULL,
  help_text            TEXT,
  category             TEXT,
  required             BOOLEAN NOT NULL DEFAULT false,
  allow_comment        BOOLEAN NOT NULL DEFAULT false,
  allow_not_applicable BOOLEAN NOT NULL DEFAULT false,
  allow_not_used       BOOLEAN NOT NULL DEFAULT false,
  scale_min            INT,
  scale_max            INT,
  scale_min_label      TEXT,
  scale_max_label      TEXT,
  UNIQUE (survey_version_id, question_key)
);
CREATE INDEX questions_version_position_idx ON questions (survey_version_id, position);
CREATE INDEX questions_key_idx ON questions (question_key);

-- QuestionOption -------------------------------------------------------------------
CREATE TABLE question_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    INT  NOT NULL,
  label       TEXT NOT NULL,
  value       TEXT NOT NULL,
  UNIQUE (question_id, value)
);

-- Participant: perfil anônimo, sem nome nem contato -----------------------------------
CREATE TABLE participants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_code       TEXT NOT NULL UNIQUE,
  profession_code      TEXT NOT NULL REFERENCES professional_categories(code),
  experience_years     TEXT,
  simulator_experience TEXT,
  ivent_experience     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX participants_profession_idx ON participants (profession_code);

-- SurveyResponse ------------------------------------------------------------------------
CREATE TABLE survey_responses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id         UUID NOT NULL REFERENCES surveys(id) ON DELETE RESTRICT,
  survey_version_id UUID NOT NULL REFERENCES survey_versions(id) ON DELETE RESTRICT,
  ivent_version_id  UUID REFERENCES ivent_versions(id) ON DELETE SET NULL,
  participant_id    UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  status            TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'invalidated')),
  -- Gerada pelo navegador no início: reenvios do mesmo formulário não duplicam.
  idempotency_key   TEXT NOT NULL UNIQUE,
  device_class      TEXT CHECK (device_class IN ('mobile', 'tablet', 'desktop')),
  started_at        TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX survey_responses_survey_idx ON survey_responses (survey_id, submitted_at);
CREATE INDEX survey_responses_version_idx ON survey_responses (survey_version_id);
CREATE INDEX survey_responses_ivent_idx ON survey_responses (ivent_version_id);

-- Answer -----------------------------------------------------------------------------------
CREATE TABLE answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id   UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  numeric_value NUMERIC,
  text_value    TEXT,
  choice_values TEXT[],
  special       TEXT CHECK (special IN ('not_applicable', 'not_used')),
  UNIQUE (response_id, question_id),
  -- "Não utilizei"/"Não se aplica" nunca coexistem com uma nota.
  CHECK (special IS NULL OR numeric_value IS NULL)
);
CREATE INDEX answers_question_idx ON answers (question_id);

-- AnswerComment --------------------------------------------------------------------------------
CREATE TABLE answer_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id  UUID NOT NULL UNIQUE REFERENCES answers(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WordFrequency: cache da nuvem (recalculável a partir dos textos originais) ---------------------
CREATE TABLE word_frequencies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key         TEXT NOT NULL,
  survey_id         UUID REFERENCES surveys(id) ON DELETE CASCADE,
  term_key          TEXT NOT NULL,
  label             TEXT NOT NULL,
  occurrences       INT  NOT NULL,
  participant_count INT  NOT NULL,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cache_key, term_key)
);
CREATE INDEX word_frequencies_survey_idx ON word_frequencies (survey_id);

-- TextAnalysis: resultados da análise por IA (com IDs das fontes originais) -----------------------
CREATE TABLE text_analyses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id         UUID REFERENCES surveys(id) ON DELETE CASCADE,
  survey_version_id UUID REFERENCES survey_versions(id) ON DELETE SET NULL,
  filters           JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  source_count      INT  NOT NULL,
  result            JSONB NOT NULL,
  created_by        UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX text_analyses_survey_idx ON text_analyses (survey_id, created_at DESC);

-- Configurações gerais (stopwords/expressões extras etc.) ----------------------------------------
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AuditLog ------------------------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  admin_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
