import type { PersonCatalogEntry } from "./types.ts";

export const personCatalog: readonly PersonCatalogEntry[] = [];
export type PersonId = string;
export const personCatalogById = new Map<string, PersonCatalogEntry>();
