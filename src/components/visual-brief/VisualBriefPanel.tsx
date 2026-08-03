import type React from "react";
import { interpolate, spring } from "remotion";
import type { OverlayCue, VisualBrief } from "../../data/sample-props";
import { resolveComponentAccent, typographyTokens } from "../../design-tokens";
import { CapabilitySurfaceGrid, CorePositioningNode, ModelClassificationMap, TradeoffScale } from "../review";

const text: React.CSSProperties = { fontFamily: typographyTokens.family, color: "white" };
const fadeUp = (frame: number, fps: number) => {
  const p = spring({ frame: Math.max(0, frame - 2), fps, config: { damping: 16, stiffness: 140, mass: 0.7 } });
  return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)` };
};

const labels = (brief: VisualBrief) => brief.labels ?? [];
const compatibleValues = (brief: VisualBrief, rows: number, columns: number) =>
  brief.values ??
  Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => Math.max(0.2, Math.min(0.96, 0.9 - r * 0.09 - c * 0.04))),
  );

/**
 * Compatibility adapter for the original MVP cue schema.
 * Rendering is delegated to the same parameterized review candidates used by
 * VisualBrief; this file no longer owns a second hard-coded renderer.
 */
const MigratedGraphic: React.FC<{ brief: VisualBrief; accent: string; frame: number; fps: number }> = ({
  brief,
  accent,
  frame,
  fps,
}) => {
  const list = labels(brief);
  switch (brief.metaphor) {
    case "model-map":
      return (
        <ModelClassificationMap
          frame={frame}
          fps={fps}
          accent={accent}
          selectedId={brief.selectedId ?? "item-0"}
          items={list
            .slice(0, 6)
            .map((title, index) => ({ id: `item-${index}`, title, detail: brief.itemDetails?.[index] ?? "" }))}
        />
      );
    case "core-node":
      return (
        <CorePositioningNode
          frame={frame}
          fps={fps}
          accent={accent}
          centerLabel={brief.centerLabel ?? brief.primaryText}
          centerValue={brief.centerValue}
          nodes={list
            .slice(0, 6)
            .map((label, index) => ({ id: `node-${index}`, label, detail: brief.itemDetails?.[index] }))}
        />
      );
    case "capability-grid": {
      const rows = brief.rows ?? list.slice(0, 4);
      const columns = brief.columns ?? ["能力 A", "能力 B", "能力 C", "能力 D"];
      return (
        <CapabilitySurfaceGrid
          frame={frame}
          fps={fps}
          accent={accent}
          rows={rows}
          columns={columns}
          values={compatibleValues(brief, rows.length, columns.length)}
        />
      );
    }
    case "tradeoff-scale":
      return (
        <TradeoffScale
          frame={frame}
          fps={fps}
          accent={accent}
          items={(
            brief.tradeoffs ?? list.slice(0, 3).map((label, index) => ({ label, value: [48, 91, 76][index] ?? 50 }))
          ).map((item, index) => ({ id: `tradeoff-${index}`, ...item }))}
        />
      );
  }
};

export const VisualBriefPanel: React.FC<{ cue: OverlayCue | undefined; frame: number; fps: number }> = ({
  cue,
  frame,
  fps,
}) => {
  const brief = cue?.visualBrief;
  if (!cue || !brief) return null;
  const accent = resolveComponentAccent(cue.accent);
  return (
    <div style={{ ...fadeUp(frame, fps) }}>
      <div style={{ position: "absolute", left: 4, top: -76, width: 700 }}>
        <div style={{ ...text, color: accent, fontSize: 18, letterSpacing: 6, fontWeight: 800 }}>{cue.eyebrow}</div>
        <div style={{ ...text, fontSize: 48, fontWeight: 850, marginTop: 12 }}>{brief.primaryText}</div>
        <div style={{ ...text, color: accent, fontSize: 20, letterSpacing: 4, fontWeight: 800, marginTop: 8 }}>
          {brief.secondaryText}
        </div>
      </div>
      <MigratedGraphic brief={brief} accent={accent} frame={frame} fps={fps} />
      {brief.detail ? (
        <div style={{ position: "absolute", left: 68, top: 690, width: 700, ...text, fontSize: 20, opacity: 0.84 }}>
          {brief.detail}
        </div>
      ) : null}
    </div>
  );
};
