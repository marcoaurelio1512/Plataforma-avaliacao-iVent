-- Perguntas do perfil passam a ser configuráveis (Configurações → Tela de perfil):
-- as respostas vão para um JSON por participante, { chave: código | [códigos] | texto }.
ALTER TABLE participants ADD COLUMN profile_answers JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE participants
   SET profile_answers = jsonb_strip_nulls(jsonb_build_object(
         'experienceYears', experience_years,
         'simulatorExperience', simulator_experience,
         'iventExperience', ivent_experience));

ALTER TABLE participants
  DROP COLUMN experience_years,
  DROP COLUMN simulator_experience,
  DROP COLUMN ivent_experience;

-- A pergunta de categoria profissional pode ser apagada: participantes sem profissão.
ALTER TABLE participants ALTER COLUMN profession_code DROP NOT NULL;
