import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const configPath = resolve(process.argv[2]);
const config = JSON.parse(await readFile(configPath, "utf8"));
const videoUseHome = resolve(process.env.VIDEO_USE_HOME ?? `${homedir()}/Developer/video-use`);
const helper = resolve(videoUseHome, "helpers/transcribe.py");
await access(helper);
const args = [helper, config.source, "--edit-dir", config.editDir];
if (config.transcription?.language) args.push("--language", config.transcription.language);
if (config.transcription?.numSpeakers) args.push("--num-speakers", String(config.transcription.numSpeakers));
execFileSync("python3", args, { stdio: "inherit" });
