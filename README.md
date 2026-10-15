# iVent NeoPed — Avaliação

Plataforma web exclusiva para avaliar o simulador **iVent NeoPed**: criação de questionários, coleta anônima de respostas (celular, tablet ou computador), estatística descritiva, comparação entre grupos profissionais e entre versões do iVent, análise de textos livres (nuvem de palavras interativa e IA opcional) e relatórios em PDF, Excel e CSV.

É um **módulo independente**: não altera nenhum arquivo do iVent NeoPed. O iVent pode apenas apontar para ela por um link ou botão (veja [Integração com o iVent](#integração-com-o-ivent)).

**Produção:** <https://plataforma-avaliacao-ivent-production.up.railway.app> (painel em `/admin`).

---

## Stack

A stack segue a do iVent NeoPed, para manter manutenção e implantação iguais:

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite, CSS com os tokens de design do iVent (temas claro/escuro) |
| Gráficos | Recharts; nuvem de palavras com d3-cloud |
| Backend | Node 24 + Hono + zod |
| Banco | PostgreSQL, acessado com `pg` e migrations SQL versionadas (mesmo padrão do iVent) |
| Relatórios | PDFKit (PDF), ExcelJS (Excel), CSV UTF-8 |
| IA (opcional) | Anthropic (SDK oficial, padrão) ou endpoint compatível com OpenAI |
| Implantação | Docker + Railway |

**Desvios do que foi sugerido no pedido inicial, e por quê:**
- **Sem Prisma.** O iVent usa `pg` com SQL versionado, e este módulo mantém o mesmo padrão.
- **Sem Tailwind.** O iVent usa tokens CSS próprios, e este módulo reaproveita esses tokens para manter a identidade visual.

## Funcionalidades

- **Gerenciador de questionários**
  - Ações: criar, editar, duplicar, salvar como rascunho, publicar, encerrar, reabrir, arquivar e excluir rascunhos sem respostas.
  - Perguntas: reordenação por arrastar e soltar (mouse, toque e teclado) e prévia fiel antes de publicar.
  - Tipos de pergunta: Likert 1–5, escala numérica configurável, Sim/Não, múltipla escolha e seleção múltipla, texto curto e texto longo.
  - Opções especiais: "Não se aplica" e "Não utilizei este recurso", disponíveis em qualquer pergunta quantitativa. Ficam fora de todas as médias e nunca viram zero.
  - Campo "Comentários ou sugestões sobre este item" por pergunta.
- **Versionamento histórico.** Uma versão que já recebeu respostas nunca é alterada. Editá-la cria a versão seguinte, e as respostas antigas continuam ligadas às perguntas que de fato responderam. Enquanto não há respostas, a edição é feita no lugar, preservando o id de cada pergunta.
- **Questionário inicial**, criado automaticamente na primeira instalação com 10 perguntas Likert e 5 abertas. O seed é idempotente: rodá-lo de novo não duplica nada.
- **Experiência do participante**
  - Fluxo: Bem-vindo → Perfil → Avaliação → Sua opinião → Revisar → Enviar → Obrigado.
  - Indicador "Pergunta X de 15" e botões grandes no celular.
  - Rascunho salvo no aparelho, para não perder respostas ao recarregar a página.
  - Atalhos de teclado 1–5.
  - Participação anônima: pede apenas a categoria profissional, que é obrigatória; o restante é opcional.
- **Link e QR Code** exclusivos por pesquisa, com botões para copiar o link e baixar o QR.
- **Dashboard**
  - Indicadores: participantes, respostas, residentes, fisioterapeutas, média geral, comentários e respostas abertas.
  - Gráficos: média por pergunta (com n válido), distribuição 1–5, residentes × fisioterapeutas, destaques, evolução ao longo do tempo e versões do iVent.
- **Estatística.** Média, mediana, desvio-padrão amostral, frequências absolutas e relativas, n válido, ausentes e "Não utilizei". A comparação entre grupos é sempre descritiva, sem afirmar significância estatística.
- **Nuvem de palavras interativa**
  - Normalização: maiúsculas, acentos, pontuação, stopwords e plurais.
  - Termos técnicos preservados (PEEP, PIP, FiO₂, VAFO, EIT, NAVA…) e expressões compostas reconhecidas ("pulmão 3D", "curvas ventilatórias"…).
  - Ao clicar em um termo, aparecem os comentários originais, separando **ocorrências** de **participantes**.
  - Filtros: profissão, pergunta, período e versão. Exportação em PNG e PDF.
- **Comentários e Sugestões.** Busca por palavra, filtros, ordenação e exportação. Os textos aparecem sempre exatamente como foram escritos.
- **Análise por IA (opcional)**
  - Agrupa temas, elogios, críticas, dificuldades e sugestões, e compara os grupos.
  - A IA só pode citar comentários existentes: o servidor descarta referências inventadas e recalcula as contagens.
  - Cada tema leva às fontes originais.
- **Oportunidades de melhoria.** Fórmula transparente que combina a nota média com o volume de menções; cada item leva aos comentários que o fundamentam. É uma ferramenta operacional, não evidência científica.
- **Comparação entre versões do iVent.** Compara apenas perguntas compatíveis (mesma chave, tipo e escala) e sinaliza quando o texto mudou.
- **Relatórios**
  - PDF profissional: metodologia, estatísticas, gráficos, comparação entre grupos, nuvem, comentários, análise qualitativa, prioridades e limitações.
  - Excel com 8 abas.
  - CSV, com proteção contra *formula injection* em todo campo de texto livre.
- **Pesquisa científica.** Campos opcionais para termo de consentimento, protocolo, instituição, pesquisador responsável e informação ao participante. A plataforma não declara validação do questionário nem aprovação ética.

## Estrutura

```
server/            API Hono
  migrations/      SQL versionado (001_init.sql)
  routes/          public, adminSurveys, adminData, adminSettings, reports
  services/        surveys (versionamento), responses, dataset, analytics,
                   priorities, versions, wordcloud, ai, seed, exports/{pdf,xlsx,csv}
  test/            testes de integração (PostgreSQL real)
shared/            lógica pura compartilhada: domain, stats, text (nuvem), themes, spreadsheetSafe
src/               React (participant/ = área pública, admin/ = painel)
e2e/               testes Playwright (celular, desktop, admin, visual/acessibilidade)
scripts/backup.sh  backup lógico do PostgreSQL
```

## Banco de dados

| Tabela | Entidade | Função |
|---|---|---|
| `admin_users`, `admin_sessions` | AdminUser | Administradores (senha scrypt) e sessões (somente o hash do token é salvo) |
| `professional_categories` | — | Categorias profissionais, extensíveis pelo admin |
| `ivent_versions` | IventVersion | Versões do iVent (iVent 1.0, 1.1, 2.0…) |
| `surveys` | Survey | Pesquisa: slug público, status, versão do iVent e campos científicos opcionais |
| `survey_versions` | SurveyVersion | Retrato imutável do questionário depois da primeira resposta |
| `questions`, `question_options` | Question, QuestionOption | Perguntas, com chave estável (`question_key`) para comparar versões |
| `participants` | Participant | Perfil anônimo: código aleatório, profissão e experiência |
| `survey_responses` | SurveyResponse | Submissão: versão da pesquisa, versão do iVent, status e chave de idempotência (única) |
| `answers`, `answer_comments` | Answer, AnswerComment | Nota, texto, escolhas ou marcação especial; comentário por item |
| `word_frequencies` | WordFrequency | Cache recalculável das frequências da nuvem |
| `text_analyses` | TextAnalysis | Resultados da IA com os IDs das fontes originais |
| `app_settings` | — | Vocabulário extra da análise textual |
| `audit_logs` | AuditLog | Login, alterações, exportações e análises (o IP é guardado só como hash) |

Os índices cobrem pesquisa/data, versão, versão do iVent, profissão e pergunta. As restrições do banco garantem que "Não utilizei/Não se aplica" nunca coexista com uma nota e que respostas nunca sejam apagadas em cascata.

## Executar localmente

Pré-requisitos: Node 24 e PostgreSQL 14 ou superior.

```bash
npm install
createdb ivent_avaliacao
cp .env.example .env        # preencha DATABASE_URL, ADMIN_EMAIL e ADMIN_PASSWORD
npm run dev                 # API em :8788 e frontend em :5174 (com proxy de /api)
```

Abra `http://localhost:5174/admin`. As migrations e o seed rodam sozinhos quando o servidor sobe.

Para rodar como em produção:

```bash
npm run build && npm start
```

Nesse modo, a aplicação inteira é servida pelo próprio servidor em `:8788`.

| Script | Função |
|---|---|
| `npm run migrate` | Aplica as migrations pendentes |
| `npm run seed` | Executa o seed (idempotente) |
| `npm test` | Testes unitários e de integração. Requer o banco `ivent_avaliacao_test`; veja abaixo |
| `npm run test:e2e` | Testes Playwright. Requer o banco `ivent_avaliacao_e2e` |
| `npm run verify` | Typecheck, testes e build |
| `npm run backup` | Backup com `pg_dump` (requer `DATABASE_URL`) |

**Bancos de teste.** Crie uma vez com `createdb ivent_avaliacao_test && createdb ivent_avaliacao_e2e`. Os testes recriam o esquema desses bancos e recusam rodar em qualquer banco cujo nome não termine em `_test` ou `_e2e`.

## Variáveis de ambiente

Veja `.env.example`, que traz o comentário de cada variável.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Conexão PostgreSQL. No Railway: `${{Postgres.DATABASE_URL}}` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | sim | Administrador inicial. A senha precisa de 10 ou mais caracteres, com letras e números |
| `IP_HASH_SALT` | em produção | Sal com 16 ou mais caracteres para anonimizar IPs e assinar o token do formulário |
| `PUBLIC_BASE_URL` | recomendada | URL pública usada nos links e QR Codes. Sem ela, usa-se `RAILWAY_PUBLIC_DOMAIN` |
| `NODE_ENV` | — | `production` no Railway (o Dockerfile já define) |
| `MIN_FILL_SECONDS` | — | Tempo mínimo de preenchimento contra automação (padrão 20) |
| `SESSION_TTL_HOURS` | — | Duração da sessão administrativa (padrão 12) |
| `TRUST_PROXY`, `TRUST_PROXY_HOPS` | — | IP real atrás do proxy do Railway (padrão: ativo, 1 salto) |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | não | Ativa a análise por IA (modelo padrão `claude-opus-5-5`) |
| `AI_PROVIDER=openai`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | não | Alternativa: endpoint compatível com OpenAI |

Sem chave de IA, todo o restante funciona normalmente. A chave nunca chega ao navegador.

## Publicar no Railway

1. Crie um projeto no Railway e adicione **PostgreSQL** (New → Database → PostgreSQL).
2. Adicione um serviço a partir do repositório GitHub `marcoaurelio1512/Plataforma-avaliacao-iVent`. O `railway.json` já define o build por Dockerfile e o health check em `/health`.
3. Em **Variables** do serviço da aplicação:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `IP_HASH_SALT`. Gere o sal com `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.
   - Opcionais: `PUBLIC_BASE_URL` (se usar domínio próprio) e `ANTHROPIC_API_KEY`.
4. Em **Settings → Networking**, gere o domínio público.
5. Faça o deploy. No boot, a aplicação aplica as migrations, roda o seed idempotente e só depois aceita tráfego. Os logs saem em JSON, uma linha por evento.
6. Acesse `https://SEU-DOMINIO/admin`, entre com o administrador, publique o questionário e compartilhe o link ou QR Code.

**Backups.** Ative os backups automáticos do PostgreSQL no Railway (aba Backups do banco). Para uma cópia manual: `DATABASE_URL=... npm run backup`. Para restaurar: `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" arquivo.dump`.

## Integração com o iVent

O iVent já leva ao painel da plataforma pelo botão do admin (`src/components/admin/EvaluationPlatformLink.tsx`), que aponta para `https://plataforma-avaliacao-ivent-production.up.railway.app`; a variável `VITE_EVALUATION_PLATFORM_URL` troca o endereço sem mexer no código.

Fora isso, não é preciso alterar nada no iVent para usar a plataforma. Quando quiser, basta um link ou botão no iVent apontando para o link público da pesquisa, que aparece em **Pesquisas → Link e QR**, por exemplo `https://SEU-DOMINIO/r/abc123xyz`. Também é possível exibir o QR Code em sala.

## Segurança e LGPD

- **Autenticação.** Sessão opaca em cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` em produção). O banco guarda só o hash do token. Toda rota administrativa exige autorização no backend.
- **CSRF.** Mutações administrativas exigem um cabeçalho próprio (`x-iva-csrf`), somado ao cookie Strict.
- **Validação.** zod em todas as entradas. As respostas são validadas contra a versão exata do questionário. Todas as consultas SQL são parametrizadas.
- **XSS.** O React escapa todo texto, e o código não usa `innerHTML`. Há CSP restritiva, HSTS, `X-Frame-Options: DENY` e `nosniff`.
- **Antiabuso**
  - Limites de requisição por IP (usando a entrada do proxy, que não pode ser forjada pelo cliente) e um limite global por pesquisa.
  - Campo-armadilha contra robôs.
  - Tempo mínimo de preenchimento medido por um token assinado (HMAC) que o servidor emite ao abrir o formulário.
  - Chave de idempotência para que reenvios, inclusive simultâneos, não dupliquem respostas.
- **Exportações.** Proteção contra *formula injection* em CSV e Excel.
- **LGPD e minimização de dados.** Não coletamos nome, e-mail ou contato. O IP é guardado apenas como hash com sal. O texto original nunca é alterado.

## Testes

- **Unitários e de integração (Vitest + PostgreSQL real):** estatística, nuvem de palavras, temas e prioridade, proteção de planilhas, validação de respostas e segurança. Na API, cobrem migrations, seed idempotente, autenticação, CRUD, versionamento, publicação, link e QR, submissão (idempotência, antiautomação, envios simultâneos), filtros, comparação de grupos, nuvem, busca, exportações PDF/Excel/CSV, IA ausente e reinício do servidor.
- **E2E (Playwright):** resposta completa pelo celular (Pixel 7) e pelo computador; publicação com link e QR; dashboard; clique na nuvem; busca; grupos; downloads; editor (criar, reordenar, prévia, nova versão); configurações; logout; capturas em 320, 768, 1024 e 1440 px nos dois temas; verificação de rolagem horizontal; e axe (WCAG 2 A/AA).
