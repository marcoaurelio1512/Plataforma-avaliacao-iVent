/**
 * Roteiros dos vídeos do "Como usar": cada passo tem a fala (narração e
 * legenda) e a ação mostrada na tela enquanto ela é dita.
 * A ordem importa: "publicar-compartilhar" usa o rascunho criado em "criar-questionario".
 */
import type { Page } from "@playwright/test";
import type { Director } from "./diretor.ts";

export type SceneContext = { mainSlug: string; adminEmail: string; adminPassword: string };

export type Scene = {
  id: string;
  title: string;
  /** Seção do HelpPage onde o vídeo aparece. */
  section: string;
  /** Caminho inicial; `{mainSlug}` é trocado pelo slug da pesquisa principal. */
  startPath: string;
  /** Começa já logado (sessão reaproveitada). */
  authenticated: boolean;
  run: (d: Director, ctx: SceneContext) => Promise<void>;
};

const DEMO_SURVEY = "Satisfação com o treinamento no iVent";

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("link", { name, exact: true });

export const SCENES: Scene[] = [
  {
    id: "primeiro-acesso",
    title: "Primeiro acesso e navegação",
    section: "acesso",
    startPath: "/admin/login",
    authenticated: false,
    async run(d, ctx) {
      const p = d.page;
      await d.step("Olá! Neste vídeo você vai conhecer o painel administrativo da plataforma de avaliação do iVent NeoPed.");
      await d.step("Para entrar, digite o e-mail e a senha do administrador.", async () => {
        await d.type(p.getByLabel("E-mail"), ctx.adminEmail);
        await d.type(p.getByLabel("Senha"), ctx.adminPassword, 25);
      });
      await d.step("E clique em Entrar.", () => d.click(p.getByRole("button", { name: "Entrar" })));
      await d.step("Você chega ao Dashboard, com o resumo da pesquisa que está em análise.");
      await d.step("O menu lateral reúne todas as telas, em quatro grupos: visão geral, dados coletados, análise e sistema.", async () => {
        for (const item of ["Pesquisas", "Participantes", "Nuvem de Palavras", "Configurações"]) await d.pointAt(nav(p, item));
      });
      await d.step("No topo, a caixa de seleção define qual pesquisa todas as telas de análise mostram, junto com o estado dela.", () =>
        d.pointAt(p.getByLabel("Pesquisa em análise")));
      await d.step("O botão de sol e lua alterna entre o tema claro e o escuro.", async () => {
        await d.click(p.getByRole("button", { name: /Usar tema/ }));
        await d.pause(1200);
        await d.click(p.getByRole("button", { name: /Usar tema/ }));
      });
      await d.step("Nas telas de análise, a barra de filtros recorta os dados por profissão, versão do iVent e período.", () =>
        d.select(p.getByLabel("Profissão"), "Fisioterapeuta"));
      await d.step("Os filtros ficam no endereço da página. Basta copiar o link para compartilhar exatamente a mesma visão.", () =>
        d.select(p.getByLabel("Profissão"), "Todos"));
      await d.step("Primeiro passo importante: em Configurações, na aba Segurança, troque a senha inicial.", async () => {
        await d.click(nav(p, "Configurações"));
        await d.click(p.getByRole("tab", { name: "Segurança" }));
      });
      await d.step("E sempre que tiver dúvidas, o guia Como usar fica no final do menu. Para sair, use o ícone de saída no rodapé.", async () => {
        await d.pointAt(nav(p, "Como usar"));
        await d.pointAt(p.getByRole("button", { name: "Sair" }));
      });
    },
  },
  {
    id: "criar-questionario",
    title: "Criar e editar um questionário",
    section: "editor",
    startPath: "/admin/pesquisas",
    authenticated: true,
    async run(d) {
      const p = d.page;
      await d.step("Vamos criar um questionário novo. Em Pesquisas, clique em Criar questionário.", () =>
        d.click(p.getByRole("main").getByRole("link", { name: "Criar questionário" })));
      await d.step("Comece pela apresentação: o título e as instruções que o participante lê antes de responder.", async () => {
        await d.type(p.getByLabel("Título", { exact: true }), DEMO_SURVEY);
        await d.type(p.getByLabel("Instruções ao participante"), "Responda pensando no treinamento de hoje.", 25);
      });
      await d.step("Cada pergunta é um cartão. Escreva o texto e escolha o tipo: escala Likert de 1 a 5, sim ou não, múltipla escolha, textos e outros.", async () => {
        await d.type(p.getByLabel("Texto da pergunta").first(), "O treinamento foi claro e bem organizado?", 25);
        await d.pointAt(p.getByLabel("Tipo").first());
      });
      await d.step("Aqui você define se a pergunta é obrigatória, se terá campo de comentário e as opções Não utilizei e Não se aplica.", () =>
        d.pointAt(p.getByRole("checkbox", { name: "Obrigatória" }).first()));
      await d.step("Para incluir mais perguntas, use os botões de Adicionar pergunta. Vamos adicionar uma pergunta aberta, de texto longo.", async () => {
        await d.click(p.getByRole("button", { name: "Texto longo", exact: true }));
        await d.type(p.getByLabel("Texto da pergunta").last(), "O que poderia melhorar no treinamento?", 25);
      });
      await d.step("Para reordenar, arraste pela alça ou use as setas de mover para cima e para baixo.", () =>
        d.click(p.getByRole("button", { name: "Mover para cima" }).last()));
      await d.step("Na lateral, associe a versão do iVent que está sendo avaliada. Os campos de pesquisa científica são opcionais.", () =>
        d.select(p.getByLabel("Versão do iVent"), "iVent 1.0"));
      await d.step("Clique em Salvar como rascunho. O questionário só recebe respostas depois de publicado.", async () => {
        await d.click(p.getByRole("button", { name: "Salvar como rascunho" }));
        await p.getByRole("link", { name: "Prévia" }).waitFor();
      });
      await d.step("Antes de publicar, abra a Prévia: ela mostra exatamente o que o participante verá, sem gravar nenhuma resposta.", async () => {
        await d.click(p.getByRole("link", { name: "Prévia" }));
        await d.click(p.getByRole("button", { name: /Começar/ }));
      });
      await d.step("Na prévia você pode avançar livremente entre as telas, mesmo sem preencher, para revisar tudo.", async () => {
        await d.click(p.getByRole("button", { name: /Próxima/ }));
        await d.click(p.getByRole("button", { name: /Próxima|Revisar/ }));
      });
      await d.step("Para ajustar algo, volte ao editor. Se a pesquisa já tiver respostas, salvar cria uma nova versão, e o histórico é preservado.", () =>
        d.click(p.getByRole("link", { name: "Voltar ao editor" })));
    },
  },
  {
    id: "publicar-compartilhar",
    title: "Publicar, link, QR Code e convites",
    section: "publicar",
    startPath: "/admin/pesquisas",
    authenticated: true,
    async run(d) {
      const p = d.page;
      const card = p.locator(".survey-card").filter({ hasText: DEMO_SURVEY });
      await d.step("Em Pesquisas, cada questionário aparece como um cartão, com o estado, a versão e o número de respostas.", () => d.pointAt(card));
      await d.step("Nosso questionário novo ainda é um rascunho. Para abrir a coleta, clique em Publicar.", async () => {
        await d.click(card.getByRole("button", { name: "Publicar" }));
        await card.locator(".badge", { hasText: "Publicada" }).waitFor();
      });
      await d.step("Agora ele está publicado. Clique em Link e QR para ver o endereço público da pesquisa.", () =>
        d.click(card.getByRole("button", { name: "Link e QR" })));
      await d.step("Você pode copiar o link, baixar o QR Code para imprimir ou projetar, e abrir a pesquisa para testar.", async () => {
        const dialog = p.getByRole("dialog");
        await d.pointAt(dialog.getByRole("button", { name: /Copiar link/ }));
        await d.pointAt(dialog.getByRole("link", { name: /Baixar QR Code/ }));
      });
      await d.step("Para garantir uma resposta por pessoa, use os convites de uso único.", async () => {
        await p.keyboard.press("Escape");
        await d.click(card.getByRole("button", { name: "Convites" }));
      });
      await d.step("Ative Exigir convite. A partir daí, o link geral deixa de aceitar respostas, e só responde quem tem um convite válido.", () =>
        d.click(p.getByRole("checkbox", { name: /Exigir convite/ })));
      await d.step("Informe a quantidade e um rótulo para o lote, sem nomes de pessoas, e clique em Gerar convites.", async () => {
        await d.type(p.getByLabel("Quantidade"), "8");
        await d.type(p.getByLabel(/Rótulo do lote/), "Residentes — turma 2026", 25);
        await d.click(p.getByRole("button", { name: "Gerar convites" }));
      });
      await d.step("Cada convite tem um código próprio. Copie o link individual para enviar por mensagem, ou revogue um convite se necessário.", () =>
        d.pointAt(p.getByRole("button", { name: /Copiar link do convite/ }).first()));
      await d.step("Também é possível baixar uma folha de QR Codes em PDF, com cartões recortáveis, ou a lista completa em CSV. A resposta continua anônima.", async () => {
        await d.pointAt(p.getByRole("button", { name: /Folha de QR Codes/ }));
        await d.pointAt(p.getByRole("button", { name: /Lista em CSV/ }));
      });
    },
  },
  {
    id: "participante",
    title: "O que o participante vê",
    section: "participante",
    startPath: "/r/{mainSlug}",
    authenticated: false,
    async run(d) {
      const p = d.page;
      await d.step("Este é o link público, como o participante vê no celular ou no computador. A participação é anônima.");
      await d.step("Ele lê as instruções e clica em Começar.", () => d.click(p.getByRole("button", { name: /Começar/ })));
      await d.step("Primeiro, informa o perfil: a categoria profissional, que é obrigatória, e o tempo de experiência.", async () => {
        await d.click(p.getByRole("radio", { name: "Fisioterapeuta" }));
        await d.click(p.getByRole("radio", { name: "1–3 anos" }));
        await d.click(p.getByRole("button", { name: /Próxima/ }));
      });
      await d.step("Depois, cada afirmação aparece em uma tela, com a escala de 1, discordo totalmente, a 5, concordo totalmente.", () =>
        d.click(p.getByRole("radio", { name: /Concordo totalmente/ })));
      await d.step("Há um campo opcional para comentários sobre o item, e a barra de progresso mostra quanto falta.", async () => {
        await d.type(p.getByLabel(/Comentários ou sugestões sobre este item/), "Interface muito clara.", 30);
        await d.click(p.getByRole("button", { name: /Próxima/ }));
      });
      await d.step("Ele segue até o fim. Quando não usou um recurso, pode marcar Não utilizei este recurso, que fica fora das médias.", async () => {
        for (let i = 2; i <= 10; i++) {
          if (i === 7) await d.click(p.getByRole("button", { name: "Não utilizei este recurso" }));
          else await d.click(p.getByRole("radio", { name: i % 2 ? /Concordo totalmente/ : /Concordo parcialmente/ }));
          await d.click(p.getByRole("button", { name: /Próxima/ }));
        }
      });
      await d.step("Na seção aberta, escreve livremente o que gostou, as dificuldades e as sugestões.", async () => {
        await d.type(p.getByLabel("Sua resposta"), "Gostei muito das curvas e da gasometria simulada.", 22);
        for (let i = 0; i < 4; i++) await d.click(p.getByRole("button", { name: /Próxima/ }));
        await d.click(p.getByRole("button", { name: /Revisar/ }));
      });
      await d.step("Antes de enviar, ele confere todas as respostas. Se fechar a página, o rascunho fica salvo no aparelho.", () => d.scrollBy(500));
      await d.step("Ao clicar em Enviar respostas, a resposta é gravada, e ele vê a mensagem de agradecimento.", async () => {
        await d.click(p.getByRole("button", { name: /Enviar respostas/ }));
        await p.getByRole("heading", { name: "Obrigado por participar!" }).waitFor();
      });
    },
  },
  {
    id: "dashboard",
    title: "Dashboard e estatísticas",
    section: "dashboard",
    startPath: "/admin",
    authenticated: true,
    async run(d) {
      const p = d.page;
      await d.step("O Dashboard é o resumo da pesquisa em análise, atualizado a cada nova resposta.");
      await d.step("No topo ficam os indicadores: média geral, participantes, respostas concluídas e o total por profissão.", () =>
        d.pointAt(p.getByRole("region", { name: "Indicadores" })));
      await d.step("O gráfico mostra a média de cada pergunta, de 1 a 5, e o n de respostas válidas. Não utilizei e Não se aplica ficam fora do cálculo.", () =>
        d.scrollTo(p.getByRole("region", { name: "Média de cada pergunta" })));
      await d.step("Em Destaques, as perguntas mais bem avaliadas e as de menor avaliação.", () =>
        d.scrollTo(p.getByRole("region", { name: "Destaques" })));
      await d.step("A distribuição mostra quantas pessoas deram cada nota, de 1 a 5, em cada pergunta.", () =>
        d.scrollTo(p.getByRole("region", { name: /Distribuição das notas/ })));
      await d.step("As principais oportunidades de melhoria cruzam notas baixas com o que foi escrito nos comentários.", () =>
        d.scrollTo(p.getByRole("region", { name: "Principais oportunidades de melhoria" })));
      await d.step("Logo abaixo, a comparação entre residentes e fisioterapeutas e a evolução das avaliações ao longo do tempo.", () =>
        d.scrollTo(p.getByRole("region", { name: /×/ })));
      await d.step("Os filtros recalculam tudo. Por exemplo, escolhendo Fisioterapeuta, o painel passa a mostrar só esse grupo.", async () => {
        await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await d.pause(800);
        await d.select(p.getByLabel("Profissão"), "Fisioterapeuta");
      });
      await d.step("Lembre: o Dashboard é uma ferramenta operacional. Para conclusões científicas, use os relatórios e uma análise estatística adequada.", () =>
        d.select(p.getByLabel("Profissão"), "Todos"));
    },
  },
  {
    id: "dados-e-textos",
    title: "Respostas, comentários e nuvem de palavras",
    section: "dados",
    startPath: "/admin/respostas",
    authenticated: true,
    async run(d) {
      const p = d.page;
      await d.step("Em Respostas, cada linha é um envio, com a profissão, a data e a nota de cada pergunta.");
      await d.step("Clique em uma linha para ver a resposta completa, incluindo os textos e comentários.", async () => {
        await d.click(p.locator("tbody tr").first());
        await d.pause(1500);
      });
      await d.step("Em Comentários e Sugestões ficam todos os textos livres, exatamente como foram escritos.", async () => {
        await p.keyboard.press("Escape");
        await d.click(nav(p, "Comentários e Sugestões"));
      });
      await d.step("Pesquise por uma palavra, como curvas. Os termos encontrados aparecem destacados.", () =>
        d.type(p.getByLabel("Pesquisar por palavra"), "curvas", 80));
      await d.step("Você também pode filtrar por origem, por pergunta e por profissão, mudar a ordenação e exportar em CSV.", () =>
        d.pointAt(p.getByRole("button", { name: "Exportar CSV" })));
      await d.step("A Nuvem de Palavras mostra os termos mais citados. Quanto maior a palavra, mais vezes ela apareceu.", () =>
        d.click(nav(p, "Nuvem de Palavras")));
      await d.step("Clique em uma palavra para ver os comentários originais, com quantas vezes foi citada e por quantos participantes.", async () => {
        await d.click(p.getByRole("button", { name: "curvas: ver comentários" }));
        await d.pause(1500);
      });
      await d.step("As abas separam residentes e fisioterapeutas, e a nuvem pode ser baixada em PNG ou PDF.", async () => {
        await p.keyboard.press("Escape");
        await d.click(p.getByRole("tab", { name: "Fisioterapeutas" }));
        await d.pointAt(p.getByRole("button", { name: "PNG" }));
      });
    },
  },
  {
    id: "comparacoes-relatorios",
    title: "Comparações, relatórios e configurações",
    section: "relatorios",
    startPath: "/admin/grupos",
    authenticated: true,
    async run(d) {
      const p = d.page;
      await d.step("Em Comparação entre Grupos, as médias de residentes e fisioterapeutas aparecem lado a lado, pergunta por pergunta.");
      await d.step("A diferença é descritiva: ela não indica significância estatística.", () => d.scrollBy(450));
      await d.step("Em Comparação entre Versões, você acompanha como as notas mudam de uma versão do iVent para outra.", () =>
        d.click(nav(p, "Comparação entre Versões")));
      await d.step("A Análise por IA agrupa os comentários em temas. Ela só funciona quando a chave de IA está configurada no servidor.", () =>
        d.click(nav(p, "Análise por IA")));
      await d.step("Em Relatórios, baixe o relatório completo em PDF, a planilha Excel ou os dados em CSV, respeitando os filtros escolhidos.", async () => {
        await d.click(nav(p, "Relatórios"));
        await d.pointAt(p.getByRole("button", { name: "Baixar PDF" }));
        await d.pointAt(p.getByRole("button", { name: "Baixar Excel" }));
      });
      await d.step("O CSV em formato longo é o ideal para análise estatística em programas como R, SPSS ou Python.", () =>
        d.pointAt(p.getByRole("button", { name: "Respostas (formato longo)" })));
      await d.step("Por fim, em Configurações você cadastra as versões do iVent, as categorias profissionais e as palavras ignoradas na análise textual.", async () => {
        await d.click(nav(p, "Configurações"));
        await d.click(p.getByRole("tab", { name: "Categorias profissionais" }));
        await d.click(p.getByRole("tab", { name: "Análise textual" }));
      });
      await d.step("Na aba Auditoria fica o registro das ações administrativas. Pronto! Agora você já conhece toda a plataforma.", () =>
        d.click(p.getByRole("tab", { name: "Auditoria" })));
    },
  },
];
