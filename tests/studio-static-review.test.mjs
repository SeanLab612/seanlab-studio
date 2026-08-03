import assert from "node:assert/strict";
import test from "node:test";
import { staticReviewApprovalArgs } from "../scripts/creator/studio-static-review.mjs";

test("clean static review approval never creates a QA waiver", () => {
  assert.deepEqual(
    staticReviewApprovalArgs({ blockingFindingIds: [], selectedFindingIds: [], waiverReason: "" }),
    ["--approve"],
  );
});

test("conditional approval names every current blocking finding and records a reason", () => {
  assert.deepEqual(
    staticReviewApprovalArgs({
      blockingFindingIds: ["qa-crop-2", "qa-face-1"],
      selectedFindingIds: ["qa-face-1", "qa-crop-2", "qa-face-1"],
      waiverReason: "素材本身包含安全边缘，人物和字幕仍然完整",
    }),
    ["--approve", "--waive-qa", "qa-crop-2, qa-face-1：素材本身包含安全边缘，人物和字幕仍然完整"],
  );
});

test("conditional approval fails closed for partial findings or an empty reason", () => {
  assert.throws(
    () =>
      staticReviewApprovalArgs({
        blockingFindingIds: ["qa-crop-2", "qa-face-1"],
        selectedFindingIds: ["qa-face-1"],
        waiverReason: "接受",
      }),
    /逐项选择/,
  );
  assert.throws(
    () =>
      staticReviewApprovalArgs({
        blockingFindingIds: ["qa-face-1"],
        selectedFindingIds: ["qa-face-1"],
        waiverReason: "  ",
      }),
    /具体原因/,
  );
});
