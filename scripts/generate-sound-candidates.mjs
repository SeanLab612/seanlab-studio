import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sampleRate = 48_000;
const channels = 2;

const clamp = (value, minimum = -1, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const fade = (time, duration, attack = 0.02, release = 0.1) => {
  if (time < 0 || time > duration) return 0;
  return clamp(Math.min(time / attack, (duration - time) / release), 0, 1);
};
const shapedFade = (time, duration, attack, release, power = 1) =>
  Math.max(0, fade(time, duration, attack, release)) ** power;
const pseudoNoise = (index, seed) => {
  let value = (index + seed * 1013) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return ((value >>> 0) / 0xffffffff) * 2 - 1;
};
const smoothNoise = (index, seed, radius = 4) => {
  let sum = 0;
  let weight = 0;
  for (let offset = -radius; offset <= radius; offset += 1) {
    const localWeight = radius + 1 - Math.abs(offset);
    sum += pseudoNoise(index + offset, seed) * localWeight;
    weight += localWeight;
  }
  return sum / weight;
};
const sine = (time, frequency, phase = 0) => Math.sin(2 * Math.PI * frequency * time + phase);
const chirp = (time, duration, from, to, phase = 0) => {
  const slope = (to - from) / Math.max(duration, 0.001);
  return Math.sin(2 * Math.PI * (from * time + 0.5 * slope * time * time) + phase);
};
const stereo = (value, pan = 0) => {
  const left = Math.sqrt((1 - clamp(pan, -1, 1)) / 2);
  const right = Math.sqrt((1 + clamp(pan, -1, 1)) / 2);
  return [value * left, value * right];
};
const mixStereo = (...signals) =>
  signals.reduce(
    ([left, right], signal) => {
      const [nextLeft, nextRight] = Array.isArray(signal) ? signal : [signal, signal];
      return [left + nextLeft, right + nextRight];
    },
    [0, 0],
  );

const whoosh =
  ({ duration, seed, depth = 0.12, from = 180, to = 760, reverse = false, panFrom = 0, panTo = 0 }) =>
  (time, index) => {
    const progress = clamp(time / duration, 0, 1);
    const envelope = reverse
      ? shapedFade(time, duration, duration * 0.58, 0.05, 1.25)
      : shapedFade(time, duration, duration * 0.22, duration * 0.32, 1.15);
    const body =
      smoothNoise(index, seed, 7) * depth * envelope + chirp(time, duration, from, to) * depth * 0.18 * envelope;
    return stereo(body, panFrom + (panTo - panFrom) * progress);
  };

const recipes = [
  {
    id: "seanlab-air-swipe-short-c1",
    family: "transition",
    gesture: "whoosh-short",
    duration: 0.32,
    gainDb: -20,
    description: "短促轻空气转场，适合小卡片或快速切换。",
    render: whoosh({ duration: 0.32, seed: 11, depth: 0.12, from: 220, to: 820 }),
  },
  {
    id: "seanlab-air-swipe-medium-c1",
    family: "transition",
    gesture: "whoosh-medium",
    duration: 0.52,
    gainDb: -20,
    description: "中等长度空气转场，适合常规场景进入。",
    render: whoosh({ duration: 0.52, seed: 17, depth: 0.13, from: 150, to: 680 }),
  },
  {
    id: "seanlab-air-swipe-long-c1",
    family: "transition",
    gesture: "whoosh-long",
    duration: 0.78,
    gainDb: -21,
    description: "较长柔和转场，适合大画面或章节过渡。",
    render: whoosh({ duration: 0.78, seed: 23, depth: 0.14, from: 105, to: 560 }),
  },
  {
    id: "seanlab-reverse-lift-c1",
    family: "transition",
    gesture: "reverse-whoosh",
    duration: 0.58,
    gainDb: -21,
    description: "反向吸入式铺垫，适合揭示前的注意力收束。",
    render: whoosh({ duration: 0.58, seed: 29, depth: 0.13, from: 520, to: 155, reverse: true }),
  },
  {
    id: "seanlab-swipe-left-c1",
    family: "transition",
    gesture: "swipe-left",
    duration: 0.42,
    gainDb: -21,
    description: "由右向左的空间移动提示。",
    render: whoosh({ duration: 0.42, seed: 31, depth: 0.12, from: 180, to: 720, panFrom: 0.72, panTo: -0.72 }),
  },
  {
    id: "seanlab-swipe-right-c1",
    family: "transition",
    gesture: "swipe-right",
    duration: 0.42,
    gainDb: -21,
    description: "由左向右的空间移动提示。",
    render: whoosh({ duration: 0.42, seed: 37, depth: 0.12, from: 180, to: 720, panFrom: -0.72, panTo: 0.72 }),
  },
  {
    id: "seanlab-soft-impact-c1",
    family: "impact",
    gesture: "impact-soft",
    duration: 0.3,
    gainDb: -22,
    description: "柔和落点，适合标题或数据稳定出现。",
    render: (time, index) => {
      const decay = Math.exp(-time * 12);
      return stereo(sine(time, 122 - time * 42) * 0.2 * decay + smoothNoise(index, 41, 3) * 0.045 * decay);
    },
  },
  {
    id: "seanlab-deep-impact-c1",
    family: "impact",
    gesture: "impact-deep",
    duration: 0.48,
    gainDb: -24,
    description: "低频克制冲击，适合关键结论，不用于频繁点缀。",
    render: (time, index) => {
      const decay = Math.exp(-time * 8);
      return stereo(sine(time, 68 - time * 20) * 0.26 * decay + smoothNoise(index, 43, 5) * 0.035 * decay);
    },
  },
  {
    id: "seanlab-clean-pop-c1",
    family: "interface",
    gesture: "pop",
    duration: 0.18,
    gainDb: -23,
    description: "轻弹出提示，适合单个状态或数字确认。",
    render: (time) => stereo(chirp(time, 0.18, 410, 920) * 0.13 * shapedFade(time, 0.18, 0.006, 0.12, 1.4)),
  },
  {
    id: "seanlab-glass-reveal-c1",
    family: "reveal",
    gesture: "reveal",
    duration: 0.62,
    gainDb: -23,
    description: "透明清亮的揭示音，适合证据或新层级出现。",
    render: (time) => {
      const envelope = shapedFade(time, 0.62, 0.018, 0.32, 1.2);
      return stereo(
        (sine(time, 659.25) * 0.055 + sine(time, 987.77, 0.4) * 0.045 + sine(time, 1318.51, 0.7) * 0.025) * envelope,
      );
    },
  },
  {
    id: "seanlab-riser-short-c1",
    family: "transition",
    gesture: "riser",
    duration: 0.72,
    gainDb: -23,
    description: "短上升铺垫，适合进入重点前，不承担品牌签名。",
    render: (time, index) => {
      const envelope = shapedFade(time, 0.72, 0.28, 0.05, 1.15);
      return stereo(chirp(time, 0.72, 95, 640) * 0.09 * envelope + smoothNoise(index, 47, 6) * 0.055 * envelope);
    },
  },
  {
    id: "seanlab-soft-drop-c1",
    family: "transition",
    gesture: "drop",
    duration: 0.46,
    gainDb: -23,
    description: "柔和下降收尾，适合层级关闭或观点落定。",
    render: (time) => stereo(chirp(time, 0.46, 620, 118) * 0.12 * shapedFade(time, 0.46, 0.015, 0.2, 1.2)),
  },
  {
    id: "seanlab-digital-glitch-c1",
    family: "interface",
    gesture: "glitch",
    duration: 0.34,
    gainDb: -25,
    description: "受控数字故障提示，只用于技术异常或反例。",
    render: (time, index) => {
      const gate = Math.floor(time * 42) % 3 === 0 ? 1 : 0.22;
      const envelope = shapedFade(time, 0.34, 0.006, 0.06, 1.1);
      return stereo(
        (pseudoNoise(Math.floor(index / 13), 53) * 0.07 + sine(time, 1720 + Math.floor(time * 20) * 55) * 0.045) *
          gate *
          envelope,
      );
    },
  },
  {
    id: "seanlab-card-flip-c1",
    family: "interface",
    gesture: "flip",
    duration: 0.42,
    gainDb: -22,
    description: "卡片翻面质感，适合前后状态切换。",
    render: (time, index) =>
      mixStereo(
        whoosh({ duration: 0.42, seed: 59, depth: 0.09, from: 520, to: 190, panFrom: -0.25, panTo: 0.25 })(time, index),
        stereo(sine(time, 780) * 0.06 * shapedFade(time - 0.2, 0.16, 0.004, 0.1, 1.4)),
      ),
  },
  {
    id: "seanlab-marker-draw-c1",
    family: "annotation",
    gesture: "marker-draw",
    duration: 0.5,
    gainDb: -26,
    description: "原创笔触摩擦，匹配圈选或下划线绘制。",
    render: (time, index) => {
      const envelope = shapedFade(time, 0.5, 0.02, 0.05, 0.8);
      const scratch = smoothNoise(index, 61, 2) * 0.07 + sine(time, 92) * 0.018;
      return stereo(scratch * envelope, -0.7 + (time / 0.5) * 1.4);
    },
  },
  {
    id: "seanlab-cross-off-c1",
    family: "annotation",
    gesture: "cross-off",
    duration: 0.44,
    gainDb: -25,
    description: "双笔划掉动作，匹配否定、排除和错误示例。",
    render: (time, index) => {
      const first = shapedFade(time, 0.2, 0.012, 0.025, 0.8);
      const second = shapedFade(time - 0.23, 0.21, 0.012, 0.025, 0.8);
      const scratch = smoothNoise(index, 67, 2) * 0.075 + sine(time, 108) * 0.015;
      return stereo(scratch * (first + second), first > second ? -0.25 : 0.25);
    },
  },
  {
    id: "seanlab-highlight-sweep-c1",
    family: "annotation",
    gesture: "highlight-sweep",
    duration: 0.58,
    gainDb: -27,
    description: "宽头荧光笔扫过质感，匹配重点高亮。",
    render: (time, index) => {
      const envelope = shapedFade(time, 0.58, 0.035, 0.05, 0.7);
      return stereo((smoothNoise(index, 71, 8) * 0.065 + sine(time, 68) * 0.012) * envelope, -0.6 + time * 2.05);
    },
  },
  {
    id: "seanlab-bracket-tap-c1",
    family: "annotation",
    gesture: "bracket",
    duration: 0.3,
    gainDb: -25,
    description: "左右括号双落点，适合框定短词或范围。",
    render: (time) => {
      const first = shapedFade(time, 0.11, 0.004, 0.075, 1.5);
      const second = shapedFade(time - 0.17, 0.13, 0.004, 0.09, 1.5);
      return mixStereo(stereo(sine(time, 690) * 0.09 * first, -0.52), stereo(sine(time, 760) * 0.09 * second, 0.52));
    },
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

  const rendered = new Float64Array(samples * channels);
  let sourcePeak = 0;
  for (let index = 0; index < samples; index += 1) {
    const output = recipe.render(index / sampleRate, index);
    const [left, right] = Array.isArray(output) ? output : [output, output];
    rendered[index * 2] = left;
    rendered[index * 2 + 1] = right;
    sourcePeak = Math.max(sourcePeak, Math.abs(left), Math.abs(right));
  }
  const targetPeakDbfs = -6;
  const normalization = sourcePeak > 0 ? 10 ** (targetPeakDbfs / 20) / sourcePeak : 1;
  for (let index = 0; index < samples; index += 1) {
    const left = Math.round(clamp(rendered[index * 2] * normalization) * 32767);
    const right = Math.round(clamp(rendered[index * 2 + 1] * normalization) * 32767);
    buffer.writeInt16LE(left, 44 + index * 4);
    buffer.writeInt16LE(right, 44 + index * 4 + 2);
  }
  return buffer;
};

const outputDirectory = resolve("public/assets/audio/candidates");
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
    throw new Error(`Unable to measure candidate loudness metadata for ${recipe.id}`);
  assets.push({
    id: recipe.id,
    status: "candidate",
    family: recipe.family,
    gesture: recipe.gesture,
    description: recipe.description,
    file: `assets/audio/candidates/${recipe.id}.wav`,
    durationSeconds: recipe.duration,
    sampleRate,
    channels,
    gainDb: recipe.gainDb,
    meanVolumeDb,
    peakDbfs,
    provenance: "Original deterministic synthesis authored for SeanLab",
    inspirationBoundary:
      "Functional motion category only; no Jianying, CapCut, or third-party reference audio was copied.",
    license: "SeanLab owned original",
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const registry = resolve("src/sound-design/generated-candidate-registry.json");
await mkdir(dirname(registry), { recursive: true });
await writeFile(registry, `${JSON.stringify({ schemaVersion: "1.0", status: "candidate-only", assets }, null, 2)}\n`);
console.log(`${registry}: ${assets.length} original candidate sound assets`);
