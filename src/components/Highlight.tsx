/** Destaca trechos do texto original pelas posições calculadas no servidor (sem reescrever o texto). */
export function Highlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const parts: { text: string; hl: boolean }[] = [];
  let cursor = 0;
  for (const [s, e] of sorted) {
    if (s < cursor) continue;
    if (s > cursor) parts.push({ text: text.slice(cursor, s), hl: false });
    parts.push({ text: text.slice(s, e), hl: true });
    cursor = e;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hl: false });
  return (
    <span className="original-text">
      {parts.map((p, i) => (p.hl ? <mark key={i} className="hl">{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </span>
  );
}

/** Destaque por busca de palavra (insensível a maiúsculas e acentos). */
export function SearchHighlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <span className="original-text">{text}</span>;
  const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const folded = fold(text);
  const needle = fold(q);
  const ranges: [number, number][] = [];
  // Remover diacríticos preserva o comprimento em português (letra + acento combinante → letra).
  if (folded.length === text.length) {
    let i = folded.indexOf(needle);
    while (i >= 0 && needle) {
      ranges.push([i, i + needle.length]);
      i = folded.indexOf(needle, i + needle.length);
    }
  }
  return <Highlight text={text} ranges={ranges} />;
}
