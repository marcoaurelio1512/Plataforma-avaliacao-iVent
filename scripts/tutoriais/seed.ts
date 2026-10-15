/**
 * Respostas fictícias para os vídeos do "Como usar": enviadas pela API pública
 * real, para que Dashboard, nuvem e comparações tenham conteúdo plausível.
 */
import { randomUUID } from "node:crypto";

type Persona = {
  profession: string;
  experienceYears: string;
  simulatorExperience: string;
  iventExperience: string;
  deviceClass: "mobile" | "tablet" | "desktop";
  /** Uma nota (1–5) por pergunta Likert, na ordem; 0 = "Não utilizei este recurso". */
  scores: number[];
  texts: Partial<Record<string, string>>;
  comment?: [questionKey: string, text: string];
};

const PERSONAS: Persona[] = [
  { profession: "resident_neonatology", experienceYears: "lt1", simulatorExperience: "basic", iventExperience: "first", deviceClass: "mobile", scores: [4, 3, 4, 5, 4, 5, 5, 4, 3, 5], texts: { pontos_positivos: "As curvas de pressão e fluxo são muito claras e o pulmão 3D ajuda a entender a complacência.", dificuldades: "No início não encontrei o menu de alarmes." }, comment: ["facilidade_navegacao", "Precisei de ajuda para achar o menu de alarmes."] },
  { profession: "resident_neonatology", experienceYears: "1to3", simulatorExperience: "intermediate", iventExperience: "before", deviceClass: "desktop", scores: [5, 4, 5, 4, 5, 5, 4, 5, 4, 5], texts: { pontos_positivos: "Os loops pressão-volume e a gasometria simulada são excelentes para o raciocínio clínico.", melhorias_interface: "Aumentar o tamanho dos botões de PEEP e PIP." } },
  { profession: "resident_neonatology", experienceYears: "lt1", simulatorExperience: "none", iventExperience: "first", deviceClass: "mobile", scores: [3, 2, 3, 4, 3, 4, 0, 3, 2, 4], texts: { dificuldades: "A interface ficou confusa no celular, as curvas ficam pequenas.", novas_funcionalidades: "Um tutorial guiado no primeiro acesso." }, comment: ["interface_visual", "No celular as curvas ficam pequenas demais."] },
  { profession: "resident_neonatology", experienceYears: "1to3", simulatorExperience: "basic", iventExperience: "first", deviceClass: "tablet", scores: [4, 4, 4, 4, 4, 5, 4, 3, 4, 5], texts: { pontos_positivos: "Gostei das curvas em tempo real e da EIT.", sugestoes_gerais: "Parabéns pelo simulador, muito útil para a residência." } },
  { profession: "resident_neonatology", experienceYears: "4to5", simulatorExperience: "advanced", iventExperience: "frequent", deviceClass: "desktop", scores: [5, 5, 5, 4, 5, 5, 5, 4, 5, 5], texts: { pontos_positivos: "Realismo das respostas fisiológicas e os cenários de desmame.", novas_funcionalidades: "Cenários de ventilação de alta frequência." } },
  { profession: "resident_neonatology", experienceYears: "lt1", simulatorExperience: "basic", iventExperience: "first", deviceClass: "mobile", scores: [4, 3, 3, 4, 4, 4, 3, 2, 3, 4], texts: { dificuldades: "O simulador travou duas vezes ao trocar de modo ventilatório.", melhorias_interface: "Legendas maiores nas curvas." } },
  { profession: "resident_neonatology", experienceYears: "1to3", simulatorExperience: "intermediate", iventExperience: "before", deviceClass: "desktop", scores: [5, 4, 4, 5, 4, 5, 5, 4, 4, 5], texts: { pontos_positivos: "Pulmão 3D e gasometria simulada tornam o aprendizado muito mais visual." } },
  { profession: "physiotherapist", experienceYears: "gt5", simulatorExperience: "advanced", iventExperience: "before", deviceClass: "desktop", scores: [4, 4, 5, 4, 5, 4, 5, 3, 5, 5], texts: { pontos_positivos: "Os loops e a EIT são excelentes para discutir recrutamento alveolar.", dificuldades: "O simulador travou uma vez durante a troca de paciente.", sugestoes_gerais: "Incluir cenários de fisioterapia respiratória." } },
  { profession: "physiotherapist", experienceYears: "4to5", simulatorExperience: "intermediate", iventExperience: "first", deviceClass: "desktop", scores: [5, 5, 4, 4, 5, 5, 4, 4, 5, 5], texts: { pontos_positivos: "As curvas de fluxo e volume ajudam a ensinar assincronia." }, comment: ["recursos_educacionais", "Ótimo para aulas de assincronia paciente-ventilador."] },
  { profession: "physiotherapist", experienceYears: "1to3", simulatorExperience: "basic", iventExperience: "first", deviceClass: "mobile", scores: [3, 3, 4, 3, 4, 4, 3, 3, 3, 4], texts: { dificuldades: "A interface confusa na primeira vez, demorei a entender os alarmes.", melhorias_interface: "Agrupar os controles de oxigenação." } },
  { profession: "physiotherapist", experienceYears: "gt5", simulatorExperience: "advanced", iventExperience: "frequent", deviceClass: "desktop", scores: [5, 4, 5, 5, 5, 5, 5, 5, 5, 5], texts: { pontos_positivos: "Realismo da mecânica respiratória e dos loops.", novas_funcionalidades: "Exportar o caso para discutir em grupo." } },
  { profession: "physiotherapist", experienceYears: "4to5", simulatorExperience: "intermediate", iventExperience: "before", deviceClass: "tablet", scores: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4], texts: { pontos_positivos: "Curvas claras e boa resposta aos ajustes de PEEP." } },
];

type PublicQuestion = { id: string; key: string; type: string };
type PublicPayload = { versionId: string; startToken: string; questions?: PublicQuestion[] };

async function getPayload(baseUrl: string, slug: string): Promise<Required<PublicPayload>> {
  const res = await fetch(`${baseUrl}/api/public/surveys/${slug}`);
  const body = (await res.json()) as { data: PublicPayload };
  if (!res.ok || !body.data.questions) throw new Error(`Pesquisa ${slug} indisponível (${res.status}).`);
  return body.data as Required<PublicPayload>;
}

function buildAnswers(questions: PublicQuestion[], p: Persona) {
  const likert = questions.filter((q) => q.type === "likert");
  return questions.map((q) => {
    const idx = likert.indexOf(q);
    if (idx < 0) return { questionId: q.id, textValue: p.texts[q.key] ?? null };
    const score = p.scores[idx] ?? 4;
    const comment = p.comment?.[0] === q.key ? p.comment[1] : null;
    return score === 0 ? { questionId: q.id, special: "not_used", comment } : { questionId: q.id, numericValue: score, comment };
  });
}

export async function seedResponses(baseUrl: string, slug: string): Promise<number> {
  for (const p of PERSONAS) {
    const payload = await getPayload(baseUrl, slug);
    const res = await fetch(`${baseUrl}/api/public/surveys/${slug}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: randomUUID().replaceAll("-", ""),
        versionId: payload.versionId,
        startedAt: Date.now() - 6 * 60_000,
        startToken: payload.startToken,
        deviceClass: p.deviceClass,
        profile: { profession: p.profession, experienceYears: p.experienceYears, simulatorExperience: p.simulatorExperience, iventExperience: p.iventExperience },
        answers: buildAnswers(payload.questions, p),
      }),
    });
    if (!res.ok) throw new Error(`Falha ao enviar resposta: ${res.status} ${await res.text()}`);
  }
  return PERSONAS.length;
}
