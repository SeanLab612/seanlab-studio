import type { GeneratedVisualBrief } from "../visual-brief/types.ts";

const objectArray = (value: unknown, label: string) => {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item)))
    throw new Error(`${label} must be an array of objects`);
  return value as Array<Record<string, unknown>>;
};

const nonEmpty = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
};

const finite = (value: unknown, label: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
};

const boundedText = (value: unknown, label: string, maximum: number) => {
  nonEmpty(value, label);
  if (String(value).length > maximum) throw new Error(`${label} must be at most ${maximum} characters`);
};

const validateIdentityItems = (items: Array<Record<string, unknown>>, label: string) => {
  for (const [index, item] of items.entries()) {
    nonEmpty(item.entityId, `${label}[${index}].entityId`);
    nonEmpty(item.entityKind, `${label}[${index}].entityKind`);
  }
};

export const validateMaterializedBriefContent = (brief: GeneratedVisualBrief) => {
  nonEmpty(brief.narrative.title, "narrative.title");
  if (brief.narrative.title.length > 18 || brief.narrative.title.includes("…"))
    throw new Error("narrative.title must be complete and no longer than 18 characters");
  const props = brief.props;
  switch (brief.component.id) {
    case "distribution-bars":
      for (const [index, item] of objectArray(props.bars, "bars").entries()) {
        nonEmpty(item.label, `bars[${index}].label`);
        finite(item.value, `bars[${index}].value`);
      }
      break;
    case "scenario-branches": {
      const branches = objectArray(props.branches, "branches");
      if (branches.length !== 2) throw new Error("scenario branches must contain exactly two outcomes");
      for (const [index, item] of branches.entries()) {
        boundedText(item.label, `branches[${index}].label`, 18);
        boundedText(item.detail, `branches[${index}].detail`, 36);
      }
      break;
    }
    case "market-cap-lines":
      for (const [index, item] of objectArray(props.series, "series").entries()) {
        nonEmpty(item.name, `series[${index}].name`);
        if (!Array.isArray(item.points) || item.points.length < 2)
          throw new Error(`series[${index}].points requires at least two values`);
        item.points.forEach((value, point) => {
          finite(value, `series[${index}].points[${point}]`);
        });
      }
      break;
    case "person-evidence-card":
      nonEmpty(props.name, "person.name");
      nonEmpty(props.role, "person.role");
      if (!brief.analysis.mediaIntents?.some((item) => item.kind === "person"))
        throw new Error("person evidence must resolve a named person identity");
      break;
    case "media-comparison": {
      const items = objectArray(props.items, "media items");
      validateIdentityItems(items, "media items");
      items.forEach((item, index) => {
        boundedText(item.caption, `media items[${index}].caption`, 36);
      });
      break;
    }
    case "image-evidence-inset":
      nonEmpty(props.assetId, "image evidence assetId");
      nonEmpty(props.imageSrc, "image evidence imageSrc");
      if (String(props.imageSrc).startsWith("http")) throw new Error("image evidence must use a frozen local source");
      break;
    case "capability-surface-grid": {
      if (!Array.isArray(props.rows) || !Array.isArray(props.columns))
        throw new Error("capability surface requires rows and columns");
      const columnCount = props.columns.length;
      const numeric =
        Array.isArray(props.values) &&
        props.values.length === props.rows.length &&
        !props.values.some(
          (row) => !Array.isArray(row) || row.length !== columnCount || row.some((value) => !Number.isFinite(value)),
        );
      const qualitative =
        Array.isArray(props.states) &&
        props.states.length === props.rows.length &&
        !props.states.some(
          (row) =>
            !Array.isArray(row) ||
            row.length !== columnCount ||
            row.some((value) => typeof value !== "string" || !value.trim()),
        );
      if (!numeric && !qualitative)
        throw new Error("capability surface numeric values or qualitative states must fill every row and column");
      break;
    }
    case "tradeoff-scale":
      objectArray(props.items, "tradeoff items").forEach((item, index) => {
        nonEmpty(item.label, `tradeoff items[${index}].label`);
        if (props.mode === "directional") {
          nonEmpty(item.valueLabel, `tradeoff items[${index}].valueLabel`);
          if (!["up", "down", "stable"].includes(String(item.direction)))
            throw new Error(`tradeoff items[${index}].direction must be up, down, or stable`);
        } else finite(item.value, `tradeoff items[${index}].value`);
      });
      break;
    case "rough-annotation":
      objectArray(props.items, "rough annotation items").forEach((item, index) => {
        boundedText(item.text, `rough annotation items[${index}].text`, 14);
        nonEmpty(item.effect, `rough annotation items[${index}].effect`);
      });
      break;
    case "editorial-statement":
      boundedText(props.emphasis, "editorial statement emphasis", 18);
      if (props.leadIn) boundedText(props.leadIn, "editorial statement leadIn", 12);
      if (props.denied) boundedText(props.denied, "editorial statement denied", 18);
      if (props.prefix) boundedText(props.prefix, "editorial statement prefix", 8);
      if (props.support) boundedText(props.support, "editorial statement support", 30);
      break;
    default: {
      const collection = Array.isArray(props.items)
        ? objectArray(props.items, "items")
        : Array.isArray(props.nodes)
          ? objectArray(props.nodes, "nodes")
          : [];
      for (const [index, item] of collection.entries())
        boundedText(item.label ?? item.title, `${brief.component.id} item ${index + 1}`, 24);
    }
  }
  return true;
};
