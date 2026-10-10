import { ArrowRight, CheckCircle2, ClipboardCheck, Pencil, ShieldCheck } from "lucide-react";
import type { ProfileInput, ProfileOption, QuestionDef } from "../../shared/domain.ts";
import { answerSummary, isAnswered } from "./QuestionInputs.tsx";
import type { AnswerMap, PublicSurvey } from "./types.ts";

export function Welcome({ survey, consent, onConsent, onStart, restored, onRestart }: {
  survey: PublicSurvey;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onStart: () => void;
  restored: boolean;
  onRestart: () => void;
}) {
  const research = survey.research;
  const needsConsent = Boolean(research?.consentText);
  const quantCount = survey.questions!.filter((q) => q.section === "quantitative").length;
  const openCount = survey.questions!.length - quantCount;
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <p className="eyebrow">Bem-vindo</p>
      <h1 id="welcome-title" className="welcome-title">{survey.title}</h1>
      <div className="welcome-meta">
        <span className="badge badge-accent">{quantCount} afirmações</span>
        <span className="badge">{openCount} perguntas abertas</span>
        <span className="badge">≈ 10 minutos</span>
        {survey.iventVersionLabel && <span className="badge badge-ok">{survey.iventVersionLabel}</span>}
      </div>
      {survey.instructions && <div className="instructions">{survey.instructions}</div>}
      <div className="privacy-note">
        <ShieldCheck aria-hidden="true" />
        <p>Participação anônima: não pedimos nome, e-mail nem contato. Pedimos apenas sua categoria profissional e, se quiser, sua experiência prévia.</p>
      </div>
      {research?.participantInfo && (
        <details className="research-box">
          <summary>Informações ao participante</summary>
          <div className="instructions">{research.participantInfo}</div>
          <p className="hint">
            {[research.institution, research.leadResearcher && `Pesquisador responsável: ${research.leadResearcher}`, research.protocolNumber && `Protocolo: ${research.protocolNumber}`].filter(Boolean).join(" · ")}
          </p>
        </details>
      )}
      {needsConsent && (
        <div className="research-box">
          <p className="field-label">Termo de consentimento</p>
          <div className="instructions consent-text">{research!.consentText}</div>
          <label className="checkbox consent-check">
            <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} />
            Li e concordo em participar.
          </label>
        </div>
      )}
      {restored && (
        <div className="alert alert-info">
          <ClipboardCheck />
          <div className="row grow">
            <span className="grow">Encontramos respostas salvas neste aparelho. Você pode continuar de onde parou.</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onRestart}>Recomeçar do zero</button>
          </div>
        </div>
      )}
      <div className="flow-actions">
        <button type="button" className="btn btn-primary btn-lg" disabled={needsConsent && !consent} onClick={onStart}>
          {restored ? "Continuar" : "Começar"} <ArrowRight />
        </button>
      </div>
    </section>
  );
}

function OptionCards({ name, options, value, onChange, required }: { name: string; options: ProfileOption[]; value: string | null | undefined; onChange: (v: string | null) => void; required?: boolean }) {
  return (
    <div className="option-cards" role="radiogroup" aria-label={name} aria-required={required}>
      {options.map((o) => {
        const active = value === o.code;
        return (
          <button key={o.code} type="button" role="radio" aria-checked={active} className={`option-card${active ? " is-active" : ""}`} onClick={() => onChange(active && !required ? null : o.code)}>
            <span className="choice-mark" aria-hidden="true">{active && <CheckCircle2 />}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Profile({ survey, profile, onChange, showError }: { survey: PublicSurvey; profile: ProfileInput; onChange: (p: ProfileInput) => void; showError: boolean }) {
  const o = survey.profileOptions!;
  return (
    <section className="stack-lg" aria-labelledby="profile-title">
      <div className="stack-sm">
        <p className="eyebrow">Perfil profissional</p>
        <h2 id="profile-title" className="step-title">Conte um pouco sobre você</h2>
        <p className="muted">Usamos estas informações apenas para comparar percepções entre grupos.</p>
      </div>
      <fieldset className="profile-group">
        <legend>Categoria profissional <span className="req">obrigatório</span></legend>
        <OptionCards name="Categoria profissional" options={o.professions} value={profile.profession} required onChange={(v) => onChange({ ...profile, profession: v ?? "" })} />
        {showError && !profile.profession && <p className="field-error" role="alert">Selecione sua categoria profissional para continuar.</p>}
      </fieldset>
      <fieldset className="profile-group">
        <legend>Tempo de experiência <span className="opt">opcional</span></legend>
        <OptionCards name="Tempo de experiência" options={o.experienceYears} value={profile.experienceYears} onChange={(v) => onChange({ ...profile, experienceYears: v })} />
      </fieldset>
      <fieldset className="profile-group">
        <legend>Experiência prévia com simuladores de ventilação mecânica <span className="opt">opcional</span></legend>
        <OptionCards name="Experiência com simuladores" options={o.simulatorExperience} value={profile.simulatorExperience} onChange={(v) => onChange({ ...profile, simulatorExperience: v })} />
      </fieldset>
      <fieldset className="profile-group">
        <legend>Experiência prévia com o iVent NeoPed <span className="opt">opcional</span></legend>
        <OptionCards name="Experiência com o iVent" options={o.iventExperience} value={profile.iventExperience} onChange={(v) => onChange({ ...profile, iventExperience: v })} />
      </fieldset>
    </section>
  );
}

export function Review({ survey, answers, onEdit, missing }: { survey: PublicSurvey; answers: AnswerMap; onEdit: (index: number) => void; missing: QuestionDef[] }) {
  return (
    <section className="stack-lg" aria-labelledby="review-title">
      <div className="stack-sm">
        <p className="eyebrow">Revisar</p>
        <h2 id="review-title" className="step-title">Confira suas respostas</h2>
        <p className="muted">Toque em qualquer item para alterar. Nada é enviado até você confirmar.</p>
      </div>
      {missing.length > 0 && (
        <div className="alert alert-warning" role="alert">
          <span>Faltam {missing.length} pergunta(s) obrigatória(s). Elas estão destacadas abaixo.</span>
        </div>
      )}
      <ol className="review-list">
        {survey.questions!.map((q, i) => {
          const a = answers[q.id!];
          const answered = isAnswered(q, a);
          const isMissing = missing.includes(q);
          return (
            <li key={q.id} className={`review-item${isMissing ? " is-missing" : ""}`}>
              <button type="button" className="review-btn" onClick={() => onEdit(i)}>
                <span className="review-index num">{i + 1}</span>
                <span className="review-body">
                  <span className="review-q">{q.text}</span>
                  <span className={`review-a${answered ? "" : " dim"}`}>{answerSummary(q, a)}</span>
                  {a?.comment?.trim() && <span className="review-c">Comentário: {a.comment.trim()}</span>}
                </span>
                <Pencil className="review-edit" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Thanks() {
  return (
    <section className="thanks" aria-labelledby="thanks-title">
      <div className="thanks-icon"><CheckCircle2 aria-hidden="true" /></div>
      <h1 id="thanks-title" className="welcome-title">Obrigado por participar!</h1>
      <p className="muted">Suas respostas foram registradas com sucesso. Elas ajudam diretamente a evoluir o iVent NeoPed.</p>
      <p className="hint">Você já pode fechar esta página.</p>
    </section>
  );
}
