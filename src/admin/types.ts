import type { QuestionDef, SurveyStatus } from "../../shared/domain.ts";
import type { CategoricalRow, GroupComparison, ScaleSummary } from "../../shared/stats.ts";

export interface SurveySummary {
  id: string;
  slug: string;
  title: string;
  status: SurveyStatus;
  iventVersionId: string | null;
  iventVersionLabel: string | null;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  publicUrl: string;
}

export interface SurveyDetail extends SurveySummary {
  instructions: string;
  openSectionTitle: string;
  consentText: string | null;
  participantInfo: string | null;
  protocolNumber: string | null;
  institution: string | null;
  leadResearcher: string | null;
  questions: QuestionDef[];
  versions: { id: string; versionNumber: number; title: string; createdAt: string; responseCount: number }[];
}

export interface QuestionStats {
  questionId: string;
  key: string;
  position: number;
  text: string;
  category: string | null;
  type: QuestionDef["type"];
  section: QuestionDef["section"];
  scaleMin: number | null;
  scaleMax: number | null;
  scale: ScaleSummary | null;
  categorical: { respondents: number; rows: CategoricalRow[] } | null;
  textAnswers: number;
  comments: number;
}

export interface GroupQuestion {
  questionId: string;
  key: string;
  text: string;
  category: string | null;
  scaleMin: number;
  scaleMax: number;
  comparison: GroupComparison;
  distributionA: { value: number; count: number; relative: number }[];
  distributionB: { value: number; count: number; relative: number }[];
  notUsedA: number;
  notUsedB: number;
}

export interface GroupResult {
  groupA: { code: string; label: string; n: number };
  groupB: { code: string; label: string; n: number };
  overall: GroupComparison;
  questions: GroupQuestion[];
}

export interface PriorityItem {
  theme: string;
  mean: number | null;
  meanN: number;
  relatedQuestions: { key: string; text: string }[];
  comments: number;
  participants: number;
  score: number;
  level: "Alta" | "Média" | "Baixa";
  docIds: string[];
}

export interface Dashboard {
  survey: { id: string; title: string; slug: string; status: string; iventVersionLabel: string | null };
  version: { id: string; number: number; title: string };
  versions: { id: string; number: number; responseCount: number }[];
  overview: {
    totalParticipants: number;
    completedResponses: number;
    byProfession: { code: string; label: string; count: number }[];
    generalMean: { mean: number | null; n: number };
    commentCount: number;
    openAnswerCount: number;
    firstSubmission: string | null;
    lastSubmission: string | null;
  };
  stats: QuestionStats[];
  top: string[];
  bottom: string[];
  timeline: { date: string; responses: number; cumulativeResponses: number; dayMean: number | null; cumulativeMean: number | null }[];
  groups: GroupResult;
  priorities: { source: "ai" | "keywords"; formula: string; items: PriorityItem[] };
}

export interface TextDoc {
  id: string;
  text: string;
  kind: "open" | "comment";
  answerId: string;
  responseId: string;
  questionId: string;
  questionKey: string;
  questionText: string;
  questionCategory: string | null;
  profession: string;
  professionLabel: string;
  participantCode: string;
  submittedAt: string;
  iventVersionLabel: string | null;
  ranges?: [number, number][];
}

export interface Profession {
  code: string;
  label: string;
  position: number;
  active: boolean;
  participants: number;
}

export interface IventVersion {
  id: string;
  label: string;
  releasedAt: string | null;
  notes: string;
  surveys: number;
  responses: number;
}
