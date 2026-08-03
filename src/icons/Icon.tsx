import type React from "react";
import { type IconId, iconRegistry, isIconId, type SystemIconId } from "./registry";
import { resolveFunctionalIconId } from "./resolve-functional-icon";

export type IconProps = {
  id?: IconId | string;
  size?: number;
  color?: string;
  variant?: "default" | "light" | "dark";
  fallbackLabel?: string;
  style?: React.CSSProperties;
};

const systemPaths: Record<SystemIconId, React.ReactNode> = {
  "system.gift": (
    <>
      <path d="M4 10h16v10H4z" />
      <path d="M2.8 7h18.4v3H2.8z" />
      <path d="M12 7v13" />
      <path d="M12 7H8.7A2.7 2.7 0 1 1 12 3.7V7Zm0 0h3.3A2.7 2.7 0 1 0 12 3.7V7Z" />
    </>
  ),
  "system.document": (
    <>
      <path d="M6 2.8h8l4 4V21H6z" />
      <path d="M14 2.8V7h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  "system.presentation": (
    <>
      <path d="M3 4h18v12H3z" />
      <path d="M12 16v5M8 21h8" />
      <path d="m8 12 3-3 2 2 3-3" />
    </>
  ),
  "system.design": (
    <>
      <path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 0-4H12" />
      <circle cx="7.5" cy="10" r="1" />
      <circle cx="10" cy="6.8" r="1" />
      <circle cx="14" cy="6.8" r="1" />
      <circle cx="17" cy="10" r="1" />
    </>
  ),
  "system.team": (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M14.3 15.2a4.4 4.4 0 0 1 6.2 4V20" />
    </>
  ),
  "system.trophy": (
    <>
      <path d="M8 3h8v4.5a4 4 0 0 1-8 0z" />
      <path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" />
    </>
  ),
  "system.chip": (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 9h6v6H9zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  "system.globe": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  "system.quote": (
    <>
      <path d="M5 6h6v6H7a4 4 0 0 0 4 4v2a6 6 0 0 1-6-6zM13 6h6v6h-4a4 4 0 0 0 4 4v2a6 6 0 0 1-6-6z" />
    </>
  ),
  "system.ranking": (
    <>
      <path d="M4 20V10h4v10zM10 20V4h4v16zM16 20v-7h4v7z" />
      <path d="M3 20h18" />
    </>
  ),
  "system.flow": (
    <>
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="5" cy="19" r="2" />
      <path d="M7 5h4a4 4 0 0 1 4 4v0a3 3 0 0 0 3 3M7 19h4a4 4 0 0 0 4-4v0a3 3 0 0 1 3-3" />
    </>
  ),
  "system.check": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.6 2.7L16.5 9" />
    </>
  ),
  "system.warning": (
    <>
      <path d="M12 3 2.8 20h18.4z" />
      <path d="M12 9v5M12 17.5v.1" />
    </>
  ),
  "system.clock": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  "system.calendar": (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>
  ),
  "system.link": (
    <>
      <path d="m9.5 14.5 5-5M8 17H6a4 4 0 0 1 0-8h3M16 7h2a4 4 0 0 1 0 8h-3" />
    </>
  ),
  "system.institution": (
    <>
      <path d="m3 9 9-6 9 6M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M3 21h18" />
    </>
  ),
  "system.currency": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5h-5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4h-5M12 6v12" />
    </>
  ),
  "system.percentage": (
    <>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="m18.5 5.5-13 13" />
    </>
  ),
  "system.line-chart": (
    <>
      <path d="M3 20h18M4 17l5-5 4 3 7-9" />
      <path d="M16 6h4v4" />
    </>
  ),
  "system.database": (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </>
  ),
  "system.laboratory": (
    <>
      <path d="M9 3h6M10 3v6l-5 10a2 2 0 0 0 1.8 2h10.4A2 2 0 0 0 19 19L14 9V3" />
      <path d="M7.5 16h9" />
    </>
  ),
  "system.security": (
    <>
      <path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  "system.person": (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21v-1.8a7.5 7.5 0 0 1 15 0V21" />
    </>
  ),
  "system.camera": (
    <>
      <path d="M4 7h3l1.5-2h7L17 7h3v12H4z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  "system.microphone": (
    <>
      <rect x="8" y="3" width="8" height="13" rx="4" />
      <path d="M5 12a7 7 0 0 0 14 0M12 19v3M8 22h8" />
    </>
  ),
  "system.video": (
    <>
      <rect x="3" y="5" width="13" height="14" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" />
    </>
  ),
  "system.image": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8" cy="9" r="2" />
      <path d="m5 18 5-5 3 3 2-2 4 4" />
    </>
  ),
  "system.animation": (
    <>
      <path d="M12 3a9 9 0 1 1-7.8 4.5" />
      <path d="M4 3v5h5M12 7v5l4 2" />
    </>
  ),
  "system.edit": (
    <>
      <path d="m4 20 4.5-1 10-10-3.5-3.5-10 10z" />
      <path d="m13.5 6.5 3.5 3.5M4 20h7" />
    </>
  ),
  "system.search": (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  "system.upload": (
    <>
      <path d="M12 16V4M7 9l5-5 5 5M4 15v5h16v-5" />
    </>
  ),
  "system.download": (
    <>
      <path d="M12 4v12M7 11l5 5 5-5M4 15v5h16v-5" />
    </>
  ),
  "system.settings": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
  "system.layers": (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
};

export const Icon: React.FC<IconProps> = ({
  id,
  size = 44,
  color = "currentColor",
  variant = "default",
  fallbackLabel,
  style,
}) => {
  const definition = id && isIconId(id) ? iconRegistry[id] : undefined;
  const resolvedSystemId =
    definition?.category === "system" ? definition.id : resolveFunctionalIconId(id, fallbackLabel);
  const resolvedColor =
    variant === "light" && color === "currentColor"
      ? "#111318"
      : variant === "dark" && color === "currentColor"
        ? "#F5F2EA"
        : color;

  if (definition?.category === "brand") {
    return (
      <div
        title={definition.label}
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
          borderRadius: Math.max(6, Math.round(size * 0.24)),
          background: definition.tileBackground,
          color: "#111318",
          border: "1px solid rgba(17,19,24,.12)",
          fontFamily: '"SF Pro Display", "PingFang SC", sans-serif',
          fontSize: Math.max(10, Math.round(size * 0.31)),
          fontWeight: 850,
          letterSpacing: "-.02em",
          flexShrink: 0,
          ...style,
        }}
      >
        {definition.shortLabel}
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={resolvedColor}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        ...style,
      }}
    >
      {systemPaths[resolvedSystemId]}
    </svg>
  );
};
