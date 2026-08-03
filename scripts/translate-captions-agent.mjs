import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStructuredAgentJsonAdapter } from "./workflow/agent-json-adapter.mjs";

const cjk = /[\u3400-\u9fff]/;
const lexicalEnglish = /[A-Za-z0-9]/;
const sentencePunctuation = new Set("，。！？；：、,.!?;:");
const technicalCharacter = /[A-Za-z0-9]/;

export const stripDisplayPunctuation = (text) =>
  [...text]
    .filter((character, index, characters) => {
      if (!sentencePunctuation.has(character)) return true;
      const previous = characters[index - 1] ?? "";
      const following = characters[index + 1] ?? "";
      if (character === "." && technicalCharacter.test(previous) && technicalCharacter.test(following)) return true;
      return [",", ":"].includes(character) && /\d/.test(previous) && /\d/.test(following);
    })
    .join("")
    .trim();

const terminologyPairs = (profile) =>
  (profile?.entries ?? []).map((entry) => `${entry.canonicalZh} = ${entry.canonicalEn}`).join("; ");

export const canonicalizeAgentTranslation = (text, profile) => {
  let result = text;
  for (const entry of profile?.entries ?? []) {
    const candidates = [entry.canonicalZh, entry.canonicalEn, ...(entry.sourceVariants ?? [])]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    for (const candidate of new Set(candidates)) result = result.replaceAll(candidate, entry.canonicalEn);
  }
  return result;
};

export const validateAgentTranslation = ({ response, source }) => {
  if (response?.schemaVersion !== "1.0" || !Array.isArray(response.items))
    throw new Error("Agent translation returned an invalid response");
  if (response.items.length !== source.length) throw new Error("Agent translation changed the caption count");
  return response.items.map((item, index) => {
    if (item.index !== index) throw new Error(`Agent translation changed caption order at ${index}`);
    if (typeof item.en !== "string" || !item.en.trim())
      throw new Error(`Agent translation left caption ${index} empty`);
    if (cjk.test(item.en)) throw new Error(`Agent translation left Chinese characters in caption ${index}`);
    if (!lexicalEnglish.test(item.en)) throw new Error(`Agent translation has no English content at caption ${index}`);
    return item.en.trim();
  });
};

export const translateCaptionBatch = async ({ captions, terminologyProfile, adapter }) => {
  const sourceSnapshot = JSON.stringify(captions);
  const response = await adapter.completeJson({
    system: [
      "Translate actual Chinese talking-head captions into concise faithful English.",
      "Never rewrite, summarize, merge, split, omit, or add meaning.",
      "Each input item is independent. Preserve technical names using the glossary.",
      "Return one item for every input index. English must contain no Chinese characters.",
    ].join(" "),
    user: JSON.stringify({
      glossary: terminologyPairs(terminologyProfile),
      items: captions.map((cue, index) => ({ index, zh: cue.zh })),
    }),
  });
  if (JSON.stringify(captions) !== sourceSnapshot)
    throw new Error("Agent translation modified Chinese source captions");
  return validateAgentTranslation({ response, source: captions });
};

const main = async (configPath) => {
  const config = JSON.parse(await readFile(resolve(configPath), "utf8"));
  const captions = JSON.parse(await readFile(resolve(config.semanticCaptionSourceFile), "utf8"));
  const terminologyProfile = config.terminologyProfileFile
    ? JSON.parse(await readFile(resolve(config.terminologyProfileFile), "utf8"))
    : undefined;
  const provider = config.translation?.provider;
  let translations;
  let runMetadata;
  if (provider === "fixture") {
    translations = captions.map((_cue, index) => config.translation.fixtureItems?.[index] ?? `Fixture ${index + 1}`);
  } else {
    const adapter = createStructuredAgentJsonAdapter({
      config: config.translation,
      schemaPath: "schemas/agent-caption-translation.schema.json",
      cwd: process.cwd(),
    });
    translations = await translateCaptionBatch({ captions, terminologyProfile, adapter });
    runMetadata = adapter.getLastRunMetadata();
  }
  const semantic = captions.map((cue, index) => ({
    ...cue,
    en: canonicalizeAgentTranslation(translations[index], terminologyProfile),
  }));
  const display =
    config.captionDisplayPunctuation === "none"
      ? semantic.map((cue) => ({
          ...cue,
          zh: stripDisplayPunctuation(cue.zh),
          en: stripDisplayPunctuation(cue.en),
        }))
      : structuredClone(semantic);
  await writeFile(resolve(config.semanticCaptionsFile), `${JSON.stringify(semantic, null, 2)}\n`);
  await writeFile(resolve(config.captionsFile), `${JSON.stringify(display, null, 2)}\n`);
  await writeFile(
    resolve(config.editDir, "translation-agent-report.json"),
    `${JSON.stringify(
      {
        schemaVersion: "1.0",
        provider,
        cueCount: captions.length,
        chineseSourceSha256: createHash("sha256").update(JSON.stringify(captions)).digest("hex"),
        chinesePreserved: true,
        timingPreserved: true,
        segmentationPreserved: true,
        runMetadata,
      },
      null,
      2,
    )}\n`,
  );
  console.log(config.semanticCaptionsFile);
  console.log(config.captionsFile);
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main(process.argv[2] ?? "config/workflow-test.json");
}
