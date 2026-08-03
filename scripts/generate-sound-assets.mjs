import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const sampleRate = 48_000;
const channels = 2;

const envelope = (time, start, duration, attack = 0.015, release = 0.12) => {
  const local = time - start;
  if (local < 0 || local > duration) return 0;
  return Math.min(1, local / attack, (duration - local) / release);
};

const tone = (time, { start, duration, frequency, gain = 0.15, harmonic = 0.22 }) => {
  const env = envelope(time, start, duration);
  const local = time - start;
  return (
    env * gain * (Math.sin(2 * Math.PI * frequency * local) + harmonic * Math.sin(2 * Math.PI * frequency * 2 * local))
  );
};

let noiseState = 0x51ea9ab;
const noise = () => {
  noiseState = (noiseState * 1664525 + 1013904223) >>> 0;
  return (noiseState / 0xffffffff) * 2 - 1;
};

const recipes = [
  {
    id: "seanlab-signature-v1",
    role: "brand-signature",
    duration: 2.2,
    gainDb: -3,
    provenance: "Original deterministic synthesis for SeanLab",
    render: (time) =>
      [
        { start: 0.2, duration: 0.32, frequency: 392, gain: 0.1 },
        { start: 0.4, duration: 0.34, frequency: 523.25, gain: 0.11 },
        { start: 0.62, duration: 0.38, frequency: 659.25, gain: 0.12 },
        { start: 0.88, duration: 0.62, frequency: 783.99, gain: 0.15 },
        { start: 1.16, duration: 0.62, frequency: 196, gain: 0.07, harmonic: 0.08 },
      ].reduce((sum, note) => sum + tone(time, note), 0),
  },
  {
    id: "seanlab-soft-whoosh-v1",
    role: "scene-transition",
    duration: 0.48,
    gainDb: -16,
    provenance: "Original deterministic filtered-noise synthesis for SeanLab",
    render: (time) => {
      const env = envelope(time, 0, 0.48, 0.08, 0.16);
      return noise() * env * 0.12 * Math.sin(Math.PI * Math.min(1, time / 0.48));
    },
  },
  {
    id: "seanlab-hero-hit-v1",
    role: "hero-entry",
    duration: 0.42,
    gainDb: -18,
    provenance: "Original deterministic synthesis for SeanLab",
    render: (time) => tone(time, { start: 0, duration: 0.42, frequency: 146.83, gain: 0.16, harmonic: 0.35 }),
  },
  {
    id: "seanlab-item-tick-v1",
    role: "item-step",
    duration: 0.16,
    gainDb: -22,
    provenance: "Original deterministic synthesis for SeanLab",
    render: (time) => tone(time, { start: 0, duration: 0.16, frequency: 880, gain: 0.1, harmonic: 0.12 }),
  },
  {
    id: "seanlab-soft-settle-v1",
    role: "settle",
    duration: 0.3,
    gainDb: -22,
    provenance: "Original deterministic synthesis for SeanLab",
    render: (time) => tone(time, { start: 0, duration: 0.3, frequency: 440, gain: 0.08, harmonic: 0.08 }),
  },
  {
    id: "seanlab-warning-accent-v1",
    role: "warning",
    duration: 0.38,
    gainDb: -20,
    provenance: "Original deterministic synthesis for SeanLab",
    render: (time) =>
      tone(time, { start: 0, duration: 0.24, frequency: 293.66, gain: 0.1 }) +
      tone(time, { start: 0.12, duration: 0.26, frequency: 233.08, gain: 0.08 }),
  },
  {
    id: "seanlab-component-exit-v1",
    role: "component-exit",
    duration: 0.26,
    gainDb: -22,
    provenance: "Original deterministic synthesis for SeanLab",
    render: (time) =>
      tone(time, { start: 0, duration: 0.26, frequency: 523.25 - time * 260, gain: 0.07, harmonic: 0.06 }),
  },
];

const wav = (recipe) => {
  const samples = Math.ceil(recipe.duration * sampleRate);
  const dataBytes = samples * channels * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  noiseState = 0x51ea9ab;
  const rendered = new Float64Array(samples);
  let sourcePeak = 0;
  for (let index = 0; index < samples; index += 1) {
    const value = Math.max(-1, Math.min(1, recipe.render(index / sampleRate)));
    rendered[index] = value;
    sourcePeak = Math.max(sourcePeak, Math.abs(value));
  }
  const targetPeakDbfs = recipe.role === "brand-signature" ? -11.4 : -3;
  const normalization = sourcePeak > 0 ? 10 ** (targetPeakDbfs / 20) / sourcePeak : 1;
  for (let index = 0; index < samples; index += 1) {
    const value = Math.max(-1, Math.min(1, rendered[index] * normalization));
    const pcm = Math.round(value * 32767);
    buffer.writeInt16LE(pcm, 44 + index * 4);
    buffer.writeInt16LE(pcm, 44 + index * 4 + 2);
  }
  return buffer;
};

const outputDirectory = resolve("public/assets/audio");
await mkdir(outputDirectory, { recursive: true });
const assets = [];
for (const recipe of recipes) {
  const file = resolve(outputDirectory, `${recipe.id}.wav`);
  await writeFile(file, wav(recipe));
  const bytes = await readFile(file);
  const { stderr } = await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-i",
    file,
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-",
  ]);
  const meanVolumeDb = Number(stderr.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1]);
  const peakDbfs = Number(stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);
  if (!Number.isFinite(meanVolumeDb) || !Number.isFinite(peakDbfs))
    throw new Error(`Unable to measure loudness metadata for ${recipe.id}`);
  assets.push({
    id: recipe.id,
    role: recipe.role,
    file: `assets/audio/${recipe.id}.wav`,
    durationSeconds: recipe.duration,
    sampleRate,
    channels,
    gainDb: recipe.gainDb,
    meanVolumeDb,
    peakDbfs,
    provenance: recipe.provenance,
    license: "SeanLab owned original",
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const registry = resolve("src/sound-design/generated-registry.json");
await mkdir(dirname(registry), { recursive: true });
await writeFile(registry, `${JSON.stringify({ schemaVersion: "1.0", assets }, null, 2)}\n`);
console.log(`${registry}: ${assets.length} original local sound assets`);
