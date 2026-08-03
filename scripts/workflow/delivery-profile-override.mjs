import { normalizeDeliveryProfile } from "../creator/delivery-profile.mjs";

export const deliveryProfileOverrideFromOptions = ({ resolution, frameRate, until }) => {
  const hasResolution = resolution !== undefined;
  const hasFrameRate = frameRate !== undefined;
  if (!hasResolution && !hasFrameRate) return undefined;
  if (!hasResolution || !hasFrameRate)
    throw new Error("--delivery-resolution and --delivery-frame-rate must be provided together");
  if (until !== "delivery") throw new Error("Delivery profile overrides require --until delivery");
  const normalized = normalizeDeliveryProfile({
    resolution,
    frameRate: frameRate === "source" ? "source" : Number(frameRate),
  });
  return { ...normalized, mode: "selectable-profile", crf: 18 };
};

export const contextWithDeliveryProfileOverride = (context, override) =>
  override
    ? {
        ...context,
        manifest: {
          ...context.manifest,
          render: {
            ...context.manifest.render,
            delivery: { ...context.manifest.render.delivery, ...override },
          },
        },
      }
    : context;
