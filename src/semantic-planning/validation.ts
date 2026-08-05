export type SemanticVisualRelation = "process" | "comparison" | "checklist" | "annotation";

export type SemanticPlanValidationIssue = {
  kind: "semantic-density" | "mixed-visual-relations";
  segmentIndex: number;
  startCue: number;
  endCue: number;
  message: string;
  relations?: SemanticVisualRelation[];
};

export class SemanticPlanValidationError extends Error {
  readonly issue: SemanticPlanValidationIssue;

  constructor(issue: SemanticPlanValidationIssue) {
    super(issue.message);
    this.name = "SemanticPlanValidationError";
    this.issue = issue;
  }
}

const relationPatterns = [
  [
    "process",
    /(?:(?:步骤|阶段).{0,24}(?:依次|逐个|顺序|展开|出现)|(?:依次|逐个).{0,24}(?:步骤|阶段|展开|出现)|先.{1,30}(?:再|然后|最后))/,
  ],
  ["comparison", /(?:左右(?:两边)?|对比|两种做法|优缺点|(?:把|将|拿|和|与).{1,20}(?:比较|对照))/],
  ["checklist", /(?:检查项|逐项|清单|检查是否|检查是不是)/],
  ["annotation", /(?:划掉|高亮|圈出|下划线|标注)/],
] satisfies ReadonlyArray<readonly [SemanticVisualRelation, RegExp]>;

export const semanticVisualRelations = (text: string): SemanticVisualRelation[] =>
  relationPatterns.flatMap(([relation, pattern]) => (pattern.test(text) ? [relation] : []));

export const isSemanticPlanValidationError = (error: unknown): error is SemanticPlanValidationError =>
  error instanceof SemanticPlanValidationError;
