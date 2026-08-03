import type React from "react";
import { Img, staticFile } from "remotion";
import { resolveMediaAsset } from "./registry.ts";
import type { MediaEntityKind, MediaVariant } from "./types.ts";

export const IdentityMark: React.FC<{
  entityId: string;
  kind: MediaEntityKind;
  label?: string;
  size?: number;
  variant?: MediaVariant;
  allowCandidate?: boolean;
  color?: string;
}> = ({ entityId, kind, label, size = 48, variant = "square", allowCandidate = false, color = "#B8D8FF" }) => {
  const resolved = resolveMediaAsset({ entityId, kind, preferredVariant: variant }, { allowCandidate });
  if (resolved?.path) {
    if (resolved.kind !== "person") {
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "rgba(248,250,253,0.96)",
            boxShadow: "inset 0 0 0 1px rgba(10,20,34,0.12)",
          }}
        >
          <Img src={staticFile(resolved.path)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      );
    }
    return (
      <Img
        src={staticFile(resolved.path)}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: "50%" }}
      />
    );
  }
  const fallback = resolved?.fallback.value || label || entityId.split(".").at(-1)?.slice(0, 3).toUpperCase() || "?";
  return (
    <div
      role="img"
      aria-label={resolved?.label ?? label ?? entityId}
      style={{
        width: size,
        height: size,
        borderRadius: resolved?.kind === "person" || kind === "person" ? "50%" : 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 17, 28, 0.82)",
        border: `1px solid ${color}66`,
        color,
        fontSize: Math.max(11, size * 0.28),
        fontWeight: 850,
        letterSpacing: 0.4,
      }}
    >
      {fallback}
    </div>
  );
};
