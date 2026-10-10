/**
 * Temas de feedback e prioridade operacional de melhorias.
 *
 * A classificação por palavras-chave é determinística e auditável: cada
 * comentário conta para um tema quando contém um dos radicais listados. Serve
 * de base mesmo sem IA configurada. A prioridade é ferramenta de gestão do
 * desenvolvimento do iVent — não é evidência científica.
 */
import { tokenize, normalizeKey } from "./text.ts";

export const THEMES = [
  "Interface",
  "Navegação",
  "Controles",
  "Curvas",
  "Loops",
  "Realismo fisiológico",
  "Pulmão 3D",
  "EIT",
  "Gasometria",
  "Recursos educacionais",
  "Desempenho",
  "Novas funcionalidades",
  "Outros",
] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Radicais normalizados (sem acento). Casam com o início de cada palavra;
 * "=" exige a palavra inteira (evita "cor" casar com "corrente").
 */
const THEME_STEMS: Record<Exclude<Theme, "Outros">, string[]> = {
  Interface: ["interface", "tela", "layout", "visual", "design", "=cor", "=cores", "fonte", "icone", "aparencia", "organiza", "poluid", "limp"],
  Navegação: ["naveg", "localiz", "encontr", "menu", "=aba", "=abas", "acess", "intuitiv", "achar", "perdi", "orientac"],
  Controles: ["control", "botao", "botoes", "ajust", "parametr", "slider", "clic", "toque", "teclad", "comando", "configur"],
  Curvas: ["curva", "grafic", "onda", "tracad", "escala"],
  Loops: ["loop", "alca"],
  "Realismo fisiológico": ["realis", "fisiolog", "coerent", "verossim", "pratica clinica"],
  "Pulmão 3D": ["pulmao 3d", "=3d", "pulmao"],
  EIT: ["eit", "impedanc", "tomografia"],
  Gasometria: ["gasometr", "gases", "pco2", "po2", "paco2", "pao2", "=ph"],
  "Recursos educacionais": ["educa", "aprend", "ensin", "didatic", "estud", "aula", "professor", "aluno", "raciocinio", "explica", "teori", "treinament"],
  Desempenho: ["lent", "trav", "atras", "desempenh", "rapid", "fluid", "carreg", "bug", "erro", "congel", "demor", "performance"],
  "Novas funcionalidades": ["gostaria", "poderia ter", "adicion", "inclu", "nova funcion", "novas funcion", "falta", "implement", "seria interessante", "sugiro", "sugest"],
};

/** Temas que têm pergunta quantitativa relacionada (pela categoria da pergunta). */
export const THEME_QUESTION_CATEGORIES: Record<Theme, string[]> = {
  Interface: ["Interface"],
  Navegação: ["Usabilidade"],
  Controles: ["Usabilidade", "Interatividade"],
  Curvas: ["Visualização de dados"],
  Loops: ["Visualização de dados"],
  "Realismo fisiológico": ["Realismo fisiológico"],
  "Pulmão 3D": ["Recursos complementares"],
  EIT: ["Recursos complementares"],
  Gasometria: ["Recursos complementares"],
  "Recursos educacionais": ["Educação"],
  Desempenho: ["Desempenho"],
  "Novas funcionalidades": [],
  Outros: [],
};

export function classifyThemes(text: string): Theme[] {
  const tokens = tokenize(text).map((t) => t.norm);
  const joined = ` ${tokens.join(" ")} `;
  const found: Theme[] = [];
  for (const [theme, stems] of Object.entries(THEME_STEMS) as [Exclude<Theme, "Outros">, string[]][]) {
    const hit = stems.some((stem) => {
      if (stem.startsWith("=")) return tokens.includes(normalizeKey(stem.slice(1)));
      const s = normalizeKey(stem);
      return s.includes(" ") ? joined.includes(` ${s}`) : tokens.some((t) => t.startsWith(s));
    });
    if (hit) found.push(theme);
  }
  return found;
}

export type PriorityLevel = "Alta" | "Média" | "Baixa";

export interface PriorityInput {
  theme: string;
  /** Média das perguntas relacionadas, já na escala original. */
  mean: number | null;
  scaleMin: number;
  scaleMax: number;
  /** Participantes distintos que mencionaram o tema. */
  participantsMentioning: number;
  /** Participantes que escreveram algum texto (denominador). */
  participantsWithText: number;
}

export interface PriorityResult {
  score: number;
  level: PriorityLevel;
  deficit: number | null;
  volume: number;
}

export const PRIORITY_FORMULA =
  "Prioridade = 0,6 × déficit da nota + 0,4 × proporção de participantes que mencionaram o tema. " +
  "Déficit = (máximo da escala − média) ÷ (máximo − mínimo). Sem nota associada, usa-se só a proporção de menções (peso 0,5). " +
  "Alta ≥ 0,45; Média ≥ 0,25; Baixa abaixo disso. É uma ferramenta operacional de priorização, não evidência científica.";

export function computePriority(input: PriorityInput): PriorityResult {
  const volume = input.participantsWithText > 0 ? Math.min(1, input.participantsMentioning / input.participantsWithText) : 0;
  const range = input.scaleMax - input.scaleMin;
  const deficit = input.mean !== null && range > 0 ? Math.min(1, Math.max(0, (input.scaleMax - input.mean) / range)) : null;
  const score = deficit === null ? 0.5 * volume : 0.6 * deficit + 0.4 * volume;
  const level: PriorityLevel = score >= 0.45 ? "Alta" : score >= 0.25 ? "Média" : "Baixa";
  return { score, level, deficit, volume };
}
