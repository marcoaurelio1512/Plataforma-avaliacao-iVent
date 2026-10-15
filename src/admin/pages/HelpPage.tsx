/**
 * "Como usar": guia completo da plataforma para quem conduz a pesquisa.
 * Texto estático, sem chamadas à API.
 */
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "../components/PageHeader.tsx";
import { TutorialIndex, TutorialVideo } from "../components/TutorialVideo.tsx";

const SECTIONS: { id: string; title: string }[] = [
  { id: "visao-geral", title: "1. Visão geral e roteiro rápido" },
  { id: "acesso", title: "2. Primeiro acesso" },
  { id: "navegacao", title: "3. Menu, pesquisa em análise e filtros" },
  { id: "pesquisas", title: "4. Pesquisas: estados e ações" },
  { id: "editor", title: "5. Criar e editar questionários" },
  { id: "versoes-questionario", title: "6. Versões do questionário (histórico)" },
  { id: "publicar", title: "7. Publicar: link e QR Code" },
  { id: "convites", title: "8. Convites de uso único" },
  { id: "participante", title: "9. O que o participante vê" },
  { id: "dashboard", title: "10. Dashboard" },
  { id: "estatistica", title: "11. Como ler as estatísticas" },
  { id: "dados", title: "12. Participantes e Respostas" },
  { id: "comentarios", title: "13. Comentários e Sugestões" },
  { id: "nuvem", title: "14. Nuvem de Palavras" },
  { id: "ia", title: "15. Análise por IA" },
  { id: "prioridades", title: "16. Oportunidades de melhoria" },
  { id: "grupos", title: "17. Comparação entre grupos" },
  { id: "versoes-ivent", title: "18. Comparação entre versões do iVent" },
  { id: "relatorios", title: "19. Relatórios (PDF, Excel, CSV)" },
  { id: "configuracoes", title: "20. Configurações" },
  { id: "estudo", title: "21. Roteiro para o estudo com residentes e fisioterapeutas" },
  { id: "cientifico", title: "22. Uso científico e LGPD" },
  { id: "faq", title: "23. Perguntas frequentes e problemas" },
];

function Section({ id, children }: { id: string; children: ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section id={id} className="help-section" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="help-h2">{title}</h2>
      {children}
    </section>
  );
}

function Note({ kind = "info", children }: { kind?: "info" | "tip" | "warning"; children: ReactNode }) {
  const icon = kind === "warning" ? <AlertTriangle /> : kind === "tip" ? <Lightbulb /> : <Info />;
  return (
    <div className={`alert ${kind === "warning" ? "alert-warning" : "alert-info"}`}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="help-steps">{children}</ol>;
}

export default function HelpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Guia da plataforma"
        title="Como usar"
        description="Passo a passo de cada tela do iVent NeoPed — Avaliação: da criação do questionário ao relatório final. Use o índice para ir direto ao assunto."
      />
      <div className="help-layout">
        <nav className="help-toc" aria-label="Índice do guia">
          <p className="eyebrow">Índice</p>
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
            ))}
          </ol>
        </nav>

        <article className="help-body">
          <Section id="visao-geral">
            <p>A plataforma tem duas áreas:</p>
            <ul>
              <li><b>Área do participante</b> — o link público (ou QR Code) onde residentes, fisioterapeutas e outros profissionais respondem, de forma anônima, pelo celular, tablet ou computador.</li>
              <li><b>Painel administrativo</b> — esta área, protegida por login, onde você cria questionários, acompanha as respostas, analisa os resultados e gera relatórios.</li>
            </ul>
            <p><b>Vídeos do guia</b> — cada um mostra uma parte da plataforma, com narração e legendas em português:</p>
            <TutorialIndex />
            <p><b>Roteiro rápido do início ao fim:</b></p>
            <Steps>
              <li>Entre no painel e troque a senha inicial (<a href="#acesso">seção 2</a>).</li>
              <li>Revise o questionário inicial em <b>Pesquisas → Editar</b> e confira tudo em <b>Prévia</b> (<a href="#editor">seção 5</a>).</li>
              <li>Confirme a versão do iVent associada à pesquisa (<a href="#versoes-ivent">seção 18</a>).</li>
              <li>Se quiser garantir uma resposta por pessoa, ative os <b>Convites de uso único</b> e gere um convite por participante (<a href="#convites">seção 8</a>).</li>
              <li>Clique em <b>Publicar</b> e distribua o link, o QR Code ou os convites (<a href="#publicar">seção 7</a>).</li>
              <li>Acompanhe as respostas no <b>Dashboard</b> (<a href="#dashboard">seção 10</a>).</li>
              <li>Ao final da coleta, clique em <b>Encerrar</b>, analise textos, nuvem, grupos e IA, e baixe os <b>Relatórios</b> (<a href="#relatorios">seção 19</a>).</li>
            </Steps>
          </Section>

          <Section id="acesso">
            <TutorialVideo id="primeiro-acesso" />
            <Steps>
              <li>Acesse <code>/admin</code> no endereço da plataforma e entre com o e-mail e a senha do administrador.</li>
              <li>Vá em <b>Configurações → Segurança</b> e defina uma senha nova (mínimo de 10 caracteres, com letras e números). As outras sessões abertas são encerradas automaticamente.</li>
              <li>Use o botão de <b>sol/lua</b> no topo para alternar entre tema claro e escuro. A escolha fica salva no seu navegador.</li>
              <li>Para sair, use o ícone de saída no rodapé do menu lateral. A sessão também expira sozinha após algumas horas sem uso.</li>
            </Steps>
            <Note kind="warning">Após 10 tentativas de login erradas em 15 minutos, o acesso é bloqueado temporariamente. Aguarde alguns minutos e tente de novo.</Note>
          </Section>

          <Section id="navegacao">
            <p><b>Menu lateral</b> — organizado em quatro grupos: <i>Visão geral</i> (Dashboard, Pesquisas, Criar Questionário), <i>Dados coletados</i> (Participantes, Respostas, Comentários e Sugestões), <i>Análise</i> (Nuvem de Palavras, Análise por IA, Comparação entre Grupos, Comparação entre Versões, Relatórios) e <i>Sistema</i> (Configurações e este guia). No celular, o menu abre pelo botão ☰ no topo.</p>
            <p><b>Pesquisa em análise</b> — a caixa de seleção no topo define qual pesquisa todas as telas de análise mostram. Ao lado aparece o estado da pesquisa (Rascunho, Publicada, Encerrada, Arquivada).</p>
            <p><b>Filtros</b> — as telas de análise têm uma barra de filtros. Conforme a tela, você pode filtrar por:</p>
            <ul>
              <li><b>Versão do questionário</b> — aparece quando a pesquisa tem mais de uma versão. O padrão é a versão mais recente que já tem respostas.</li>
              <li><b>Profissão</b> — Todos, Médico residente de Neonatologia, Fisioterapeuta ou outras categorias cadastradas.</li>
              <li><b>Pergunta</b> — para analisar apenas os textos de uma pergunta.</li>
              <li><b>Versão do iVent</b> e <b>período</b> (De / Até).</li>
            </ul>
            <Note kind="tip">Os filtros ficam no endereço da página. Copie o link do navegador para mostrar a um colega exatamente a mesma visão (ele também precisará estar logado). “Limpar filtros” volta ao padrão.</Note>
          </Section>

          <Section id="pesquisas">
            <p>Em <b>Pesquisas</b> cada questionário aparece como um cartão com estado, versão, versão do iVent, número de respostas e, se houver, a situação dos convites.</p>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Estado</th><th>O que significa</th><th>Ações disponíveis</th></tr></thead>
                <tbody>
                  <tr><td><b>Rascunho</b></td><td>Em preparação. O link público não mostra as perguntas.</td><td>Publicar, Editar, Prévia, Duplicar, Arquivar, Excluir (só sem respostas)</td></tr>
                  <tr><td><b>Publicada</b></td><td>Recebendo respostas pelo link, QR Code ou convites.</td><td>Encerrar, Link e QR, Convites, Editar, Prévia, Duplicar, Arquivar</td></tr>
                  <tr><td><b>Encerrada</b></td><td>Coleta parada. Os dados ficam disponíveis para análise.</td><td>Reabrir, Editar, Prévia, Duplicar, Arquivar</td></tr>
                  <tr><td><b>Arquivada</b></td><td>Fora de uso. O link deixa de funcionar; os dados são preservados.</td><td>Desarquivar, Prévia, Duplicar</td></tr>
                </tbody>
              </table>
            </div>
            <ul>
              <li><b>Duplicar</b> cria um rascunho igual, mantendo as mesmas chaves de perguntas — útil para avaliar uma nova versão do iVent com perguntas comparáveis.</li>
              <li><b>Excluir</b> só existe para rascunhos sem nenhuma resposta. Dados coletados nunca são apagados: use <b>Arquivar</b>.</li>
              <li><b>Ver resultados</b> abre o Dashboard já com aquela pesquisa selecionada.</li>
            </ul>
          </Section>

          <Section id="editor">
            <TutorialVideo id="criar-questionario" />
            <p>Use <b>Criar Questionário</b> (menu) ou <b>Editar</b> (no cartão da pesquisa). A tela tem três blocos.</p>
            <h3 className="help-h3">Apresentação</h3>
            <ul>
              <li><b>Título</b> — aparece no topo da página do participante.</li>
              <li><b>Instruções ao participante</b> — texto da tela de boas-vindas (as quebras de linha são respeitadas). O questionário inicial já traz a explicação da escala 1 a 5.</li>
              <li><b>Título da seção de perguntas abertas</b> — por exemplo, “Sua opinião sobre o iVent NeoPed”.</li>
            </ul>
            <h3 className="help-h3">Perguntas</h3>
            <p>Clique no texto de uma pergunta para abrir o editor. Para adicionar, use os botões no fim da lista (“Adicionar pergunta”). Tipos disponíveis:</p>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Tipo</th><th>Uso</th></tr></thead>
                <tbody>
                  <tr><td>Escala Likert 1–5</td><td>Afirmações de concordância (1 = Discordo totalmente … 5 = Concordo totalmente).</td></tr>
                  <tr><td>Escala numérica configurável</td><td>Notas com mínimo e máximo à sua escolha (ex.: 0 a 10), com rótulos nas pontas.</td></tr>
                  <tr><td>Sim/Não</td><td>Pergunta binária.</td></tr>
                  <tr><td>Múltipla escolha</td><td>Uma única opção entre várias.</td></tr>
                  <tr><td>Seleção múltipla</td><td>Várias opções podem ser marcadas.</td></tr>
                  <tr><td>Texto curto / Texto longo</td><td>Respostas livres (até 300 / 5.000 caracteres).</td></tr>
                </tbody>
              </table>
            </div>
            <p>Opções de cada pergunta:</p>
            <ul>
              <li><b>Seção</b> — “Avaliação (quantitativa)” ou “Sua opinião (aberta)”.</li>
              <li><b>Categoria</b> — agrupa a pergunta (ex.: Interface, Usabilidade). É usada nos gráficos, nas prioridades de melhoria e na comparação entre versões. Mantenha os mesmos nomes de categoria entre questionários.</li>
              <li><b>Chave estável</b> — identificador técnico gerado automaticamente. É ele que permite comparar a mesma pergunta entre versões. Normalmente não precisa ser alterado.</li>
              <li><b>Obrigatória</b> — o participante não avança sem responder.</li>
              <li><b>Campo “Comentários ou sugestões sobre este item”</b> — caixa opcional abaixo da nota.</li>
              <li><b>Opção “Não utilizei este recurso”</b> e <b>Opção “Não se aplica”</b> — botões extras. Essas marcações <b>nunca entram em médias</b> e nunca viram zero; são contadas à parte.</li>
            </ul>
            <p><b>Reordenar:</b> arraste pela alça (⋮⋮) à esquerda da pergunta ou use as setas ↑ ↓. <b>Duplicar</b> e <b>Excluir</b> ficam à direita.</p>
            <h3 className="help-h3">Painel lateral</h3>
            <ul>
              <li><b>Versão do iVent avaliada</b> — associa a pesquisa a uma versão (ex.: iVent 1.0). Cada resposta registra a versão vigente no momento do envio.</li>
              <li><b>Pesquisa científica (opcional)</b> — instituição, pesquisador responsável, número do protocolo, texto de informação ao participante e termo de consentimento. Se o termo estiver preenchido, o participante precisa marcar “Li e concordo” antes de começar.</li>
              <li><b>Histórico de versões</b> — mostra as versões do questionário e quantas respostas cada uma tem.</li>
            </ul>
            <p>Clique em <b>Salvar</b>. Use <b>Prévia</b> para ver exatamente o que o participante verá — na prévia nada é enviado.</p>
          </Section>

          <Section id="versoes-questionario">
            <p>Para proteger os dados históricos:</p>
            <ul>
              <li>Enquanto a versão atual <b>não tem respostas</b>, as edições alteram o próprio questionário.</li>
              <li>Quando a versão atual <b>já tem respostas</b>, salvar cria automaticamente a <b>versão seguinte</b> (v2, v3…). Um aviso amarelo no editor informa isso antes de salvar.</li>
              <li>As respostas antigas continuam ligadas às perguntas exatas que foram respondidas. Novas respostas passam a usar a nova versão.</li>
              <li>Nas telas de análise, o filtro <b>Versão do questionário</b> permite ver cada versão separadamente.</li>
            </ul>
            <Note kind="tip">Ajuste o texto das perguntas antes de publicar. Mudar o enunciado depois de iniciar a coleta divide os resultados em versões diferentes.</Note>
          </Section>

          <Section id="publicar">
            <TutorialVideo id="publicar-compartilhar" />
            <Steps>
              <li>Em <b>Pesquisas</b>, clique em <b>Publicar</b> no cartão do questionário.</li>
              <li>Clique em <b>Link e QR</b>: aparecem o link público exclusivo e o QR Code.</li>
              <li>Use <b>Copiar link</b> para enviar por mensagem, <b>Baixar QR Code</b> para imprimir ou projetar, ou <b>Abrir</b> para testar.</li>
              <li>Para parar a coleta, clique em <b>Encerrar</b>. O link passa a mostrar “pesquisa encerrada”. É possível <b>Reabrir</b> depois.</li>
            </Steps>
            <Note>O link só aceita respostas enquanto a pesquisa estiver <b>Publicada</b>. Se a pesquisa exigir convite, o link geral não aceita respostas — distribua os convites individuais.</Note>
          </Section>

          <Section id="convites">
            <p>Os convites garantem <b>uma resposta por convite</b> sem identificar a pessoa: o sistema não sabe quem recebeu cada código.</p>
            <Steps>
              <li>Em <b>Pesquisas</b>, clique em <b>Convites</b> no cartão do questionário.</li>
              <li>Marque <b>“Exigir convite de uso único”</b>. A partir daí, só responde quem tiver um convite válido.</li>
              <li>Informe a <b>Quantidade</b> (ex.: 20) e, se quiser, um <b>rótulo do lote</b> (ex.: “Residentes — turma 2026”). Evite nomes de pessoas. Clique em <b>Gerar convites</b>.</li>
              <li>Distribua:
                <ul>
                  <li><b>Folha de QR Codes (PDF)</b> — cartões recortáveis (8 por página), só com convites disponíveis. Entregue um cartão a cada participante.</li>
                  <li><b>Lista em CSV</b> — links individuais para enviar por WhatsApp ou e-mail. Também mostra a situação de cada convite.</li>
                  <li>Ícone de <b>copiar</b> na tabela — copia o link de um convite.</li>
                </ul>
              </li>
              <li>Acompanhe os contadores: <b>convites ativos</b>, <b>utilizados</b> e <b>disponíveis</b>. O cartão da pesquisa também mostra “Convites: X/Y usados”.</li>
              <li>Se um convite foi entregue por engano ou perdido, use o ícone de <b>revogar</b> — ele deixa de funcionar — e gere outro.</li>
            </Steps>
            <p>O participante que abrir um link sem convite, com convite inválido, já utilizado ou revogado vê uma mensagem explicando o motivo, e as perguntas não aparecem.</p>
            <Note kind="warning">Ative a exigência de convite <b>antes</b> de divulgar qualquer link. Quem recebeu apenas o link geral passará a precisar de um convite individual.</Note>
          </Section>

          <Section id="participante">
            <TutorialVideo id="participante" />
            <p>O fluxo é sempre o mesmo, em uma tela por vez, com botões grandes no celular:</p>
            <Steps>
              <li><b>Bem-vindo</b> — título, instruções, aviso de anonimato e, se configurado, informações da pesquisa e termo de consentimento.</li>
              <li><b>Perfil profissional</b> — categoria profissional (obrigatória); tempo de experiência, experiência com simuladores e com o iVent (opcionais).</li>
              <li><b>Avaliação</b> — as perguntas quantitativas, com o indicador “Pergunta X de 15” e a barra de progresso. No computador, as teclas 1 a 5 marcam a nota.</li>
              <li><b>Sua opinião</b> — as perguntas abertas, com caixas grandes de texto.</li>
              <li><b>Revisar</b> — lista de todas as respostas. Tocar em um item volta a ele para corrigir. Perguntas obrigatórias sem resposta ficam destacadas.</li>
              <li><b>Enviar</b> e <b>Obrigado por participar</b>.</li>
            </Steps>
            <ul>
              <li><b>Nada se perde por acidente:</b> as respostas ficam guardadas no aparelho enquanto a pessoa responde. Se fechar a página ou a internet cair, ao abrir o link de novo ela continua de onde parou.</li>
              <li><b>Envio seguro:</b> se a pessoa tocar duas vezes em “Enviar” ou a rede falhar, a resposta é gravada uma única vez.</li>
              <li><b>Aviso no aparelho:</b> quem já enviou e abre o link de novo no mesmo aparelho vê “Você já respondeu esta pesquisa neste aparelho”. Em tablets compartilhados, o botão <b>“Outra pessoa vai responder”</b> libera um novo preenchimento.</li>
              <li>Envios feitos rápido demais (sinal de robô) são recusados com a mensagem “Envio muito rápido”.</li>
            </ul>
          </Section>

          <Section id="dashboard">
            <TutorialVideo id="dashboard" />
            <p>O <b>Dashboard de Avaliação iVent NeoPed</b> resume a pesquisa selecionada no topo, respeitando os filtros.</p>
            <ul>
              <li><b>Cartões:</b> Média geral (todas as notas válidas das perguntas Likert, com n), Participantes, Respostas concluídas, Médicos residentes, Fisioterapeutas, Comentários por item e Respostas abertas.</li>
              <li><b>Média de cada pergunta:</b> barras de 1 a 5 com o valor e o n válido ao lado. Passe o mouse (ou toque) para ver média, mediana, desvio-padrão e quantos marcaram “Não utilizei”. Cores: verde-água = favorável, azul = intermediário, âmbar/vermelho = atenção.</li>
              <li><b>Destaques:</b> as três perguntas mais bem avaliadas e as três com menores médias.</li>
              <li><b>Distribuição das notas 1–5:</b> percentual de cada nota por pergunta, sobre as respostas válidas.</li>
              <li><b>Principais oportunidades de melhoria:</b> veja a <a href="#prioridades">seção 16</a>.</li>
              <li><b>Residentes × Fisioterapeutas:</b> médias lado a lado por pergunta (azul = residentes, laranja = fisioterapeutas).</li>
              <li><b>Evolução das avaliações:</b> respostas por dia e média geral acumulada ao longo da coleta.</li>
              <li><b>Versões do iVent:</b> médias por categoria em cada versão, quando houver avaliações de pelo menos duas versões.</li>
            </ul>
          </Section>

          <Section id="estatistica">
            <ul>
              <li><b>n válido</b> — quantas notas entraram no cálculo. Sempre confira o n antes de interpretar uma média.</li>
              <li><b>Média</b> e <b>mediana</b> — a mediana é o valor central e é menos sensível a respostas extremas.</li>
              <li><b>Desvio-padrão</b> — amostral (n−1). Valores altos indicam opiniões divergentes. Não é calculado com menos de 2 respostas.</li>
              <li><b>Não utilizei / Não se aplica</b> — contados à parte; nunca entram em média, mediana ou percentuais.</li>
              <li><b>Ausentes</b> — respostas enviadas que deixaram a pergunta em branco (só em perguntas opcionais).</li>
              <li><b>Frequências relativas</b> — percentuais sobre as respostas válidas da pergunta.</li>
            </ul>
            <Note>As comparações entre grupos são <b>descritivas</b>: uma diferença entre médias, por si só, não indica significância estatística — especialmente com grupos pequenos.</Note>
          </Section>

          <Section id="dados">
            <TutorialVideo id="dados-e-textos" />
            <p><b>Participantes</b> — distribuição dos perfis (profissão, experiência, simuladores, iVent, dispositivo) e a lista de participantes, cada um identificado apenas por um código anônimo (ex.: P-7K3QXA).</p>
            <p><b>Respostas</b> — tabela com uma linha por resposta e uma coluna por pergunta quantitativa (Q1, Q2…). Um asterisco indica que o item tem comentário. Clique em uma linha para ver a resposta completa, incluindo textos e comentários.</p>
          </Section>

          <Section id="comentarios">
            <p>Reúne <b>todas as respostas abertas e os comentários por item</b>, exatamente como foram escritos.</p>
            <ul>
              <li><b>Pesquisar por palavra</b> — a palavra encontrada aparece destacada no texto (a busca ignora acentos).</li>
              <li><b>Origem</b> — abertas e comentários, só perguntas abertas ou só comentários por item.</li>
              <li><b>Ordenação</b> — mais recentes, mais antigos, por profissão, por pergunta ou mais longos.</li>
              <li><b>Filtros</b> — profissão, pergunta, versão, período e versão do iVent.</li>
              <li><b>Exportar CSV</b> — baixa os textos com os filtros atuais.</li>
            </ul>
            <p>Cada texto mostra a profissão, se é pergunta aberta ou comentário de item, o código do participante, a data e a pergunta de origem.</p>
          </Section>

          <Section id="nuvem">
            <p>A <b>Nuvem de Palavras — Feedback dos Participantes</b> usa as respostas abertas e os comentários por item.</p>
            <ul>
              <li><b>Como ler:</b> quanto maior e mais escura (ou mais clara, no tema escuro) a palavra, mais vezes ela foi mencionada.</li>
              <li><b>Ocorrências × Participantes:</b> “Ocorrências” conta todas as vezes que o termo aparece; “Participantes” conta quantas pessoas diferentes o usaram. Use os botões no canto da nuvem para dimensionar por uma ou outra métrica.</li>
              <li><b>Processamento automático:</b> maiúsculas, acentos, pontuação, palavras comuns (“de”, “muito”, “o”…) e plurais (“curvas” = “curva”) são tratados para agrupar. Termos técnicos (PEEP, PIP, FiO₂, VAFO, EIT, NAVA, gasometria…) são sempre preservados, e expressões compostas (“pulmão 3D”, “curvas ventilatórias”, “interface confusa”…) contam como um termo só. O texto original nunca é alterado.</li>
              <li><b>Clique em uma palavra</b> para abrir o painel “CURVAS — mencionada por N participantes”, com ocorrências, número de textos, divisão por profissão e todos os comentários originais com o termo destacado, a pergunta de origem e a profissão.</li>
              <li><b>Filtros:</b> abas Todos / Residentes / Fisioterapeutas, pergunta, período e versão do iVent. A nuvem é recalculada a cada mudança.</li>
              <li><b>Tabela de termos</b> ao lado — a mesma informação em lista (clicável).</li>
              <li><b>Exportar:</b> botões PNG e PDF (o PDF inclui a tabela dos termos mais frequentes).</li>
            </ul>
            <Note kind="tip">Se uma palavra sem importância dominar a nuvem, inclua-a em <b>Configurações → Análise textual → Stopwords adicionais</b>. Você também pode cadastrar novas expressões compostas e termos técnicos.</Note>
          </Section>

          <Section id="ia">
            <p>Módulo <b>opcional</b>. Sem chave configurada, a tela informa “não configurada” e todo o resto funciona normalmente.</p>
            <Steps>
              <li>Ativação (feita uma vez, no servidor): defina a variável <code>ANTHROPIC_API_KEY</code> no Railway. A chave nunca é enviada ao navegador.</li>
              <li>Em <b>Análise por IA</b>, escolha os filtros (versão, profissão, pergunta, período) e clique em <b>Executar nova análise</b>. Pode levar um ou dois minutos.</li>
              <li>O resultado mostra um resumo geral, uma comparação descritiva entre residentes e fisioterapeutas e os temas encontrados (Interface, Navegação, Controles, Curvas, Loops, Realismo fisiológico, Pulmão 3D, EIT, Gasometria, Recursos educacionais, Desempenho, Novas funcionalidades, Outros).</li>
              <li>Cada tema traz o número de comentários relacionados, o resumo, o tipo (elogio, crítica, dificuldade, problema de interface, sugestão) e o botão <b>Ver comentários originais</b>.</li>
              <li>Análises anteriores ficam salvas e podem ser reabertas pela lista “Análises anteriores”.</li>
            </Steps>
            <Note kind="warning">A IA só pode citar comentários existentes: referências inventadas são descartadas e as contagens são recalculadas pelo sistema. Ainda assim, a análise é exploratória — leia sempre os comentários originais antes de concluir.</Note>
          </Section>

          <Section id="prioridades">
            <p>O painel <b>Principais oportunidades de melhoria</b> (no Dashboard) combina, para cada tema:</p>
            <ul>
              <li>a <b>nota média</b> das perguntas relacionadas (ex.: Navegação ↔ pergunta de usabilidade);</li>
              <li>a <b>proporção de participantes</b> que mencionaram o tema nos textos.</li>
            </ul>
            <p>Fórmula: prioridade = 0,6 × déficit da nota + 0,4 × proporção de menções. Alta ≥ 0,45; Média ≥ 0,25; Baixa abaixo disso. Temas sem pergunta relacionada (ex.: Novas funcionalidades) usam só as menções.</p>
            <p>Clique em um item para ver os comentários que o fundamentam. A fonte dos temas é a última análise por IA, se existir; caso contrário, uma classificação por palavras-chave.</p>
            <Note>É uma ferramenta operacional para orientar o desenvolvimento do iVent — não é evidência científica.</Note>
          </Section>

          <Section id="grupos">
            <p>Em <b>Comparação entre Grupos</b>, escolha o Grupo A e o Grupo B (padrão: residentes × fisioterapeutas). A tela mostra, lado a lado:</p>
            <ul>
              <li>média geral, mediana e número de participantes de cada grupo;</li>
              <li>média por pergunta (gráfico e tabela com n, média, mediana, desvio-padrão e diferença A − B);</li>
              <li>distribuição das notas de cada grupo;</li>
              <li>palavras mais frequentes, temas e comentários de cada grupo.</li>
            </ul>
            <Note>Diferenças entre grupos são apresentadas sem presumir que existam e sem afirmar significância estatística.</Note>
          </Section>

          <Section id="versoes-ivent">
            <p>Para verificar se mudanças no iVent melhoraram as avaliações:</p>
            <Steps>
              <li>Em <b>Configurações → Versões do iVent</b>, cadastre a nova versão (ex.: “iVent 2.0”) com data de lançamento e notas sobre o que mudou.</li>
              <li>Em <b>Pesquisas</b>, <b>Duplique</b> o questionário anterior (as perguntas continuam comparáveis) e, no editor, associe a cópia à nova versão do iVent.</li>
              <li>Publique e colete as respostas normalmente.</li>
              <li>Em <b>Comparação entre Versões</b>, veja a média por categoria em cada versão (gráfico) e a tabela por pergunta.</li>
            </Steps>
            <ul>
              <li>Só são comparadas perguntas <b>compatíveis</b>: mesma chave, mesmo tipo e mesma escala. Incompatíveis aparecem marcadas como “Não”.</li>
              <li>Se o enunciado mudou entre versões, a linha recebe o aviso “texto mudou entre versões” — interprete com cuidado.</li>
              <li>O filtro de profissão permite comparar a evolução só entre residentes ou só entre fisioterapeutas.</li>
            </ul>
          </Section>

          <Section id="relatorios">
            <TutorialVideo id="comparacoes-relatorios" />
            <p>Em <b>Relatórios</b>, os arquivos usam exatamente os filtros escolhidos na tela e os mesmos cálculos do Dashboard.</p>
            <ul>
              <li><b>Relatório PDF</b> — identificação da pesquisa, versão avaliada, período, participantes por profissão, metodologia, estatísticas por pergunta, gráficos de média e distribuição, comparação entre grupos, nuvem de palavras, comentários representativos, análise qualitativa, oportunidades de melhoria e limitações.</li>
              <li><b>Planilha Excel</b> — 8 abas: Participantes, Respostas quantitativas, Comentários, Perguntas abertas, Estatísticas, Frequência de palavras, Residentes × Fisioterapeutas e Versões do iVent.</li>
              <li><b>CSV</b> — Respostas (uma linha por resposta a cada pergunta, ideal para software estatístico), Comentários e respostas abertas, ou Estatísticas por pergunta. Abre com acentos corretos no Excel.</li>
            </ul>
            <Note>Textos digitados pelos participantes que comecem com “=”, “+”, “−” ou “@” recebem um apóstrofo nas planilhas, para não serem executados como fórmulas. No banco de dados, o texto original permanece intacto.</Note>
          </Section>

          <Section id="configuracoes">
            <ul>
              <li><b>Versões do iVent</b> — cadastrar e editar versões (nome, data de lançamento, notas). A ordem cronológica segue a data de lançamento.</li>
              <li><b>Categorias profissionais</b> — renomear, ativar/inativar e criar novas categorias (ex.: Enfermagem). Inativar remove a opção do formulário sem apagar respostas já recebidas. O código de uma categoria é permanente.</li>
              <li><b>Análise textual</b> — stopwords, expressões compostas e termos técnicos adicionais para a nuvem (um por linha). Ao salvar, a nuvem é recalculada.</li>
              <li><b>Segurança</b> — troca de senha.</li>
              <li><b>Auditoria</b> — registro de logins, alterações de pesquisas, exportações, convites e análises por IA, com data e administrador.</li>
            </ul>
          </Section>

          <Section id="estudo">
            <p>Sugestão de condução para a avaliação com 10 residentes de Neonatologia e 10 fisioterapeutas:</p>
            <Steps>
              <li><b>Antes:</b> revise o questionário, faça a <b>Prévia</b> no celular e no computador e responda uma vez como teste (depois arquive a pesquisa de teste ou use uma cópia).</li>
              <li>Confirme a <b>versão do iVent</b> associada e, se for um estudo formal, preencha instituição, pesquisador, protocolo e termo de consentimento.</li>
              <li>Ative <b>“Exigir convite de uso único”</b> e gere 20 convites (ou alguns a mais como reserva). Imprima a <b>folha de QR Codes</b> ou envie os links pelo CSV.</li>
              <li>Clique em <b>Publicar</b>.</li>
              <li>Peça que cada participante explore o iVent antes de responder (conforme as instruções do questionário).</li>
              <li><b>Durante:</b> acompanhe os contadores de convites e o Dashboard. Convites não usados mostram quem ainda falta (se você anotou a entrega).</li>
              <li><b>Ao final:</b> clique em <b>Encerrar</b>; baixe o Excel e o PDF; se usar IA, execute a análise; registre um backup do banco (no Railway).</li>
            </Steps>
          </Section>

          <Section id="cientifico">
            <ul>
              <li>A plataforma organiza os dados para uso científico futuro (respostas por versão do questionário e do iVent, metodologia e limitações nos relatórios).</li>
              <li><b>Não</b> declare que o questionário é validado cientificamente nem que há aprovação por Comitê de Ética, a menos que isso tenha ocorrido de fato — os relatórios trazem essa ressalva.</li>
              <li><b>Anonimato e LGPD:</b> não são coletados nome, e-mail ou contato. O endereço IP não é guardado em claro. Os convites não identificam pessoas. Evite rótulos de lote com nomes.</li>
              <li>Os textos originais nunca são alterados; toda normalização (nuvem, planilhas) acontece apenas na análise ou na exportação.</li>
            </ul>
          </Section>

          <Section id="faq">
            <dl className="help-faq">
              <dt>O participante diz que o link mostra “pesquisa encerrada” ou “ainda não está aberta”.</dt>
              <dd>Verifique o estado em <b>Pesquisas</b>: o link só funciona com a pesquisa <b>Publicada</b>.</dd>
              <dt>O participante vê “respondida por convite”.</dt>
              <dd>A pesquisa exige convite. Envie um link individual (Convites → copiar) ou entregue um cartão da folha de QR Codes.</dd>
              <dt>O participante vê “convite já utilizado”.</dt>
              <dd>Cada convite vale uma única resposta. Se a pessoa ainda não respondeu (ex.: alguém usou o convite dela), revogue e gere um novo.</dd>
              <dt>Alguém respondeu e quer responder de novo.</dt>
              <dd>Com convites obrigatórios isso não é possível com o mesmo convite. Sem convites, o aviso no aparelho é apenas um lembrete.</dd>
              <dt>Mudei uma pergunta e as respostas antigas “sumiram” do Dashboard.</dt>
              <dd>Foi criada uma nova versão do questionário. Use o filtro <b>Versão do questionário</b> para ver as respostas da versão anterior.</dd>
              <dt>A nuvem de palavras está vazia.</dt>
              <dd>Ainda não há textos para os filtros escolhidos. Clique em “Limpar filtros” ou aguarde respostas abertas/comentários.</dd>
              <dt>A Análise por IA diz “não configurada”.</dt>
              <dd>A chave de IA ainda não foi definida no servidor (variável <code>ANTHROPIC_API_KEY</code> no Railway). O restante funciona normalmente.</dd>
              <dt>O participante recebeu “Envio muito rápido”.</dt>
              <dd>É a proteção contra robôs. Peça que revise as respostas e envie novamente após alguns segundos.</dd>
              <dt>Esqueci a senha do administrador.</dt>
              <dd>No Railway, defina temporariamente <code>ADMIN_RESET_PASSWORD=true</code> junto com a nova <code>ADMIN_PASSWORD</code>, reinicie o serviço, entre e depois remova <code>ADMIN_RESET_PASSWORD</code>.</dd>
            </dl>
          </Section>
        </article>
      </div>
    </>
  );
}
