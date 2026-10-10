/**
 * Nuvem de palavras interativa (d3-cloud). Tamanho = frequência; a cor reforça
 * a mesma grandeza num único matiz (sequencial), nunca categorias arbitrárias.
 * Layout com semente fixa: a mesma entrada produz sempre a mesma nuvem.
 */
import cloud from "d3-cloud";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface CloudWord {
  key: string;
  label: string;
  value: number;
}

interface Placed {
  key: string;
  text: string;
  size: number;
  x: number;
  y: number;
  rotate: number;
  tier: number;
}

export interface WordCloudHandle {
  toPng: (title?: string) => Promise<Blob>;
}

const FONT = '"SF Pro Display", "Segoe UI", system-ui, -apple-system, sans-serif';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export const WordCloud = forwardRef<WordCloudHandle, { words: CloudWord[]; selected?: string | null; onSelect: (key: string) => void; height?: number }>(
  function WordCloud({ words, selected, onSelect, height = 460 }, ref) {
    const boxRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [width, setWidth] = useState(800);
    const [placed, setPlaced] = useState<Placed[]>([]);
    const [dropped, setDropped] = useState(0);

    useEffect(() => {
      const el = boxRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry!.contentRect.width))));
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      if (!words.length) {
        setPlaced([]);
        return;
      }
      const max = Math.max(...words.map((w) => w.value));
      const min = Math.min(...words.map((w) => w.value));
      const narrow = width < 520;
      const [minSize, maxSize] = narrow ? [12, 40] : [14, 68];
      const scale = (v: number) => (max === min ? (minSize + maxSize) / 2 : minSize + Math.sqrt((v - min) / (max - min)) * (maxSize - minSize));
      const tier = (v: number) => (max === min ? 3 : Math.min(3, Math.floor(((v - min) / (max - min)) * 4)));
      const input = words.map((w) => ({ key: w.key, text: w.label, size: scale(w.value), tier: tier(w.value) }));
      let cancelled = false;
      const layout = cloud<cloud.Word & { key: string; tier: number }>()
        .size([width, height])
        .words(input.map((w) => ({ ...w })))
        .padding(narrow ? 2 : 4)
        .rotate(() => 0)
        .font(FONT)
        .fontWeight(700)
        .fontSize((d) => d.size ?? 14)
        .spiral("archimedean")
        .random(seeded(42))
        .on("end", (out) => {
          if (cancelled) return;
          setPlaced(out.map((d) => ({ key: d.key, text: d.text!, size: d.size!, x: d.x!, y: d.y!, rotate: d.rotate ?? 0, tier: d.tier })));
          setDropped(input.length - out.length);
        });
      layout.start();
      return () => {
        cancelled = true;
        layout.stop();
      };
    }, [words, width, height]);

    useImperativeHandle(ref, () => ({
      toPng: async (title?: string) => {
        const svg = svgRef.current!;
        const clone = svg.cloneNode(true) as SVGSVGElement;
        const styles = getComputedStyle(document.documentElement);
        const bg = styles.getPropertyValue("--surface-1").trim() || "#ffffff";
        // Cores resolvidas: o SVG serializado não enxerga as variáveis CSS da página.
        clone.querySelectorAll<SVGTextElement>("text").forEach((t, i) => {
          const original = svg.querySelectorAll<SVGTextElement>("text")[i]!;
          t.setAttribute("fill", getComputedStyle(original).fill);
          t.setAttribute("font-family", FONT);
          t.removeAttribute("class");
        });
        const titleH = title ? 56 : 0;
        clone.setAttribute("width", String(width));
        clone.setAttribute("height", String(height));
        const xml = new XMLSerializer().serializeToString(clone);
        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
        await img.decode();
        const ratio = 2;
        const canvas = document.createElement("canvas");
        canvas.width = width * ratio;
        canvas.height = (height + titleH) * ratio;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(ratio, ratio);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height + titleH);
        if (title) {
          ctx.fillStyle = styles.getPropertyValue("--text").trim() || "#1a2230";
          ctx.font = `600 18px ${FONT}`;
          ctx.fillText(title, 20, 34);
        }
        ctx.drawImage(img, 0, titleH, width, height);
        return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/png"));
      },
    }));

    return (
      <div ref={boxRef} className="wordcloud" style={{ height }}>
        <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Nuvem de palavras">
          <g transform={`translate(${width / 2},${height / 2})`}>
            {placed.map((w) => (
              <text
                key={w.key}
                className={`cloud-word tier-${w.tier}${selected === w.key ? " is-selected" : ""}${selected && selected !== w.key ? " is-dimmed" : ""}`}
                textAnchor="middle"
                transform={`translate(${w.x},${w.y}) rotate(${w.rotate})`}
                fontSize={w.size}
                fontWeight={700}
                fontFamily={FONT}
                tabIndex={0}
                role="button"
                aria-label={`${w.text}: ver comentários`}
                aria-pressed={selected === w.key}
                onClick={() => onSelect(w.key)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(w.key))}
              >
                {w.text}
              </text>
            ))}
          </g>
        </svg>
        {dropped > 0 && <p className="panel-note cloud-dropped">{dropped} termo(s) menos frequente(s) não couberam na área — veja a tabela.</p>}
      </div>
    );
  },
);
