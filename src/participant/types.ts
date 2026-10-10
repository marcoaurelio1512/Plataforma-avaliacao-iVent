import type { AnswerInput, ProfileInput, ProfileOption, QuestionDef } from "../../shared/domain.ts";

export interface PublicSurvey {
  slug: string;
  status: string;
  acceptingResponses: boolean;
  inviteRequired?: boolean;
  inviteStatus?: "missing" | "invalid" | "used" | "revoked";
  title: string;
  instructions?: string;
  openSectionTitle?: string;
  versionId?: string;
  startToken?: string;
  iventVersionLabel?: string | null;
  research?: {
    consentText: string | null;
    participantInfo: string | null;
    institution: string | null;
    leadResearcher: string | null;
    protocolNumber: string | null;
  };
  questions?: QuestionDef[];
  profileOptions?: {
    professions: ProfileOption[];
    experienceYears: ProfileOption[];
    simulatorExperience: ProfileOption[];
    iventExperience: ProfileOption[];
  };
}

export type AnswerMap = Record<string, AnswerInput>;

export interface Draft {
  idempotencyKey: string;
  startedAt: number;
  /** Token assinado pelo servidor na primeira abertura (mantido no rascunho). */
  startToken?: string;
  step: number;
  consent: boolean;
  profile: ProfileInput;
  answers: AnswerMap;
}
