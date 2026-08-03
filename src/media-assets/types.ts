export type MediaAssetStatus = "planned" | "candidate" | "approved" | "blocked";

export type MediaEntityKind =
  | "person"
  | "brand"
  | "biotech"
  | "government"
  | "country"
  | "ticker"
  | "exchange"
  | "research"
  | "university"
  | "media"
  | "ai"
  | "design";

export type MediaVariant = "original" | "square" | "circle" | "card" | "monochrome" | "light" | "dark";

export type MediaLicense =
  | "public-domain"
  | "cc0-1.0"
  | "cc-by-2.0"
  | "cc-by-3.0"
  | "cc-by-4.0"
  | "cc-by-sa-2.0"
  | "cc-by-sa-3.0"
  | "cc-by-sa-4.0"
  | "apache-2.0"
  | "mit"
  | "official-brand-nominative"
  | "user-provided-private"
  | "unknown";

export type MediaSource = {
  pageUrl: string;
  fileUrl?: string;
  provider: string;
  author?: string;
  license: MediaLicense;
  licenseUrl?: string | null;
  attribution?: string;
  accessedAt: string;
};

export type MediaVariantFile = {
  path: string;
  sha256: string;
  width: number;
  height: number;
  mime: string;
};

export type MediaAssetDefinition = {
  id: string;
  kind: MediaEntityKind;
  label: string;
  aliases: string[];
  status: MediaAssetStatus;
  source?: MediaSource;
  focalPoint: { x: number; y: number; method: "face-detection" | "manual" | "center" };
  variants: Partial<Record<MediaVariant, MediaVariantFile>>;
  fallback: { type: "monogram" | "system-icon" | "text-badge"; value: string };
  usage: {
    attributionRequired: boolean;
    redistribution: "allowed" | "restricted" | "unknown";
    note: string;
  };
  statusReason?: string;
  identity?: { wikidataId: string | null; description: string };
  catalog?: { roles: string[]; categories: string[]; priorities: Array<"P0" | "P1"> };
  approval?: { decision: string; approvedAt: string };
};

export type PersonCatalogEntry = {
  id: string;
  name: string;
  aliases: string[];
  roles: string[];
  categories: string[];
  priorities: Array<"P0" | "P1">;
};

export type MediaIntent = {
  kind: MediaEntityKind;
  entityId: string;
  preferredVariant?: MediaVariant;
};

export type ResolvedMediaAsset = {
  entityId: string;
  kind: MediaEntityKind;
  path?: string;
  variant?: MediaVariant;
  label: string;
  fallback: MediaAssetDefinition["fallback"];
  source?: MediaSource;
  status: MediaAssetStatus;
};
