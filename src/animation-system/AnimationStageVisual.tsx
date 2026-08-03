import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { Icon } from "../icons";
import { resolveFunctionalIconId } from "../icons/resolve-functional-icon.ts";
import type { AnimationStageIntent } from "../visual-production/types.ts";

export const AnimationStageVisual = ({
  stage,
  size,
  color,
  style,
}: {
  stage: AnimationStageIntent;
  size: number;
  color: string;
  style?: CSSProperties;
}) => {
  if (stage.imageAssetSrc)
    return (
      <Img
        src={staticFile(stage.imageAssetSrc)}
        alt={stage.imageAssetLabel ?? stage.label}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          filter: "drop-shadow(0 12px 10px rgba(0,0,0,.2))",
          ...style,
        }}
      />
    );
  const iconId =
    stage.iconId ?? resolveFunctionalIconId(undefined, `${stage.label} ${stage.action} ${stage.spokenQuote}`);
  return <Icon id={iconId} size={size} color={color} />;
};
