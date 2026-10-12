/**
 * Fluxo do participante: Bem-vindo → Perfil → Avaliação → Sua opinião → Revisar → Enviar → Obrigado.
 */
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Lock, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { AnswerInput } from "../../shared/domain.ts";
import { Brand } from "../components/Brand.tsx";
import { ErrorState, Loading } from "../components/States.tsx";
import { ThemeToggle } from "../components/ThemeToggle.tsx";
import { ApiError, api, errorMessage } from "../lib/api.ts";
import { useAsync } from "../lib/useAsync.ts";
import { CommentBox, QuestionInput, isAnswered } from "./QuestionInputs.tsx";
import { Profile, Review, Thanks, Welcome } from "./Steps.tsx";
import type { PublicSurvey } from "./types.ts";
import { useDraft } from "./useDraft.ts";
import "../styles/participant.css";

function deviceClass(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

const INVITE_MESSAGES: Record<NonNullable<PublicSurvey["inviteStatus"]>, string> = {
  missing: "Esta pesquisa é respondida por convite. Use o link ou o QR Code individual que você recebeu.",
  invalid: "Este convite não é válido. Confira se o link foi copiado por inteiro ou peça um novo convite.",
  used: "Este convite já foi utilizado — cada convite vale para uma única resposta. Obrigado por participar!",
  revoked: "Este convite foi cancelado. Peça um novo convite à equipe da pesquisa.",
};

/** Marca local de "já respondeu" (lembrete por aparelho; não é a garantia — essa é o convite). */
function doneKey(slug: string, code: string | null): string {
  return `iva-done:${slug}${code ? `:${code}` : ""}`;
}

function readDone(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function SurveyPage({ preview }: { preview?: PublicSurvey } = {}) {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const code = preview ? null : params.get("c");
  // Lido uma única vez ao abrir: o envio desta sessão não troca o "Obrigado" pelo aviso.
  const [doneAt] = useState(() => (preview ? null : readDone(doneKey(slug, code))));
  const [ignoreDone, setIgnoreDone] = useState(false);
  const alreadyDone = ignoreDone ? null : doneAt;
  const { data, error, loading, reload } = useAsync<PublicSurvey>(
    (signal) => (preview ? Promise.resolve(preview) : api<PublicSurvey>(`/api/public/surveys/${slug}`, { query: { c: code }, signal })),
    [slug, preview, code],
  );

  useEffect(() => {
    if (data?.title) document.title = `${data.title} — iVent NeoPed`;
  }, [data?.title]);

  return (
    <div className="participant">
      <header className="participant-header">
        <Brand />
        <div className="row">
          {preview && <span className="badge badge-warning">Prévia — preencher é opcional; respostas não são enviadas</span>}
          <ThemeToggle />
        </div>
      </header>
      <main className="participant-main">
        {loading && <Loading label="Carregando questionário…" />}
        {error != null && <ErrorState error={error} onRetry={reload} />}
        {data && alreadyDone && data.acceptingResponses && (
          <section className="thanks">
            <div className="thanks-icon"><CheckCircle2 aria-hidden="true" /></div>
            <h1 className="welcome-title">Você já respondeu esta pesquisa neste aparelho</h1>
            <p className="muted">Resposta enviada em {new Date(alreadyDone).toLocaleString("pt-BR")}. Obrigado por participar!</p>
            <p className="hint">Se outra pessoa vai responder usando este mesmo aparelho, toque abaixo.</p>
            <button type="button" className="btn btn-lg" onClick={() => setIgnoreDone(true)}>Outra pessoa vai responder</button>
          </section>
        )}
        {data && !data.acceptingResponses && data.inviteStatus && !preview && (
          <section className="thanks">
            <div className="thanks-icon is-muted"><KeyRound aria-hidden="true" /></div>
            <h1 className="welcome-title">{data.title}</h1>
            <p className="muted">{INVITE_MESSAGES[data.inviteStatus]}</p>
          </section>
        )}
        {data && !data.acceptingResponses && !data.inviteStatus && !preview && (
          <section className="thanks">
            <div className="thanks-icon is-muted"><Lock aria-hidden="true" /></div>
            <h1 className="welcome-title">{data.title}</h1>
            <p className="muted">{data.status === "closed" ? "Esta pesquisa foi encerrada e não está mais recebendo respostas." : "Esta pesquisa ainda não está aberta para respostas."}</p>
          </section>
        )}
        {data && (data.acceptingResponses || preview) && data.questions && !alreadyDone && (
          <Flow survey={data} preview={Boolean(preview)} inviteCode={code} onDone={() => { try { localStorage.setItem(doneKey(slug, code), new Date().toISOString()); } catch { /* sem armazenamento: segue sem lembrete */ } }} />
        )}
      </main>
    </div>
  );
}

function Flow({ survey, preview, inviteCode, onDone }: { survey: PublicSurvey; preview: boolean; inviteCode: string | null; onDone: () => void }) {
  const questions = survey.questions!;
  const storageKey = preview ? null : `iva-draft:${survey.slug}:${survey.versionId}${inviteCode ? `:${inviteCode}` : ""}`;
  const { draft, setDraft, clear, restart, restored } = useDraft(storageKey);
  const [showError, setShowError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Passos: 0 boas-vindas, 1 perfil, 2..N+1 perguntas, N+2 revisão.
  const firstQuestion = 2;
  const reviewStep = firstQuestion + questions.length;
  const step = Math.min(draft.step, reviewStep);
  const question = step >= firstQuestion && step < reviewStep ? questions[step - firstQuestion]! : null;
  const answer: AnswerInput = question ? draft.answers[question.id!] ?? { questionId: question.id! } : { questionId: "" };
  const missing = useMemo(() => questions.filter((q) => q.required && !isAnswered(q, draft.answers[q.id!])), [questions, draft.answers]);
  const dirty = Object.keys(draft.answers).length > 0 || Boolean(draft.profile.profession);

  // Rascunho antigo: descarta respostas de perguntas que não existem mais nesta versão.
  useEffect(() => {
    const ids = new Set(questions.map((q) => q.id));
    if (Object.keys(draft.answers).some((id) => !ids.has(id))) {
      setDraft((d) => ({ ...d, answers: Object.fromEntries(Object.entries(d.answers).filter(([id]) => ids.has(id))) }));
    }
  }, [questions, draft.answers, setDraft]);

  // O primeiro token emitido fica no rascunho: recarregar a página não "zera" o tempo de preenchimento.
  useEffect(() => {
    if (!draft.startToken && survey.startToken) setDraft((d) => ({ ...d, startToken: survey.startToken }));
  }, [draft.startToken, survey.startToken, setDraft]);

  useEffect(() => {
    if (!dirty || done || preview) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, done, preview]);

  const goTo = useCallback(
    (next: number) => {
      setShowError(false);
      setDraft((d) => ({ ...d, step: next }));
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        mainRef.current?.querySelector<HTMLElement>("h1, h2")?.focus({ preventScroll: true });
      });
    },
    [setDraft],
  );

  const setAnswer = useCallback(
    (next: AnswerInput) => setDraft((d) => ({ ...d, answers: { ...d.answers, [next.questionId]: next } })),
    [setDraft],
  );

  // Na prévia o administrador navega livremente; preencher é opcional.
  const canAdvance = () => {
    if (preview) return true;
    if (step === 1) return Boolean(draft.profile.profession);
    if (question?.required) return isAnswered(question, answer);
    return true;
  };

  const next = () => {
    if (!canAdvance()) {
      setShowError(true);
      return;
    }
    goTo(step + 1);
  };

  // Atalhos de teclado nas perguntas Likert (1–5).
  useEffect(() => {
    if (question?.type !== "likert") return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      const v = Number(e.key);
      if (v >= 1 && v <= 5) setAnswer({ ...answer, numericValue: v, special: null });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [question, answer, setAnswer]);

  const submit = async () => {
    if (preview) {
      setDone(true);
      return;
    }
    if (missing.length) {
      setShowError(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api(`/api/public/surveys/${survey.slug}/responses`, {
        method: "POST",
        body: {
          idempotencyKey: draft.idempotencyKey,
          versionId: survey.versionId,
          startedAt: draft.startedAt,
          startToken: draft.startToken ?? survey.startToken ?? "",
          deviceClass: deviceClass(),
          website: (document.getElementById("iva-website") as HTMLInputElement | null)?.value ?? "",
          inviteCode: inviteCode ?? undefined,
          profile: draft.profile,
          answers: questions.map((q) => draft.answers[q.id!]).filter((a): a is AnswerInput => Boolean(a)),
        },
      });
      clear();
      onDone();
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const msg = err instanceof ApiError && Array.isArray(err.details) ? `${err.message} ${(err.details as string[]).join(" ")}` : errorMessage(err);
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <Thanks />;

  const questionNumber = question ? step - firstQuestion + 1 : null;
  const progress = step <= 1 ? 0 : Math.min(1, (step - firstQuestion + (question ? 0 : 1)) / questions.length);
  const isOpenSection = question?.section === "open";

  return (
    <div className="flow" ref={mainRef}>
      {/* Campo-armadilha: invisível para pessoas e leitores de tela. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="iva-website">Website</label>
        <input id="iva-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {step > 0 && (
        <div className="progress" aria-live="polite">
          <div className="row-between">
            <span className="progress-label">
              {step === 1 && "Perfil profissional"}
              {question && (
                <>
                  <span className="section-chip">{isOpenSection ? survey.openSectionTitle : "Avaliação"}</span>
                  Pergunta <strong className="num">{questionNumber}</strong> de <span className="num">{questions.length}</span>
                </>
              )}
              {step === reviewStep && "Revisar e enviar"}
            </span>
            <span className="num dim">{Math.round(progress * 100)}%</span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div className="progress-fill" style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      )}

      <div className="flow-card" key={step}>
        {step === 0 && (
          <Welcome
            survey={survey}
            consent={draft.consent}
            onConsent={(v) => setDraft((d) => ({ ...d, consent: v }))}
            onStart={() => goTo(Math.max(1, restored ? draft.step : 1))}
            restored={restored && draft.step > 0}
            preview={preview}
            onRestart={restart}
          />
        )}
        {step === 1 && <Profile survey={survey} profile={draft.profile} onChange={(p) => setDraft((d) => ({ ...d, profile: p }))} showError={showError} />}
        {question && (
          <section className="stack-lg" aria-labelledby="question-title">
            <div className="stack-sm">
              {question.category && <p className="eyebrow">{question.category}</p>}
              <h2 id="question-title" tabIndex={-1} className={`question-title${isOpenSection ? " is-open" : ""}`}>
                {question.text}
                {question.required && <span className="req-dot" aria-label="obrigatória">*</span>}
              </h2>
              {question.helpText && <p className="muted">{question.helpText}</p>}
            </div>
            <QuestionInput question={question} answer={answer} onChange={setAnswer} />
            <CommentBox question={question} answer={answer} onChange={setAnswer} />
            {showError && <p className="field-error" role="alert">Esta pergunta é obrigatória.</p>}
          </section>
        )}
        {step === reviewStep && <Review survey={survey} answers={draft.answers} missing={showError ? missing : []} onEdit={(i) => goTo(firstQuestion + i)} />}
      </div>

      {step > 0 && (
        <nav className="flow-nav" aria-label="Navegação do questionário">
          <button type="button" className="btn btn-lg" onClick={() => goTo(step - 1)}>
            <ArrowLeft /> Voltar
          </button>
          {step < reviewStep ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={next}>
              {step === reviewStep - 1 ? "Revisar" : "Próxima"} <ArrowRight />
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={submitting}>
              {submitting ? "Enviando…" : preview ? "Concluir prévia" : "Enviar respostas"} <Send />
            </button>
          )}
        </nav>
      )}
      {submitError && (
        <div className="alert alert-error" role="alert">
          <span>{submitError} Suas respostas continuam salvas neste aparelho; tente enviar novamente.</span>
        </div>
      )}
    </div>
  );
}
