import { staticFile } from "remotion";
import { typographyProfileRegistry } from "./registry.ts";

let loading: Promise<void> | undefined;

export const loadProductionTypographyFont = () => {
  if (loading) return loading;
  const profile = typographyProfileRegistry["wenkai-narrative"];
  loading = (async () => {
    const face = new FontFace(profile.family.replaceAll('"', "").split(",")[0], `url(${staticFile(profile.file)})`, {
      style: "normal",
      weight: String(profile.fontWeight),
    });
    document.fonts.add(await face.load());
  })();
  return loading;
};
