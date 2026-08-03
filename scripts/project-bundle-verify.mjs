import { verifyPortableBundle } from "./operations/portable-bundle.mjs";

const args = process.argv.slice(2);
const bundleIndex = args.indexOf("--bundle");
const bundle = bundleIndex >= 0 ? args[bundleIndex + 1] : args[0];
if (!bundle) throw new Error("Usage: npm run project:bundle:verify -- --bundle <bundle-directory>");
const report = await verifyPortableBundle(bundle);
console.log(JSON.stringify(report));
if (report.status !== "passed") process.exitCode = 2;
