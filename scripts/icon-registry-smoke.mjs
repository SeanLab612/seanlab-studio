import { brandIconRegistry, systemIconRegistry } from "../src/icons/registry.ts";

const errors = [];
const brands = Object.values(brandIconRegistry);
const systems = Object.values(systemIconRegistry);

for (const icon of brands) {
  if (!icon.source.startsWith("https://")) errors.push(`${icon.id}: source must use https`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(icon.accessedAt)) errors.push(`${icon.id}: invalid accessedAt`);
  if (!icon.shortLabel.trim()) errors.push(`${icon.id}: fallback label is missing`);
}

for (const icon of systems) {
  if (!icon.id.startsWith("system.")) errors.push(`${icon.id}: invalid system namespace`);
  if (!icon.label.trim()) errors.push(`${icon.id}: missing semantic label`);
}

if (brands.length !== 16) errors.push(`expected 16 brand icons, received ${brands.length}`);
if (systems.length !== 35) errors.push(`expected 35 system icons, received ${systems.length}`);
if (errors.length) throw new Error(errors.join("\n"));
console.log(`icon registry -> ${brands.length} brand text fallbacks verified`);
console.log(`icon registry -> ${systems.length} system semantics verified`);
