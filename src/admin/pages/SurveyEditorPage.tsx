import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AlertTriangle, Eye, Info, Plus, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, type QuestionType } from "../../../shared/domain.ts";
import { isStructuralChange } from "../../../shared/surveyChanges.ts";
import { ErrorState, Loading } from "../../components/States.tsx";
import { ApiError, api } from "../../lib/api.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import { QuestionEditor, blankQuestion, newUid, type EditableQuestion } from "../components/QuestionEditor.tsx";
import { useToast } from "../components/useToast.tsx";
import { useScope } from "../scope.tsx";
import type { SurveyDetail } from "../types.ts";

interface Meta {
  iventVersionId: string | null;
  consentText: string | null;
  participantInfo: string | null;
  protocolNumber: string | null;
  institution: string | null;
  leadResearcher: string | null;
}

const EMPTY_META: Meta = { iventVersionId: null, consentText: null, participantInfo: null, protocolNumber: null, institution: null, leadResearcher: null };

export default function SurveyEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { iventVersions, reloadSurveys } = useScope();
  const toast = useToast();
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [openSectionTitle, setOpenSectionTitle] = useState("Sua opinião");
  const [questions, setQuestions] = useState<EditableQuestion[]>(() => (isNew ? [blankQuestion("likert")] : []));
  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(isNew ? questions.map((q) => q.uid) : []));
  const [dirty, setDirty] = useState(false);
  const [metaDirty, setMetaDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const hydrate = (d: SurveyDetail) => {
    setDetail(d);
    setTitle(d.title);
    setInstructions(d.instructions);
    setOpenSectionTitle(d.openSectionTitle);
    setQuestions(d.questions.map((q) => ({ ...q, uid: q.id ?? newUid() })));
    setMeta({ iventVersionId: d.iventVersionId, consentText: d.consentText, participantInfo: d.participantInfo, protocolNumber: d.protocolNumber, institution: d.institution, leadResearcher: d.leadResearcher });
    setDirty(false);
    setMetaDirty(false);
  };

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api<SurveyDetail>(`/api/admin/surveys/${id}`)
      .then(hydrate)
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, [id, isNew]);

  useEffect(() => {
    if (!dirty && !metaDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, metaDirty]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const currentVersion = detail?.versions.find((v) => v.id === detail.currentVersionId);
  const hasResponses = Boolean(currentVersion && currentVersion.responseCount > 0);
  const nextVersionNumber = (detail?.versions[0]?.versionNumber ?? 1) + 1;

  const update = (fn: (qs: EditableQuestion[]) => EditableQuestion[]) => {
    setQuestions(fn);
    setDirty(true);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    update((qs) => arrayMove(qs, qs.findIndex((q) => q.uid === e.active.id), qs.findIndex((q) => q.uid === e.over!.id)));
  };

  const addQuestion = (type: QuestionType) => {
    const q = blankQuestion(type);
    update((qs) => [...qs, q]);
    setExpanded((s) => new Set(s).add(q.uid));
  };

  const toggle = (uid: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const content = useMemo(
    () => ({
      title,
      instructions,
      openSectionTitle,
      questions: questions.map(({ uid: _uid, id: _id, ...q }) => ({
        ...q,
        key: q.key || undefined,
        options: q.options.map((o) => ({ label: o.label, value: o.value || undefined })),
      })),
    }),
    [title, instructions, openSectionTitle, questions],
  );

  // Mesma regra do servidor: com respostas, só mudanças de estrutura criam nova versão.
  const willVersion = hasResponses && dirty && detail != null && isStructuralChange(detail.questions, content.questions);
  const willCorrect = hasResponses && dirty && !willVersion;

  const confirmSave = () => {
    if (willVersion) {
      return window.confirm(`A alteração muda a estrutura do questionário. Salvar criará a versão ${nextVersionNumber}; as respostas anteriores continuam ligadas à versão original. Continuar?`);
    }
    if (willCorrect) {
      return window.confirm(`As ${currentVersion!.responseCount} resposta(s) já recebidas passarão a exibir os textos corrigidos (os valores respondidos não mudam). Continuar?`);
    }
    return true;
  };

  const save = async () => {
    if (!confirmSave()) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (isNew) {
        const created = await api<SurveyDetail>("/api/admin/surveys", { method: "POST", body: { ...content, meta } });
        reloadSurveys();
        setDirty(false);
        setMetaDirty(false);
        navigate(`/admin/pesquisas/${created.id}`, { replace: true });
        return;
      }
      let message = "Alterações salvas";
      if (dirty) {
        const res = await api<{ versionCreated: boolean; correctedWithResponses: boolean; versionNumber: number; survey: SurveyDetail }>(`/api/admin/surveys/${id}/content`, { method: "PUT", body: content });
        if (res.versionCreated) message = `Nova versão v${res.versionNumber} criada — histórico preservado`;
        else if (res.correctedWithResponses) message = `Correções aplicadas na v${res.versionNumber}`;
      }
      if (metaDirty) await api(`/api/admin/surveys/${id}/meta`, { method: "PUT", body: meta });
      hydrate(await api<SurveyDetail>(`/api/admin/surveys/${id}`));
      reloadSurveys();
      toast.show(message);
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  const setMetaField = <K extends keyof Meta>(k: K, v: Meta[K]) => {
    setMeta((m) => ({ ...m, [k]: v }));
    setMetaDirty(true);
  };

  if (loading) return <Loading />;
  if (loadError != null) return <ErrorState error={loadError} />;

  const details = saveError instanceof ApiError && Array.isArray(saveError.details) ? (saveError.details as { path?: string; message?: string }[]) : [];

  return (
    <>
      <PageHeader
        eyebrow={isNew ? "Criar questionário" : `Editar · questionário v${detail?.currentVersionNumber ?? 1}`}
        title={title || "Novo questionário"}
        actions={
          <>
            {!isNew && <Link className="btn" to={`/admin/pesquisas/${id}/previa`}><Eye /> Prévia</Link>}
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || (!dirty && !metaDirty && !isNew)}>
              <Save /> {saving ? "Salvando…" : isNew ? "Salvar como rascunho" : "Salvar alterações"}
            </button>
          </>
        }
      />
      {hasResponses && (
        <div className={`alert ${willVersion ? "alert-warning" : "alert-info"}`} role="status">
          {willVersion ? <AlertTriangle /> : <Info />}
          <div className="stack-sm">
            <span>
              Esta versão já recebeu {currentVersion!.responseCount} resposta(s). Você pode <b>corrigir textos</b> — pergunta, texto de apoio, categoria,
              rótulos das opções e da escala — e reordenar perguntas na própria versão. Incluir ou remover perguntas ou opções, ou mudar tipo, seção,
              escala e marcações, cria uma <b>nova versão</b> para preservar os dados.
            </span>
            {willVersion && <b>Ao salvar: será criada a versão v{nextVersionNumber}.</b>}
            {willCorrect && <b>Ao salvar: correção aplicada na v{detail?.currentVersionNumber ?? 1}.</b>}
          </div>
        </div>
      )}
      {(dirty || metaDirty) && <p className="panel-note">Há alterações não salvas.</p>}
      {saveError != null && (
        <div className="alert alert-error" role="alert">
          <div className="stack-sm">
            <span>{(saveError as Error).message}</span>
            {details.map((d, i) => (
              <span key={i} className="dim">{d.path ? `${d.path}: ` : ""}{d.message ?? String(d)}</span>
            ))}
          </div>
        </div>
      )}

      <div className="editor-layout">
        <div className="stack-lg">
          <section className="panel">
            <h2 className="panel-title">Apresentação</h2>
            <div className="field">
              <label htmlFor="s-title">Título</label>
              <input id="s-title" className="input" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
            </div>
            <div className="field">
              <label htmlFor="s-instr">Instruções ao participante</label>
              <textarea id="s-instr" className="textarea" rows={8} value={instructions} onChange={(e) => { setInstructions(e.target.value); setDirty(true); }} />
            </div>
            <div className="field">
              <label htmlFor="s-open">Título da seção de perguntas abertas</label>
              <input id="s-open" className="input" value={openSectionTitle} onChange={(e) => { setOpenSectionTitle(e.target.value); setDirty(true); }} />
            </div>
          </section>

          <section className="panel" aria-labelledby="q-title">
            <div className="panel-head">
              <h2 id="q-title" className="panel-title">Perguntas ({questions.length})</h2>
              <div className="row">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExpanded(new Set(questions.map((q) => q.uid)))}>Expandir todas</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExpanded(new Set())}>Recolher todas</button>
              </div>
            </div>
            <p className="panel-note">Arraste pela alça (ou use as setas) para reordenar.</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={questions.map((q) => q.uid)} strategy={verticalListSortingStrategy}>
                <ol className="q-list">
                  {questions.map((q, i) => (
                    <QuestionEditor
                      key={q.uid}
                      index={i}
                      total={questions.length}
                      question={q}
                      expanded={expanded.has(q.uid)}
                      locked={hasResponses}
                      onToggle={() => toggle(q.uid)}
                      onChange={(next) => update((qs) => qs.map((x) => (x.uid === q.uid ? next : x)))}
                      onRemove={() => window.confirm("Excluir esta pergunta?") && update((qs) => qs.filter((x) => x.uid !== q.uid))}
                      onDuplicate={() => update((qs) => [...qs.slice(0, i + 1), { ...q, uid: newUid(), id: undefined, key: "" }, ...qs.slice(i + 1)])}
                      onMove={(delta) => update((qs) => arrayMove(qs, i, Math.max(0, Math.min(qs.length - 1, i + delta))))}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
            <div className="add-question">
              <span className="field-label"><Plus size={14} /> Adicionar pergunta:</span>
              {QUESTION_TYPES.map((t) => (
                <button key={t} type="button" className="btn btn-sm" onClick={() => addQuestion(t)}>{QUESTION_TYPE_LABELS[t]}</button>
              ))}
            </div>
          </section>
        </div>

        <aside className="stack-lg">
          <section className="panel">
            <h2 className="panel-title">Versão do iVent avaliada</h2>
            <select className="select" aria-label="Versão do iVent" value={meta.iventVersionId ?? ""} onChange={(e) => setMetaField("iventVersionId", e.target.value || null)}>
              <option value="">Não associada</option>
              {iventVersions.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            <p className="panel-note">Cada resposta registra a versão vigente no momento do envio. Cadastre versões em Configurações.</p>
          </section>
          <section className="panel">
            <h2 className="panel-title">Pesquisa científica <span className="dim">(opcional)</span></h2>
            <p className="panel-note">Preencha somente se aplicável. A plataforma não declara validação do questionário nem aprovação ética.</p>
            <div className="field">
              <label htmlFor="m-inst">Instituição</label>
              <input id="m-inst" className="input" value={meta.institution ?? ""} onChange={(e) => setMetaField("institution", e.target.value || null)} />
            </div>
            <div className="field">
              <label htmlFor="m-lead">Pesquisador responsável</label>
              <input id="m-lead" className="input" value={meta.leadResearcher ?? ""} onChange={(e) => setMetaField("leadResearcher", e.target.value || null)} />
            </div>
            <div className="field">
              <label htmlFor="m-prot">Número do protocolo</label>
              <input id="m-prot" className="input" value={meta.protocolNumber ?? ""} onChange={(e) => setMetaField("protocolNumber", e.target.value || null)} />
            </div>
            <div className="field">
              <label htmlFor="m-info">Texto de informação ao participante</label>
              <textarea id="m-info" className="textarea" value={meta.participantInfo ?? ""} onChange={(e) => setMetaField("participantInfo", e.target.value || null)} />
            </div>
            <div className="field">
              <label htmlFor="m-consent">Termo de consentimento</label>
              <textarea id="m-consent" className="textarea" value={meta.consentText ?? ""} onChange={(e) => setMetaField("consentText", e.target.value || null)} />
              <p className="panel-note">Se preenchido, o participante precisa aceitar antes de começar.</p>
            </div>
          </section>
          {detail && detail.versions.length > 0 && (
            <section className="panel">
              <h2 className="panel-title">Histórico de versões</h2>
              <ul className="version-list">
                {detail.versions.map((v) => (
                  <li key={v.id} className="row-between">
                    <span>v{v.versionNumber}{v.id === detail.currentVersionId && <span className="badge badge-ok">atual</span>}</span>
                    <span className="dim num">{v.responseCount} resp.</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
      {toast.node}
    </>
  );
}
