import { Highlight, SearchHighlight } from "../../components/Highlight.tsx";
import { dateTime } from "../../lib/format.ts";
import type { TextDoc } from "../types.ts";

/** Lista de textos originais com pergunta de origem, profissão e data — nunca editados. */
export function SourceList({ docs, search }: { docs: TextDoc[]; search?: string }) {
  return (
    <ul className="source-list">
      {docs.map((d) => (
        <li key={d.id} className="source-item">
          <blockquote className="source-text">
            {d.ranges ? <Highlight text={d.text} ranges={d.ranges} /> : <SearchHighlight text={d.text} query={search ?? ""} />}
          </blockquote>
          <div className="source-meta">
            <span className={`badge ${d.profession === "physiotherapist" ? "badge-ok" : "badge-accent"}`}>{d.professionLabel}</span>
            <span className="badge">{d.kind === "open" ? "Pergunta aberta" : "Comentário do item"}</span>
            <span className="dim">{d.participantCode}</span>
            <span className="dim">{dateTime(d.submittedAt)}</span>
          </div>
          <p className="source-question">{d.questionText}</p>
        </li>
      ))}
    </ul>
  );
}
