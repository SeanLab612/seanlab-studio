import type React from "react";
import { interpolate } from "remotion";
import { scaleLinear } from "../../charts";
import type { IconId } from "../../icons";
import { Icon } from "../../icons";
import { IdentityMark, type MediaEntityKind } from "../../media-assets";
import { LiquidGlass } from "../LiquidGlass";
import { springSettleProgress } from "../../motion-primitives/progress";
import { chartAccentPair, enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";
import { resolveProgressiveEmphasis } from "./progressive-emphasis";

type BaseProps = { frame: number; fps: number; accent?: string };
export type TimelineItem = {
  id: string;
  /** Historical date or a neutral progression marker such as 01. */
  marker?: string;
  /** Legacy alias retained for frozen briefs and existing reviews. */
  year?: string;
  title: string;
  detail?: string;
  iconId?: IconId;
  accent?: string;
};
export const HistoricalTimeline: React.FC<
  BaseProps & {
    items: TimelineItem[];
    mode?: "historical" | "progression";
    activeIndex?: number;
    activeProgress?: number;
    takeaway?: string;
  }
> = ({
  frame,
  fps,
  items,
  mode = "historical",
  activeIndex = items.length - 1,
  activeProgress = 1,
  accent = palette.amber,
  takeaway,
}) => {
  const safe = items.slice(0, 6);
  const width = 650;
  const gap = safe.length > 1 ? width / (safe.length - 1) : 0;
  return (
    <div style={{ position: "absolute", left: 68, top: 260, width: 720, ...rise(enter(frame, fps, 8)) }}>
      <div style={{ position: "relative", height: 330 }}>
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 130,
            height: 3,
            background: "rgba(255,255,255,.18)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 130,
            height: 3,
            width: Math.max(0, Math.min(width, gap * activeIndex)),
            background: accent,
            boxShadow: `0 0 18px ${accent}`,
          }}
        />
        {safe.map((x, i) => {
          const emphasis = resolveProgressiveEmphasis({ index: i, activeIndex, activeProgress });
          const active = emphasis.state === "active",
            done = emphasis.state === "completed";
          return (
            <div
              key={x.id}
              style={{
                position: "absolute",
                left: 30 + i * gap,
                top: 0,
                width: Math.min(170, gap + 25),
                transform: "translateX(-18px)",
                opacity: emphasis.opacity,
                filter: `brightness(${emphasis.brightness}) saturate(${emphasis.saturation})`,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 850, color: active ? (x.accent ?? accent) : palette.muted }}>
                <EmphasisText
                  text={x.marker ?? x.year ?? (mode === "progression" ? String(i + 1).padStart(2, "0") : "")}
                />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8, lineHeight: 1.15 }}>
                <EmphasisText text={x.title} />
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 111,
                  left: 7,
                  width: 34,
                  height: 34,
                  borderRadius: 99,
                  background: active ? (x.accent ?? accent) : done ? "#59D98E" : "#30343B",
                  border: "4px solid #101318",
                  boxShadow: active ? `0 0 24px ${x.accent ?? accent}` : "none",
                }}
              />
              {mode === "historical" ? (
                <div style={{ marginTop: 88, fontSize: 22, fontWeight: 680, lineHeight: 1.35, color: palette.muted }}>
                  {x.detail}
                </div>
              ) : null}
            </div>
          );
        })}
        {mode === "progression" && safe[activeIndex]?.detail ? (
          <div
            style={{
              position: "absolute",
              left: 30,
              top: 188,
              width: 620,
              fontSize: 26,
              fontWeight: 720,
              lineHeight: 1.35,
              color: palette.paper,
            }}
          >
            <EmphasisText text={safe[activeIndex].detail ?? ""} />
          </div>
        ) : null}
      </div>
      {takeaway && (
        <LiquidGlass
          surface="bare"
          accent={accent}
          padding="12px 18px"
          radius={16}
          contentStyle={{ display: "flex", alignItems: "flex-start", maxWidth: 620 }}
        >
          <b
            style={{
              flex: "0 0 auto",
              color: accent,
              fontSize: 28,
              lineHeight: 1.25,
            }}
          >
            结论
          </b>
          <span
            style={{
              marginLeft: 14,
              maxWidth: 520,
              fontSize: 32,
              lineHeight: 1.25,
              fontWeight: 720,
              whiteSpace: "normal",
            }}
          >
            <EmphasisText text={takeaway} />
          </span>
        </LiquidGlass>
      )}
    </div>
  );
};

export type MatrixPoint = {
  id: string;
  label: string;
  x?: number | null;
  y?: number | null;
  xBand?: "low" | "high";
  yBand?: "low" | "high";
  iconId?: IconId;
  color?: string;
};
export const DecisionMatrix: React.FC<
  BaseProps & {
    points: MatrixPoint[];
    mode?: "numeric" | "qualitative";
    highlightIds?: string[];
    xLabel: string;
    yLabel: string;
    quadrants?: [string, string, string, string];
    selectionProgress?: number;
  }
> = ({
  frame,
  fps,
  points,
  mode = "numeric",
  highlightIds = [],
  xLabel,
  yLabel,
  quadrants = ["重点投入", "战略观察", "保持效率", "谨慎退出"],
  accent = palette.blue,
  selectionProgress = 1,
}) => (
  <LiquidGlass
    surface="bare"
    accent={accent}
    padding="24px"
    radius={24}
    style={{ position: "absolute", left: 68, top: 215, width: 720, height: 500, ...rise(enter(frame, fps, 6)) }}
  >
    <div style={{ position: "relative", height: 452 }}>
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 34,
          top: 35,
          bottom: 64,
          borderLeft: "2px solid rgba(255,255,255,.65)",
          borderBottom: "2px solid rgba(255,255,255,.65)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            borderLeft: "1px dashed rgba(255,255,255,.18)",
          }}
        />
        <div
          style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed rgba(255,255,255,.18)" }}
        />
        {quadrants.map((q, i) => (
          <span
            key={q}
            style={{
              position: "absolute",
              fontSize: 22,
              fontWeight: 760,
              color: "rgba(255,255,255,.72)",
              left: i % 2 ? "56%" : "5%",
              top: i < 2 ? "6%" : "82%",
            }}
          >
            <EmphasisText text={q} />
          </span>
        ))}
        {points.slice(0, 8).map((p, i) => {
          const hi = highlightIds.includes(p.id);
          const xPosition = mode === "qualitative" ? (p.xBand === "high" ? 75 : 25) : (p.x ?? 0);
          const yPosition = mode === "qualitative" ? (p.yBand === "high" ? 75 : 25) : (p.y ?? 0);
          const labelPosition = [
            { left: 18, top: 8 },
            { left: -88, top: 6 },
            { left: -16, top: -38 },
            { left: 18, top: -36 },
            { left: 18, top: -40 },
          ][i % 5];
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: `${scaleLinear(xPosition, { min: 0, max: 100 }, [3, 94])}%`,
                bottom: `${scaleLinear(yPosition, { min: 0, max: 100 }, [4, 92])}%`,
                transform: `translate(-50%,50%) scale(${hi ? 0.72 + springSettleProgress(selectionProgress) * 0.28 : 1})`,
                opacity: highlightIds.length > 0 && !hi ? 0.72 : 1,
              }}
            >
              <div
                style={{
                  width: hi ? 28 : 20,
                  height: hi ? 28 : 20,
                  borderRadius: 99,
                  background: p.color ?? (hi ? accent : "#F5F2EA"),
                  boxShadow: hi ? `0 0 20px ${p.color ?? accent}` : "none",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: labelPosition.left,
                  top: labelPosition.top,
                  whiteSpace: "nowrap",
                  fontSize: 24,
                  fontWeight: hi ? 850 : 650,
                  color: hi ? (p.color ?? accent) : palette.paper,
                }}
              >
                <EmphasisText text={p.label} />
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 8, left: 300, fontSize: 24, fontWeight: 760, color: palette.muted }}>
        <EmphasisText text={xLabel} /> →
      </div>
      <div
        style={{
          position: "absolute",
          left: 5,
          top: 220,
          transform: "rotate(-90deg)",
          fontSize: 24,
          fontWeight: 760,
          color: palette.muted,
          whiteSpace: "nowrap",
        }}
      >
        ← <EmphasisText text={yLabel} />
      </div>
    </div>
  </LiquidGlass>
);

export type ClassificationItem = {
  id: string;
  title: string;
  detail: string;
  iconId?: IconId;
  entityId?: string;
  entityKind?: MediaEntityKind;
  accent?: string;
};
export const ModelClassificationMap: React.FC<
  BaseProps & { items: ClassificationItem[]; selectedId?: string; headline?: string; compact?: boolean }
> = ({ frame, fps, items, selectedId, headline, accent = palette.blue, compact = false }) => (
  <div
    style={{
      position: "absolute",
      left: compact ? 54 : 68,
      top: compact ? 210 : 230,
      width: compact ? 590 : 740,
      ...rise(enter(frame, fps, 6)),
    }}
  >
    {headline && (
      <div style={{ fontSize: compact ? 28 : 26, fontWeight: 820, marginBottom: 16 }}>
        <EmphasisText text={headline} />
      </div>
    )}
    <div
      style={{ display: "grid", gridTemplateColumns: `repeat(${items.length <= 3 ? items.length : 2},1fr)`, gap: 20 }}
    >
      {items.slice(0, 6).map((x) => {
        const on = x.id === selectedId;
        return (
          <LiquidGlass
            surface="bare"
            key={x.id}
            accent={`${x.accent ?? accent}${on ? "55" : "24"}`}
            padding={compact ? "18px 16px" : "22px 18px"}
            radius={20}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center", opacity: selectedId && !on ? 0.74 : 1 }}>
              {x.entityId && x.entityKind ? (
                <IdentityMark
                  entityId={x.entityId}
                  kind={x.entityKind}
                  label={x.title}
                  size={compact ? 48 : 54}
                  color={x.accent ?? accent}
                />
              ) : (
                <Icon id={x.iconId} fallbackLabel={x.title} size={compact ? 48 : 54} color={x.accent ?? accent} />
              )}
              <div>
                <div
                  style={{
                    fontSize: compact ? 24 : 26,
                    fontWeight: 850,
                    color: on ? (x.accent ?? accent) : palette.paper,
                  }}
                >
                  <EmphasisText text={x.title} />
                </div>
                <div
                  style={{
                    fontSize: 22,
                    lineHeight: 1.25,
                    fontWeight: 650,
                    color: palette.muted,
                    marginTop: 6,
                  }}
                >
                  <EmphasisText text={x.detail} />
                </div>
              </div>
            </div>
          </LiquidGlass>
        );
      })}
    </div>
  </div>
);

export type PositionNode = { id: string; label: string; detail?: string; iconId?: IconId; accent?: string };
export const CorePositioningNode: React.FC<
  BaseProps & {
    centerLabel: string;
    centerValue?: string;
    centerIcon?: IconId;
    nodes: PositionNode[];
    assemblyProgress?: number;
  }
> = ({ frame, fps, centerLabel, centerValue, centerIcon, nodes, accent = palette.blue, assemblyProgress = 1 }) => {
  const accents = chartAccentPair(
    accent,
    nodes.map((node) => node.accent),
  );
  return (
    <div style={{ position: "absolute", left: 68, top: 205, width: 720, height: 520, ...rise(enter(frame, fps, 6)) }}>
      <svg style={{ position: "absolute", inset: 0 }} width="720" height="520">
        {nodes.slice(0, 6).map((_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / nodes.length;
          return (
            <line
              key={i}
              x1="360"
              y1="255"
              x2={360 + 250 * Math.cos(a)}
              y2={255 + 185 * Math.sin(a)}
              stroke={accents[i % accents.length]}
              strokeOpacity="0.72"
              strokeWidth="2.4"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - assemblyProgress}
            />
          );
        })}
      </svg>
      <LiquidGlass
        surface="bare"
        accent={accents[0]}
        padding="22px"
        radius={999}
        style={{
          position: "absolute",
          left: 270,
          top: 165,
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          transform: `scale(${interpolate(assemblyProgress, [0, 1], [0.78, 1])})`,
          opacity: interpolate(assemblyProgress, [0, 0.25], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div>
          {centerIcon && <Icon id={centerIcon} size={48} color={accents[0]} style={{ margin: "0 auto 8px" }} />}
          <div style={{ fontSize: 22, fontWeight: 760, color: palette.paper }}>
            <EmphasisText text={centerLabel} />
          </div>
          {centerValue && (
            <div style={{ fontSize: 38, fontWeight: 900, color: accents[1] }}>
              <EmphasisText text={centerValue} />
            </div>
          )}
        </div>
      </LiquidGlass>
      {nodes.slice(0, 6).map((n, i) => {
        const nodeAccent = accents[i % accents.length];
        const a = -Math.PI / 2 + (i * Math.PI * 2) / nodes.length;
        const localProgress = Math.max(0, Math.min(1, assemblyProgress * 1.3 - i * 0.07));
        const startA = a - 0.9;
        const radiusX = interpolate(localProgress, [0, 1], [350, 250]);
        const radiusY = interpolate(localProgress, [0, 1], [260, 185]);
        const currentA = interpolate(localProgress, [0, 1], [startA, a]);
        return (
          <LiquidGlass
            surface="bare"
            key={n.id}
            accent={nodeAccent}
            padding="14px 16px"
            radius={16}
            style={{
              position: "absolute",
              left: 360 + radiusX * Math.cos(currentA) - 82,
              top: 255 + radiusY * Math.sin(currentA) - 42,
              width: 176,
              minHeight: 72,
              opacity: localProgress,
              transform: `scale(${interpolate(localProgress, [0, 1], [0.72, 1])})`,
            }}
          >
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
              <Icon id={n.iconId} fallbackLabel={n.label} size={38} color={nodeAccent} />
              <div>
                <b style={{ fontSize: 20 }}>
                  <EmphasisText text={n.label} />
                </b>
                {n.detail && n.detail.trim() !== n.label.trim() ? (
                  <div style={{ fontSize: 15, lineHeight: 1.25, color: palette.muted, marginTop: 3 }}>
                    <EmphasisText text={n.detail} />
                  </div>
                ) : null}
              </div>
            </div>
          </LiquidGlass>
        );
      })}
    </div>
  );
};

export const CapabilitySurfaceGrid: React.FC<
  BaseProps & {
    rows: string[];
    columns: string[];
    values?: number[][];
    states?: string[][];
    mode?: "numeric" | "qualitative";
    highlight?: { row: number; column: number };
    legend?: string;
  }
> = ({
  frame,
  fps,
  rows,
  columns,
  values = [],
  states = [],
  mode = "numeric",
  highlight,
  legend,
  accent = palette.mint,
}) => (
  <LiquidGlass
    surface="bare"
    accent={accent}
    padding="0px"
    radius={22}
    style={{ position: "absolute", left: 68, top: 220, width: 720, ...rise(enter(frame, fps, 6)) }}
  >
    <div style={{ display: "grid", gridTemplateColumns: `130px repeat(${columns.length},1fr)`, gap: 9 }}>
      <div />
      {columns.slice(0, 6).map((c) => (
        <div
          key={c}
          style={{ textAlign: "center", fontSize: 24, lineHeight: 1.15, fontWeight: 800, color: palette.muted }}
        >
          <EmphasisText text={c} />
        </div>
      ))}
      {rows.slice(0, 6).flatMap((r, ri) => [
        <div key={`${r}-l`} style={{ fontSize: 26, fontWeight: 820, display: "flex", alignItems: "center" }}>
          <EmphasisText text={r} />
        </div>,
        ...columns.slice(0, 6).map((_, ci) => {
          const v = Math.max(0, Math.min(1, values[ri]?.[ci] ?? 0));
          const state = states[ri]?.[ci] ?? "";
          const stateStrength = /^(?:支持|强|高|完整|具备|是|可用)$/.test(state)
            ? 1
            : /^(?:部分支持|中|一般|有限|部分|待验证)$/.test(state)
              ? 0.56
              : /^(?:不支持|弱|低|无|否|不可用)$/.test(state)
                ? 0.18
                : 0.38;
          const fillStrength = mode === "qualitative" ? stateStrength : v;
          const hi = highlight?.row === ri && highlight?.column === ci;
          return (
            <div
              key={`${r}-${ci}`}
              style={{
                height: 70,
                borderRadius: 13,
                background: `rgba(89,217,142,${0.08 + fillStrength * 0.65})`,
                border: hi ? `2px solid ${accent}` : "none",
                boxShadow: hi ? `0 0 18px ${accent}88` : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 850,
              }}
            >
              {mode === "qualitative" ? <EmphasisText text={state} /> : Math.round(v * 100)}
            </div>
          );
        }),
      ])}
    </div>
    {legend && (
      <div style={{ marginTop: 18, fontSize: 28, lineHeight: 1.25, fontWeight: 780, color: palette.muted }}>
        <EmphasisText text={legend} />
      </div>
    )}
  </LiquidGlass>
);

export type TradeoffItem = {
  id: string;
  label: string;
  value?: number | null;
  valueLabel?: string;
  direction?: "up" | "down" | "stable";
  previousValue?: number;
  color?: string;
  note?: string;
};
export const TradeoffScale: React.FC<
  BaseProps & {
    items: TradeoffItem[];
    mode?: "numeric" | "directional";
    highlightId?: string;
    lowLabel?: string;
    highLabel?: string;
    compact?: boolean;
  }
> = ({
  frame,
  fps,
  items,
  mode = "numeric",
  highlightId,
  lowLabel = "低",
  highLabel = "高",
  accent = palette.amber,
  compact = false,
}) => (
  <div
    style={{
      position: "absolute",
      left: compact ? 54 : 68,
      top: compact ? 210 : 235,
      width: compact ? 590 : 720,
      ...rise(enter(frame, fps, 6)),
    }}
  >
    {items.slice(0, 3).map((x) => {
      const hi = x.id === highlightId;
      const v = Math.max(0, Math.min(100, x.value ?? 0));
      const markerPosition = x.direction === "up" ? 82 : x.direction === "down" ? 18 : 50;
      const directionMark = x.direction === "up" ? "↑" : x.direction === "down" ? "↓" : "→";
      return (
        <LiquidGlass
          surface="bare"
          key={x.id}
          accent={`${x.color ?? accent}${hi ? "55" : "28"}`}
          padding="18px"
          radius={18}
          variant="brightFootage"
          style={{ marginBottom: compact ? 16 : 14 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b
              style={{ fontSize: compact ? 28 : 30, color: highlightId && !hi ? "rgba(245,242,234,0.82)" : undefined }}
            >
              <EmphasisText text={x.label} />
            </b>
            <b style={{ fontSize: compact ? 34 : 38, color: x.color ?? accent }}>
              {mode === "directional" ? `${directionMark} ${x.valueLabel ?? ""}` : v}
            </b>
          </div>
          <div
            style={{
              height: 12,
              borderRadius: 99,
              background: "rgba(255,255,255,.12)",
              marginTop: 13,
              position: "relative",
            }}
          >
            {x.previousValue !== undefined && (
              <div
                style={{
                  position: "absolute",
                  left: `${x.previousValue}%`,
                  top: -4,
                  width: 2,
                  height: 18,
                  background: "rgba(255,255,255,.6)",
                }}
              />
            )}
            {mode === "directional" ? (
              <div
                style={{
                  position: "absolute",
                  left: `${markerPosition}%`,
                  top: -7,
                  width: 26,
                  height: 26,
                  borderRadius: 99,
                  transform: "translateX(-50%)",
                  background: x.color ?? accent,
                  boxShadow: `0 0 16px ${x.color ?? accent}88`,
                }}
              />
            ) : (
              <div style={{ width: `${v}%`, height: "100%", borderRadius: 99, background: x.color ?? accent }} />
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 22,
              fontWeight: 760,
              color: highlightId && !hi ? "rgba(245,242,234,0.7)" : palette.muted,
              marginTop: 6,
            }}
          >
            <span>{lowLabel}</span>
            <span>{x.note ? <EmphasisText text={x.note} /> : null}</span>
            <span>{highLabel}</span>
          </div>
        </LiquidGlass>
      );
    })}
  </div>
);
