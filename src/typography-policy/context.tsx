import type React from "react";
import { createContext, useContext, useEffect, useMemo } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { loadProductionTypographyFont } from "./font-loader.ts";
import { resolveTypography } from "./selector.ts";
import type { TypographyMode, TypographySelectionInput } from "./types.ts";

const TypographyModeContext = createContext<TypographyMode>("system-only");

export const TypographyPolicyProvider: React.FC<{
  mode: TypographyMode;
  children: React.ReactNode;
}> = ({ mode, children }) => {
  const handle = useMemo(
    () => (mode === "system-only" ? undefined : delayRender("Loading frozen WenKai production font")),
    [mode],
  );
  useEffect(() => {
    if (handle === undefined) return;
    loadProductionTypographyFont()
      .then(() => continueRender(handle))
      .catch((error) => cancelRender(error));
  }, [handle]);
  return <TypographyModeContext.Provider value={mode}>{children}</TypographyModeContext.Provider>;
};

export const useTypographyDecision = (input: Omit<TypographySelectionInput, "mode">) => {
  const mode = useContext(TypographyModeContext);
  return resolveTypography({ ...input, mode });
};
