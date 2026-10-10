/**
 * Questionário inicial, cadastrado automaticamente na primeira instalação.
 * As chaves (key) são estáveis: permitem comparar as mesmas perguntas entre
 * versões do questionário e do iVent.
 */
import type { QuestionInput } from "../validation.ts";

export const INITIAL_SURVEY_SEED_KEY = "ivent-neoped-avaliacao-v1";

export const INITIAL_SURVEY_TITLE =
  "Avaliação de Interface, Usabilidade e Experiência Educacional do iVent NeoPed";

export const INITIAL_INSTRUCTIONS = `Antes de responder, explore o iVent NeoPed.

Ajuste parâmetros ventilatórios, observe curvas, loops, gráficos, gasometria e respostas fisiológicas e utilize os recursos disponíveis.

Para cada afirmação utilize:
1 — Discordo totalmente
2 — Discordo parcialmente
3 — Nem concordo nem discordo
4 — Concordo parcialmente
5 — Concordo totalmente`;

const likert = (key: string, category: string, text: string, extra: Partial<QuestionInput> = {}): QuestionInput => ({
  key,
  section: "quantitative",
  type: "likert",
  text,
  helpText: null,
  category,
  required: true,
  allowComment: true,
  allowNotApplicable: false,
  allowNotUsed: false,
  scaleMin: 1,
  scaleMax: 5,
  scaleMinLabel: "Discordo totalmente",
  scaleMaxLabel: "Concordo totalmente",
  options: [],
  ...extra,
});

const open = (key: string, category: string, text: string): QuestionInput => ({
  key,
  section: "open",
  type: "long_text",
  text,
  helpText: null,
  category,
  required: false,
  allowComment: false,
  allowNotApplicable: false,
  allowNotUsed: false,
  scaleMin: null,
  scaleMax: null,
  scaleMinLabel: null,
  scaleMaxLabel: null,
  options: [],
});

export const INITIAL_QUESTIONS: QuestionInput[] = [
  likert(
    "interface_visual",
    "Interface",
    "A interface do iVent é clara, organizada e visualmente agradável, permitindo identificar rapidamente os principais parâmetros ventilatórios?",
  ),
  likert(
    "facilidade_navegacao",
    "Usabilidade",
    "Foi fácil localizar os controles, alterar parâmetros e acessar os diferentes recursos do simulador sem precisar de orientação?",
  ),
  likert(
    "compreensao_dados",
    "Visualização de dados",
    "Os valores, alarmes, curvas de pressão, fluxo e volume, loops e indicadores fisiológicos são apresentados de maneira compreensível?",
  ),
  likert(
    "realismo_simulacao",
    "Realismo fisiológico",
    "O comportamento do ventilador e as respostas fisiológicas do paciente parecem coerentes com situações encontradas na prática clínica?",
  ),
  likert(
    "interacao_simulador",
    "Interatividade",
    "Ao modificar parâmetros como PIP, PEEP, frequência respiratória, FiO₂ e tempo inspiratório, as mudanças observadas foram claras e intuitivas?",
  ),
  likert(
    "recursos_educacionais",
    "Educação",
    "O iVent facilita a compreensão da ventilação mecânica neonatal e pediátrica e contribui para o raciocínio clínico?",
  ),
  likert(
    "recursos_complementares",
    "Recursos complementares",
    "Os recursos como pulmão 3D, tomografia por impedância elétrica (EIT) e gasometria simulada ajudam a compreender a condição do paciente?",
    { allowNotUsed: true },
  ),
  likert(
    "desempenho_fluidez",
    "Desempenho",
    "O simulador respondeu rapidamente aos comandos, sem travamentos, atrasos perceptíveis ou dificuldades de interação?",
  ),
  likert(
    "autonomia_utilizacao",
    "Autonomia",
    "Você conseguiria utilizar o iVent para estudar, praticar ou realizar atividades de simulação sem auxílio constante de um instrutor?",
  ),
  likert(
    "avaliacao_geral",
    "Avaliação geral",
    "Você considera o iVent uma ferramenta útil para o ensino e treinamento em ventilação mecânica neonatal e pediátrica?",
  ),
  open("pontos_positivos", "Pontos positivos", "O que você mais gostou no iVent NeoPed? Quais recursos considera mais úteis?"),
  open(
    "dificuldades",
    "Dificuldades",
    "Durante a utilização, você encontrou alguma dificuldade de navegação, interpretação de informações ou configuração do ventilador? Descreva.",
  ),
  open(
    "melhorias_interface",
    "Melhorias na interface",
    "O que você mudaria na organização das telas, botões, controles, gráficos ou apresentação dos dados?",
  ),
  open(
    "novas_funcionalidades",
    "Novas funcionalidades",
    "Existe alguma funcionalidade que você gostaria de encontrar no iVent e que ainda não está disponível?",
  ),
  open(
    "sugestoes_gerais",
    "Sugestões gerais",
    "Deixe aqui suas críticas, elogios e sugestões para as próximas versões do iVent NeoPed.",
  ),
];
