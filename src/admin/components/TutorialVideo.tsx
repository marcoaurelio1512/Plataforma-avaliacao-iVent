/**
 * Vídeos narrados do guia "Como usar" (pt-BR, legendas gravadas na imagem).
 * Arquivos em public/tutoriais, gerados por `npm run tutoriais`.
 */
import { PlayCircle } from "lucide-react";

export const TUTORIALS = [
  { id: "primeiro-acesso", section: "acesso", title: "Primeiro acesso e navegação" },
  { id: "criar-questionario", section: "editor", title: "Criar e editar um questionário" },
  { id: "publicar-compartilhar", section: "publicar", title: "Publicar, link, QR Code e convites" },
  { id: "participante", section: "participante", title: "O que o participante vê" },
  { id: "dashboard", section: "dashboard", title: "Dashboard e estatísticas" },
  { id: "dados-e-textos", section: "dados", title: "Respostas, comentários e nuvem de palavras" },
  { id: "comparacoes-relatorios", section: "relatorios", title: "Comparações, relatórios e configurações" },
] as const;

export type TutorialId = (typeof TUTORIALS)[number]["id"];

export function TutorialVideo({ id }: { id: TutorialId }) {
  const tutorial = TUTORIALS.find((t) => t.id === id)!;
  return (
    <figure className="tutorial-video">
      <video controls preload="none" playsInline poster={`/tutoriais/${id}.jpg`} width={1280} height={800} aria-label={`Vídeo: ${tutorial.title}`}>
        <source src={`/tutoriais/${id}.mp4`} type="video/mp4" />
        Seu navegador não reproduz vídeos. <a href={`/tutoriais/${id}.mp4`}>Baixe o vídeo</a>.
      </video>
      <figcaption>
        <PlayCircle aria-hidden="true" />
        <span><b>{tutorial.title}</b> · vídeo com narração e legendas em português</span>
      </figcaption>
    </figure>
  );
}

/** Índice dos vídeos, com link para a seção de cada um. */
export function TutorialIndex() {
  return (
    <ol className="tutorial-index">
      {TUTORIALS.map((t) => (
        <li key={t.id}>
          <a href={`#${t.section}`}><PlayCircle aria-hidden="true" /> {t.title}</a>
        </li>
      ))}
    </ol>
  );
}
