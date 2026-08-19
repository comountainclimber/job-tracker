export const STAGES = [
  "wishlist",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type Stage = (typeof STAGES)[number];

export const SOURCES = [
  "linkedin",
  "company_site",
  "referral",
  "recruiter",
  "other",
] as const;
export type Source = (typeof SOURCES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const SOURCE_LABELS: Record<Source, string> = {
  linkedin: "LinkedIn",
  company_site: "Company site",
  referral: "Referral",
  recruiter: "Recruiter",
  other: "Other",
};

export const PIPELINE_STAGES: Stage[] = [
  "wishlist",
  "applied",
  "screening",
  "interview",
  "offer",
];

export const HIDDEN_BY_DEFAULT_STAGES: Stage[] = ["rejected", "withdrawn"];

export type Application = {
  id: string;
  company: string;
  role: string;
  stage: Stage;
  jobUrl: string | null;
  source: Source | null;
  location: string | null;
  resumeLabel: string | null;
  appliedAt: number | null;
  applyBy: number | null;
  nextAction: string | null;
  nextActionAt: number | null;
  notes: string | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ListApplicationsQuery = {
  q?: string;
  stage?: Stage;
  archived?: boolean;
  needsAttention?: boolean;
};

export type UpsertInput = {
  company: string;
  role: string;
  stage?: Stage;
  jobUrl?: string | null;
  source?: Source | null;
  location?: string | null;
  resumeLabel?: string | null;
  appliedAt?: number | null;
  applyBy?: number | null;
  nextAction?: string | null;
  nextActionAt?: number | null;
  notes?: string | null;
  archived?: boolean;
};

export type UpdateInput = Partial<UpsertInput>;

export type UpsertResult = {
  application: Application;
  created: boolean;
  duplicates: Application[];
};
