import assert from "node:assert/strict";
import test from "node:test";
import { chooseLocalFiles, parseChosenFilePaths } from "../scripts/operations/local-file-picker.mjs";

test("local file picker preserves Finder paths and supports multiple selections", async () => {
  assert.deepEqual(parseChosenFilePaths("/tmp/one image.png\n/tmp/two.mov\n"), [
    "/tmp/one image.png",
    "/tmp/two.mov",
  ]);
  let invocation;
  const paths = await chooseLocalFiles(
    { multiple: true, prompt: "选择测试素材" },
    {
      execute: async (command, args) => {
        invocation = { command, args };
        return { stdout: "/tmp/one.png\n/tmp/two.png\n" };
      },
    },
  );
  assert.deepEqual(paths, ["/tmp/one.png", "/tmp/two.png"]);
  assert.equal(invocation.command, "osascript");
  assert.match(invocation.args.join("\n"), /multiple selections allowed/);
});

test("cancelling the Finder picker returns an empty selection", async () => {
  const paths = await chooseLocalFiles(
    {},
    {
      execute: async () => {
        const error = new Error("User canceled. (-128)");
        error.code = 1;
        throw error;
      },
    },
  );
  assert.deepEqual(paths, []);
});
