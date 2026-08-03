import type { AnimationPrototypeId } from "../visual-production/types.ts";

export type AnimationStagePosition = { x: number; y: number; width: number; minHeight: number };

export const animationStageLayout = (prototypeId: AnimationPrototypeId, count: number): AnimationStagePosition[] => {
  if (prototypeId === "aggregate-decompose")
    return Array.from({ length: count }, (_, index) => ({
      x: 120 + (index % 2) * 370,
      y: 280 + Math.floor(index / 2) * 210,
      width: 270,
      minHeight: 122,
    }));
  if (prototypeId === "focus-zoom")
    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      return {
        x: 720 + Math.cos(angle) * 390,
        y: 430 + Math.sin(angle) * 270,
        width: index === 1 ? 340 : 220,
        minHeight: index === 1 ? 180 : 112,
      };
    });
  if (prototypeId === "threshold-landing")
    return Array.from({ length: count }, (_, index) => ({
      x: 170 + index * 370,
      y: index === 0 ? 250 : 520 + (index % 2) * 80,
      width: 290,
      minHeight: 130 + index * 18,
    }));
  if (prototypeId === "converge-diffuse")
    return Array.from({ length: count }, (_, index) => ({
      x: 100 + (index % 2) * 390,
      y: 250 + Math.floor(index / 2) * 220,
      width: 250,
      minHeight: 126,
    }));
  if (prototypeId === "layered-system")
    return Array.from({ length: count }, (_, index) => ({
      x: 420 + index * 42,
      y: 260 + index * 118,
      width: 650,
      minHeight: 104,
    }));
  if (prototypeId === "before-after") {
    const leftCount = Math.ceil(count / 2);
    return Array.from({ length: count }, (_, index) => {
      const onLeft = index < leftCount;
      const row = onLeft ? index : index - leftCount;
      return { x: onLeft ? 120 : 800, y: 300 + row * 205, width: 390, minHeight: 150 };
    });
  }
  if (prototypeId === "evidence-gate")
    return Array.from({ length: count }, (_, index) => {
      const isResult = index === count - 1;
      return {
        x: isResult ? 1030 : 120 + (index % 2) * 390,
        y: isResult ? 420 : 290 + Math.floor(index / 2) * 220,
        width: isResult ? 370 : 310,
        minHeight: isResult ? 176 : 144,
      };
    });
  if (prototypeId === "state-transition")
    return Array.from({ length: count }, (_, index) => ({
      x: 115 + (index % 3) * 475,
      y: 330 + Math.floor(index / 3) * 245 + (index % 2) * 28,
      width: 330,
      minHeight: 170,
    }));
  if (prototypeId === "causal-chain")
    return Array.from({ length: count }, (_, index) => ({
      x: 100 + (index % 3) * 485,
      y: 300 + Math.floor(index / 3) * 280 + (index % 3) * 38,
      width: 300,
      minHeight: 156,
    }));
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 3);
    const rawColumn = index % 3;
    const column = row % 2 ? 2 - rawColumn : rawColumn;
    return { x: 130 + column * 480, y: 310 + row * 250, width: 286, minHeight: 158 };
  });
};

export const animationConnectorPath = (from: AnimationStagePosition, to: AnimationStagePosition) => {
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.minHeight / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.minHeight / 2 };
  const horizontal = Math.abs(toCenter.x - fromCenter.x) >= Math.abs(toCenter.y - fromCenter.y);
  if (horizontal) {
    const direction = Math.sign(toCenter.x - fromCenter.x) || 1;
    const startX = fromCenter.x + (from.width / 2 + 8) * direction;
    const endX = toCenter.x - (to.width / 2 + 14) * direction;
    const bend = (startX + endX) / 2;
    return `M${startX} ${fromCenter.y} C${bend} ${fromCenter.y - 24}, ${bend} ${toCenter.y + 24}, ${endX} ${toCenter.y}`;
  }
  const direction = Math.sign(toCenter.y - fromCenter.y) || 1;
  const startY = fromCenter.y + (from.minHeight / 2 + 8) * direction;
  const endY = toCenter.y - (to.minHeight / 2 + 14) * direction;
  const bend = (startY + endY) / 2;
  return `M${fromCenter.x} ${startY} C${fromCenter.x + 32} ${bend}, ${toCenter.x - 32} ${bend}, ${toCenter.x} ${endY}`;
};
