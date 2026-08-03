import React from "react";
import { Icon, type IconId } from "../../icons";
import { LiquidGlass } from "../LiquidGlass";
import { enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";
import { resolveProgressiveEmphasis } from "./progressive-emphasis";

export type CausalChainNode = {
  id: string;
  label: string;
  detail?: string;
  iconId?: IconId | string;
  tone?: "positive" | "negative" | "neutral";
  accent?: string;
};

export type CausalChainProps = {
  frame: number;
  fps: number;
  nodes: CausalChainNode[];
  activeIndex: number;
  activeProgress?: number;
  takeaway?: string;
};

const toneColor = (tone: CausalChainNode["tone"]) =>
  tone === "positive" ? palette.mint : tone === "negative" ? palette.red : palette.blue;

export const CausalChain: React.FC<CausalChainProps> = ({
  frame,
  fps,
  nodes,
  activeIndex,
  activeProgress = 1,
  takeaway,
}) => {
  if (nodes.length < 3 || nodes.length > 5) throw new Error(`CausalChain expects 3-5 nodes, received ${nodes.length}.`);
  const current = Math.max(0, Math.min(nodes.length - 1, activeIndex));
  const gap = nodes.length === 5 ? 18 : 24;
  const cardWidth = Math.floor((740 - gap * (nodes.length - 1)) / nodes.length);
  const intro = enter(frame, fps, 7);

  return (
    <div style={{ position: "absolute", left: 70, top: 260, width: 740, ...rise(intro) }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap }}>
        {nodes.map((node, index) => {
          const progress = enter(frame, fps, 14 + index * 10);
          const emphasis = resolveProgressiveEmphasis({ index, activeIndex: current, activeProgress });
          const active = emphasis.state === "active";
          const accent = node.accent ?? toneColor(node.tone);
          return (
            <React.Fragment key={node.id}>
              {index > 0 ? (
                <div
                  style={{
                    position: "absolute",
                    left: index * cardWidth + (index - 1) * gap + 2,
                    top: 83,
                    width: Math.max(8, gap - 4),
                    height: 4,
                    borderRadius: 99,
                    background: index <= current ? accent : "rgba(255,255,255,0.16)",
                    opacity: enter(frame, fps, 24 + index * 10),
                    boxShadow: index <= current ? `0 0 14px ${accent}77` : "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      right: -2,
                      top: -5,
                      width: 0,
                      height: 0,
                      borderTop: "7px solid transparent",
                      borderBottom: "7px solid transparent",
                      borderLeft: `9px solid ${index <= current ? accent : "rgba(255,255,255,0.22)"}`,
                    }}
                  />
                </div>
              ) : null}
              <div
                style={{
                  width: cardWidth,
                  ...rise(progress, 15),
                  opacity: emphasis.opacity * progress,
                  filter: `brightness(${emphasis.brightness}) saturate(${emphasis.saturation})`,
                  transform: `scale(${emphasis.scale})`,
                }}
              >
                <LiquidGlass
                  surface="bare"
                  accent={`${accent}${active ? "55" : "24"}`}
                  padding="16px 12px"
                  radius={21}
                  style={{
                    height: 170,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <Icon id={node.iconId} fallbackLabel={node.label} size={50} color={accent} variant="dark" />
                    <div
                      style={{
                        fontSize: nodes.length === 5 ? 24 : 26,
                        lineHeight: 1.18,
                        fontWeight: 870,
                        marginTop: 12,
                      }}
                    >
                      <EmphasisText text={node.label} />
                    </div>
                    {node.detail ? (
                      <div
                        style={{
                          fontSize: 22,
                          lineHeight: 1.3,
                          fontWeight: 620,
                          opacity: 0.76,
                          marginTop: 8,
                        }}
                      >
                        <EmphasisText text={node.detail} />
                      </div>
                    ) : null}
                  </div>
                </LiquidGlass>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {takeaway ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 28, ...rise(enter(frame, fps, 64), 10) }}>
          <LiquidGlass surface="bare" accent={`${palette.amber}3F`} padding="12px 20px" radius={18}>
            <div
              style={{
                maxWidth: 600,
                fontSize: 32,
                lineHeight: 1.25,
                fontWeight: 800,
                textAlign: "center",
                whiteSpace: "normal",
              }}
            >
              <EmphasisText text={takeaway} />
            </div>
          </LiquidGlass>
        </div>
      ) : null}
    </div>
  );
};
