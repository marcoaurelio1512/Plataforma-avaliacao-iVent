import { useState } from "react";
import { LIKERT_LABELS, SPECIAL_ANSWER_LABELS, type QuestionDef } from "../../../shared/domain.ts";
import { Empty, ErrorState, Loading } from "../../components/States.tsx";
import { api } from "../../lib/api.ts";
import { dateTime } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { Drawer } from "../components/Drawer.tsx";
import { FilterBar } from "../components/FilterBar.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { useScope } from "../scope.tsx";

interface Answer { questionId: string; numeric: number | null; text: string | null; choices: string[] | null; special: keyof typeof SPECIAL_ANSWER_LABELS | null; comment: string | null }
interface Row { id: string; participantCode: string; profession: string; submittedAt: string; deviceClass: string | null; iventVersionLabel: string | null; answers: Answer[] }
interface Data { version: { id: string; number: number }; questions: QuestionDef[]; responses: Row[] }

function cell(q: QuestionDef, a: Answer): string {
  if (a.special) return SPECIAL_ANSWER_LABELS[a.special];
  if (a.numeric !== null) return String(a.numeric);
  if (a.choices?.length) return q.type === "yes_no" ? (a.choices[0] === "yes" ? "Sim" : "Não") : q.options.filter((o) => a.choices!.includes(o.value)).map((o) => o.label).join(", ");
  return a.text ? "✎" : "—";
}

export default function ResponsesPage() {
  const { query, surveyId } = useScope();
  const [open, setOpen] = useState<Row | null>(null);
  const state = useAsync((signal) => (surveyId ? api<Data>("/api/admin/responses", { query, signal }) : Promise.resolve(null)), [JSON.stringify(query)]);
  const d = state.data;
  const quant = d?.questions.filter((q) => q.section === "quantitative") ?? [];
  return (
    <>
      <PageHeader eyebrow="Dados coletados" title="Respostas" description={d ? `Questionário v${d.version.number}. Clique em uma linha para ver a resposta completa.` : undefined} />
      <FilterBar show={["profession", "from", "to", "iventVersionId"]} />
      {state.loading && <Loading />}
      {state.error != null && <ErrorState error={state.error} onRetry={state.reload} />}
      {d && d.responses.length === 0 && <Empty title="Nenhuma resposta com estes filtros" />}
      {d && d.responses.length > 0 && (
        <div className="table-wrap">
          <table className="table table-compact">
            <thead>
              <tr>
                <th>Participante</th><th>Profissão</th><th>Enviado</th>
                {quant.map((q, i) => <th key={q.id} className="num" title={q.text}>Q{i + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.responses.map((r) => (
                <tr key={r.id} className="clickable" tabIndex={0} onClick={() => setOpen(r)} onKeyDown={(e) => e.key === "Enter" && setOpen(r)}>
                  <td className="num">{r.participantCode}</td>
                  <td>{r.profession}</td>
                  <td>{dateTime(r.submittedAt)}</td>
                  {quant.map((q) => {
                    const a = r.answers.find((x) => x.questionId === q.id)!;
                    return <td key={q.id} className={`num${a.special ? " dim" : ""}`} title={a.comment ?? undefined}>{cell(q, a)}{a.comment ? "*" : ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d && <p className="panel-note">* item com comentário.</p>}
      <Drawer open={Boolean(open)} title={open?.participantCode ?? ""} subtitle={open && `${open.profession} · ${dateTime(open.submittedAt)}${open.iventVersionLabel ? ` · ${open.iventVersionLabel}` : ""}`} onClose={() => setOpen(null)}>
        {open && d && (
          <ol className="answer-detail">
            {d.questions.map((q, i) => {
              const a = open.answers.find((x) => x.questionId === q.id)!;
              const value = a.special ? SPECIAL_ANSWER_LABELS[a.special] : a.numeric !== null ? (q.type === "likert" ? `${a.numeric} — ${LIKERT_LABELS[a.numeric]}` : String(a.numeric)) : a.text ?? (a.choices?.length ? cell(q, a) : "Sem resposta");
              return (
                <li key={q.id}>
                  <p className="dim">{i + 1}. {q.text}</p>
                  <p className="answer-value">{value}</p>
                  {a.comment && <p className="answer-comment">Comentário: {a.comment}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </Drawer>
    </>
  );
}
