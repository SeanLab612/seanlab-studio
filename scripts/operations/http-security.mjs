import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const studioSecureHeaders = Object.freeze({
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
});

export const studioPageContentSecurityPolicy =
  "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'";

const isInside = (root, target) => {
  const child = relative(root, target);
  return child === "" || (child !== ".." && !child.startsWith(`..${sep}`) && !child.startsWith(sep));
};

export const resolveStudioStaticFile = async (root, requestedPath) => {
  if (typeof requestedPath !== "string" || !requestedPath || requestedPath.includes("\0") || isAbsolute(requestedPath))
    throw new Error("Not found");
  try {
    const canonicalRoot = await realpath(resolve(root));
    const candidate = await realpath(resolve(canonicalRoot, requestedPath));
    if (!isInside(canonicalRoot, candidate)) throw new Error("Not found");
    return candidate;
  } catch {
    throw new Error("Not found");
  }
};
