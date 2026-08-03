export const TERMINOLOGY_PROFILE_VERSION = "1.0" as const;

export type TerminologyDomain = "ai-software" | "finance-markets" | "laboratory-biopharma";
export type TerminologyKind = "brand" | "company" | "person" | "product" | "technical" | "unit";

export type TerminologyEntry = {
  id: string;
  kind: TerminologyKind;
  domains: Array<TerminologyDomain | "global">;
  canonicalZh: string;
  canonicalEn: string;
  sourceVariants: string[];
  safeAsrCorrection: boolean;
  notes?: string;
};

export type TerminologyProfileConfig = {
  version: typeof TERMINOLOGY_PROFILE_VERSION;
  domains: TerminologyDomain[];
  projectOverrides?: TerminologyEntry[];
};

export type ResolvedTerminologyProfile = {
  schemaVersion: typeof TERMINOLOGY_PROFILE_VERSION;
  precedence: ["global", "domain", "project"];
  domains: TerminologyDomain[];
  entries: TerminologyEntry[];
};

export type CopyRole = "caption" | "display-copy" | "design-label";
