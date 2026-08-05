import { domainCatalog, globalTerminology } from "./catalog.ts";
import {
  TERMINOLOGY_PROFILE_VERSION,
  type CopyRole,
  type ResolvedTerminologyProfile,
  type TerminologyEntry,
  type TerminologyProfileConfig,
} from "./types.ts";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const allowedDomains = new Set(["global", "ai-software", "finance-markets", "laboratory-biopharma"]);

export const validateTerminologyEntry = (entry: TerminologyEntry) => {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(entry.id)) throw new Error(`Invalid terminology id: ${entry.id}`);
  if (!entry.canonicalZh?.trim() || !entry.canonicalEn?.trim())
    throw new Error(`Terminology ${entry.id} requires canonical Chinese and English names.`);
  if (
    !Array.isArray(entry.domains) ||
    entry.domains.length === 0 ||
    entry.domains.some((item) => !allowedDomains.has(item))
  )
    throw new Error(`Terminology ${entry.id} contains an unsupported domain.`);
  if (!Array.isArray(entry.sourceVariants) || entry.sourceVariants.some((item) => !item.trim()))
    throw new Error(`Terminology ${entry.id} has an invalid source variant.`);
  if (typeof entry.safeAsrCorrection !== "boolean")
    throw new Error(`Terminology ${entry.id} must declare safeAsrCorrection.`);
  return entry;
};

export const resolveTerminologyProfile = (config: TerminologyProfileConfig): ResolvedTerminologyProfile => {
  const byId = new Map<string, TerminologyEntry>();
  for (const entry of globalTerminology) byId.set(entry.id, validateTerminologyEntry(entry));
  for (const domain of config.domains)
    for (const entry of domainCatalog[domain]) byId.set(entry.id, validateTerminologyEntry(entry));
  for (const entry of config.projectOverrides ?? []) byId.set(entry.id, validateTerminologyEntry(entry));
  const variants = new Map<string, string>();
  for (const entry of byId.values()) {
    for (const variant of entry.sourceVariants) {
      const key = variant.toLocaleLowerCase();
      const existing = variants.get(key);
      if (existing && existing !== entry.canonicalZh)
        throw new Error(
          `Ambiguous terminology variant "${variant}" resolves to both ${existing} and ${entry.canonicalZh}.`,
        );
      variants.set(key, entry.canonicalZh);
    }
  }
  return {
    schemaVersion: TERMINOLOGY_PROFILE_VERSION,
    precedence: ["global", "domain", "project"],
    domains: [...config.domains],
    entries: [...byId.values()],
  };
};

export const defaultTerminologyProfile = resolveTerminologyProfile({
  version: TERMINOLOGY_PROFILE_VERSION,
  domains: ["ai-software", "finance-markets", "laboratory-biopharma"],
});

const correctionPattern = (variant: string, canonical: string) => {
  const trailingToken = canonical.match(/([A-Za-z][A-Za-z0-9.-]*)$/)?.[1];
  const variantAlreadyIncludesToken =
    trailingToken && new RegExp(`${escapeRegExp(trailingToken)}$`, "i").test(variant.trim());
  const canonicalOverlap =
    trailingToken && !variantAlreadyIncludesToken ? `(?:\\s*${escapeRegExp(trailingToken)}(?![A-Za-z0-9]))?` : "";
  return new RegExp(`${escapeRegExp(variant)}${canonicalOverlap}`, "gi");
};

export const correctionPairs = (profile?: ResolvedTerminologyProfile) =>
  (profile ?? defaultTerminologyProfile).entries
    .filter((entry) => entry.safeAsrCorrection)
    .flatMap((entry) =>
      entry.sourceVariants.map(
        (variant) => [correctionPattern(variant, entry.canonicalZh), entry.canonicalZh] as const,
      ),
    );

export const correctTerminology = (text: string, profile?: ResolvedTerminologyProfile) =>
  correctionPairs(profile).reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);

export const canonicalizeEnglish = (text: string, profile?: ResolvedTerminologyProfile) =>
  (profile ?? defaultTerminologyProfile).entries.reduce((value, entry) => {
    const candidates = [entry.canonicalZh, entry.canonicalEn, ...entry.sourceVariants];
    return candidates.reduce(
      (current, candidate) => current.replace(new RegExp(escapeRegExp(candidate), "gi"), entry.canonicalEn),
      value,
    );
  }, text);

export const normalizeNumbersAndUnits = (text: string, role: CopyRole) => {
  if (role === "caption") return text;
  return text
    .replace(/百分之\s*(\d+(?:\.\d+)?)/g, "$1%")
    .replace(/(\d+(?:\.\d+)?)\s*个百分点/g, "$1 个百分点")
    .replace(/(\d+(?:\.\d+)?)\s*个?基点/g, "$1 bp")
    .replace(/人民币\s*([\d,.]+)\s*元/g, "¥$1")
    .replace(/([\d,.]+)\s*万元/g, "$1 万元");
};

const productionTerms = [
  "mvp",
  "illustrative",
  "review frame",
  "review output",
  "component id",
  "layout template",
  "使用组件",
  "选择组件",
  "视觉组件",
  "语义组件",
  "动效组件",
  "组件审核画面",
  "审核帧",
  "测试画面",
  "设计语言",
  "动效演示",
];

export const validateViewerCopy = (text: string, role: CopyRole, _context?: { sourceText?: string }) => {
  if (!text.trim()) throw new Error(`${role} must not be empty.`);
  const normalized = text.toLowerCase();
  const forbidden = productionTerms.find((term) => normalized.includes(term));
  if (forbidden) throw new Error(`${role} contains production terminology: ${forbidden}`);
  if (role === "design-label" && text.length > 28) throw new Error("design-label must be at most 28 characters.");
  if (role === "display-copy" && text.length > 72) throw new Error("display-copy must be at most 72 characters.");
  return true;
};

export const compressViewerTitle = (text: string, maximumCharacters = 18) => {
  const cleaned = text
    .replace(/^(?:(?:所以|那么|其实|我觉得|我们来看|接下来|我们)[，,：:\s]*)+/g, "")
    .replace(/如何/g, "")
    .replace(/[。！!？?]+$/g, "")
    .trim();
  if (cleaned.length <= maximumCharacters) return cleaned;
  const clause =
    cleaned
      .split(/[，,；;：:]/)
      .find((item) => item.trim().length >= 4)
      ?.trim() ?? cleaned;
  return clause.length <= maximumCharacters ? clause : `${clause.slice(0, maximumCharacters - 1)}…`;
};

export const glossaryForPrompt = (profile: ResolvedTerminologyProfile) =>
  profile.entries.map(({ canonicalZh, canonicalEn }) => `${canonicalZh} = ${canonicalEn}`).join("; ");
