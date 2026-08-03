import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const positiveInteger = (value, label, { minimum = 1, maximum = Number.MAX_SAFE_INTEGER } = {}) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer`);
  if (value < minimum || value > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  return value;
};

export const validateLocalProductPolicy = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Local product policy must be an object");
  if (value.schemaVersion !== "1.0") throw new Error("Unsupported local product policy schema");
  return {
    schemaVersion: "1.0",
    maxConcurrentJobs: positiveInteger(value.maxConcurrentJobs, "maxConcurrentJobs", { maximum: 4 }),
    maxQueuedJobs: positiveInteger(value.maxQueuedJobs, "maxQueuedJobs", { maximum: 100 }),
    minimumFreeBytes: positiveInteger(value.minimumFreeBytes, "minimumFreeBytes", { minimum: 1024 ** 3 }),
    projectQuotaBytes: positiveInteger(value.projectQuotaBytes, "projectQuotaBytes", { minimum: 1024 ** 3 }),
    backupRetention: positiveInteger(value.backupRetention, "backupRetention", { maximum: 20 }),
  };
};

export const loadLocalProductPolicy = async (
  path = process.env.REMOTION_MD_LOCAL_PRODUCT_POLICY ?? resolve("config/local-product-policy.json"),
) => validateLocalProductPolicy(JSON.parse(await readFile(resolve(path), "utf8")));
