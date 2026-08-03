export type PromotionReport = {
  reportSha256: string;
  summary: { errors: number; warnings: number };
};

export const assertFixturePromotionAllowed = (
  report: PromotionReport,
  approvedSha: string | undefined,
  approvedBy: string | undefined,
) => {
  if (!approvedSha || !approvedBy?.trim()) throw new Error("Explicit report SHA and reviewer are required.");
  if (report.reportSha256 !== approvedSha) throw new Error("Approval SHA does not match the current fixture report.");
  if (report.summary.errors || report.summary.warnings)
    throw new Error("Cannot promote a fixture report with findings.");
  return true;
};
