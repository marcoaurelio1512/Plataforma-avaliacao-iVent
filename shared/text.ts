/**
 * Processamento de texto livre para a nuvem de palavras.
 *
 * O texto original nunca é alterado: tudo aqui trabalha sobre cópias
 * normalizadas e devolve as posições (início/fim) no texto original, para que
 * a interface destaque o trecho exato sem reescrever nada.
 */
import { DEFAULT_EXTRA_STOPWORDS, PT_STOPWORDS } from "./stopwords.ts";

export interface TextSettings {
  extraStopwords: string[];
  /** Expressões compostas adicionais, na forma de exibição ("alarme sonoro"). */
  extraPhrases: string[];
  /** Termos técnicos adicionais que nunca são descartados. */
  extraProtected: string[];
}

/** Termos técnicos: chave normalizada → rótulo canônico de exibição. */
export const PROTECTED_TERMS: Record<string, string> = {
  peep: "PEEP",
  pip: "PIP",
  fio2: "FiO₂",
  vafo: "VAFO",
  eit: "EIT",
  nava: "NAVA",
  cpap: "CPAP",
  bipap: "BiPAP",
  hfov: "HFOV",
  simv: "SIMV",
  psv: "PSV",
  pcv: "PCV",
  vcv: "VCV",
  prvc: "PRVC",
  spo2: "SpO₂",
  pco2: "pCO₂",
  paco2: "PaCO₂",
  po2: "pO₂",
  pao2: "PaO₂",
  etco2: "EtCO₂",
  ph: "pH",
  vt: "VT",
  "3d": "3D",
  gasometria: "gasometria",
  ventilacao: "ventilação",
  curva: "curvas",
  loop: "loops",
};

export const DEFAULT_PHRASES = [
  "pulmão 3D",
  "curvas ventilatórias",
  "interface confusa",
  "ventilação mecânica",
  "gasometria simulada",
  "modo professor",
  "modo aluno",
  "tempo inspiratório",
  "frequência respiratória",
  "volume corrente",
  "raciocínio clínico",
  "parâmetros ventilatórios",
  "modos ventilatórios",
  "tomografia por impedância elétrica",
  "alta frequência",
  "complacência pulmonar",
];

export const DEFAULT_TEXT_SETTINGS: TextSettings = {
  extraStopwords: [],
  extraPhrases: [],
  extraProtected: [],
};

export interface Token {
  /** Forma original, como escrita. */
  raw: string;
  /** Minúsculas, sem acento. */
  norm: string;
  /** Chave de agrupamento (flexões de plural reduzidas). */
  stem: string;
  start: number;
  end: number;
  /** Trecho (frase) a que o token pertence: expressões compostas não atravessam pontuação. */
  segment: number;
}

const SUBSCRIPTS: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

export function normalizeKey(text: string): string {
  return text
    .replace(/[₀-₉]/g, (c) => SUBSCRIPTS[c] ?? c)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Redução leve de plural do português, só para agrupar ("curvas" → "curva",
 * "ventilações" → "ventilacao"). Não é um lematizador completo: o rótulo
 * exibido é sempre uma forma realmente escrita pelos participantes.
 */
export function stemKey(norm: string, protectedKeys?: ReadonlySet<string>): string {
  if (protectedKeys?.has(norm) || Object.hasOwn(PROTECTED_TERMS, norm)) return norm;
  if (norm.length <= 3 || /\d/.test(norm)) return norm;
  if (/(oes|aes)$/.test(norm)) return `${norm.slice(0, -3)}ao`;
  if (norm.length > 4 && norm.endsWith("ais")) return `${norm.slice(0, -3)}al`;
  if (norm.length > 4 && norm.endsWith("eis")) return `${norm.slice(0, -3)}el`;
  if (norm.length > 4 && norm.endsWith("ois")) return `${norm.slice(0, -3)}ol`;
  if (norm.endsWith("ns")) return `${norm.slice(0, -2)}m`;
  // "valores" → "valor", "luzes" → "luz". Não vale para "-ses" ("frases", "análises"): cai na regra do "s".
  if (norm.length > 4 && /(res|zes)$/.test(norm)) return norm.slice(0, -2);
  if (norm.endsWith("s") && !/(ss|us|is)$/.test(norm)) return norm.slice(0, -1);
  return norm;
}

const TOKEN_RE = /[\p{L}\p{N}₀-₉]+/gu;

const SEGMENT_BREAK = /[.!?;:()\[\]\n\r"“”]/;

export function tokenize(text: string, protectedKeys?: ReadonlySet<string>): Token[] {
  const tokens: Token[] = [];
  let segment = 0;
  let previousEnd = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    if (SEGMENT_BREAK.test(text.slice(previousEnd, start))) segment += 1;
    const norm = normalizeKey(raw);
    tokens.push({ raw, norm, stem: stemKey(norm, protectedKeys), start, end: start + raw.length, segment });
    previousEnd = start + raw.length;
  }
  return tokens;
}

export interface ExtractedTerm {
  key: string;
  /** Forma de exibição desta ocorrência. */
  label: string;
  isCanonical: boolean;
  start: number;
  end: number;
}

interface CompiledSettings {
  stopwords: Set<string>;
  protectedKeys: Set<string>;
  protectedLabels: Map<string, string>;
  phrases: { stems: string[]; label: string; key: string }[];
}

const compiledCache = new WeakMap<TextSettings, CompiledSettings>();

function compile(settings: TextSettings): CompiledSettings {
  const cached = compiledCache.get(settings);
  if (cached) return cached;
  const protectedLabels = new Map(Object.entries(PROTECTED_TERMS));
  for (const term of settings.extraProtected) {
    const key = normalizeKey(term);
    if (key) protectedLabels.set(key, term.trim());
  }
  const protectedKeys = new Set(protectedLabels.keys());
  const stopwords = new Set(PT_STOPWORDS);
  for (const w of [...DEFAULT_EXTRA_STOPWORDS, ...settings.extraStopwords]) {
    const key = normalizeKey(w);
    if (key && !protectedKeys.has(key)) stopwords.add(key);
  }
  const phraseSet = new Map<string, { stems: string[]; label: string; key: string }>();
  for (const label of [...DEFAULT_PHRASES, ...settings.extraPhrases]) {
    const stems = tokenize(label, protectedKeys).map((t) => t.stem);
    if (stems.length < 2) continue;
    const key = stems.join(" ");
    if (!phraseSet.has(key)) phraseSet.set(key, { stems, label: label.trim(), key });
  }
  // Expressões mais longas primeiro: "ventilação mecânica neonatal" vence "ventilação mecânica".
  const phrases = [...phraseSet.values()].sort((a, b) => b.stems.length - a.stems.length);
  const compiled = { stopwords, protectedKeys, protectedLabels, phrases };
  compiledCache.set(settings, compiled);
  return compiled;
}

export function extractTerms(text: string, settings: TextSettings): ExtractedTerm[] {
  const c = compile(settings);
  const tokens = tokenize(text, c.protectedKeys);
  const terms: ExtractedTerm[] = [];
  let i = 0;
  while (i < tokens.length) {
    const phrase = c.phrases.find((p) => p.stems.every((s, k) => tokens[i + k]?.stem === s && tokens[i + k]?.segment === tokens[i]!.segment));
    if (phrase) {
      const last = tokens[i + phrase.stems.length - 1]!;
      terms.push({ key: `phrase:${phrase.key}`, label: phrase.label, isCanonical: true, start: tokens[i]!.start, end: last.end });
      i += phrase.stems.length;
      continue;
    }
    const token = tokens[i]!;
    i += 1;
    const protectedLabel = c.protectedLabels.get(token.norm) ?? c.protectedLabels.get(token.stem);
    if (protectedLabel) {
      terms.push({ key: token.stem, label: protectedLabel, isCanonical: true, start: token.start, end: token.end });
      continue;
    }
    if (c.stopwords.has(token.norm) || c.stopwords.has(token.stem)) continue;
    if (token.norm.length < 3 || /^\d+$/.test(token.norm)) continue;
    terms.push({ key: token.stem, label: token.raw.toLowerCase(), isCanonical: false, start: token.start, end: token.end });
  }
  return terms;
}

export interface TextDocument<M = Record<string, unknown>> {
  id: string;
  participantId: string;
  text: string;
  meta: M;
}

export interface TermSource<M = Record<string, unknown>> {
  docId: string;
  participantId: string;
  text: string;
  ranges: [number, number][];
  meta: M;
}

export interface CloudTerm<M = Record<string, unknown>> {
  key: string;
  label: string;
  occurrences: number;
  participants: number;
  sources: TermSource<M>[];
}

/** Agrega termos de vários textos, contando ocorrências e participantes distintos. */
export function buildWordCloud<M>(docs: readonly TextDocument<M>[], settings: TextSettings): CloudTerm<M>[] {
  interface Acc {
    key: string;
    canonical: string | null;
    surfaces: Map<string, number>;
    occurrences: number;
    participants: Set<string>;
    sources: Map<string, TermSource<M>>;
  }
  const acc = new Map<string, Acc>();
  for (const doc of docs) {
    if (!doc.text?.trim()) continue;
    for (const term of extractTerms(doc.text, settings)) {
      const entry =
        acc.get(term.key) ??
        { key: term.key, canonical: null, surfaces: new Map(), occurrences: 0, participants: new Set<string>(), sources: new Map() };
      if (term.isCanonical) entry.canonical = term.label;
      entry.surfaces.set(term.label, (entry.surfaces.get(term.label) ?? 0) + 1);
      entry.occurrences += 1;
      entry.participants.add(doc.participantId);
      const source = entry.sources.get(doc.id);
      const range: [number, number] = [term.start, term.end];
      entry.sources.set(
        doc.id,
        source
          ? { ...source, ranges: [...source.ranges, range] }
          : { docId: doc.id, participantId: doc.participantId, text: doc.text, ranges: [range], meta: doc.meta },
      );
      acc.set(term.key, entry);
    }
  }
  return [...acc.values()]
    .map((e) => ({
      key: e.key,
      label: e.canonical ?? mostFrequent(e.surfaces),
      occurrences: e.occurrences,
      participants: e.participants.size,
      sources: [...e.sources.values()],
    }))
    .sort((a, b) => b.occurrences - a.occurrences || b.participants - a.participants || a.label.localeCompare(b.label, "pt-BR"));
}

function mostFrequent(counts: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (count > bestCount || (count === bestCount && label.length < best.length)) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}
