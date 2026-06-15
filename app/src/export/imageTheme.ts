import type { StageRoot } from "../core/model";

export interface StageStyle {
  background: string;
  border: string;
  color: string;
}

const stageStyles: Record<StageRoot, StageStyle> = {
  IF: { background: "#dff7c7", border: "#8bc36f", color: "#263241" },
  ID: { background: "#d9eefc", border: "#72aee6", color: "#263241" },
  EX: { background: "#ffe8a8", border: "#d6a534", color: "#263241" },
  MEM: { background: "#dfdcff", border: "#9488df", color: "#263241" },
  WB: { background: "#c9f3ec", border: "#48b7a6", color: "#263241" }
};

export function getStageStyle(root: StageRoot | null, invalid: boolean, pending: boolean, struck: boolean): StageStyle {
  if (invalid) return { background: "#ffe4e8", border: "#e11d48", color: "#8f1235" };
  const base = root ? stageStyles[root] : { background: "#f1f5f9", border: "#d7dee8", color: "#263241" };
  if (pending || struck) {
    return {
      background: mixColor(base.background, "#cfd6df", pending ? 0.72 : 0.82),
      border: mixColor(base.border, "#7d8998", pending ? 0.74 : 0.82),
      color: struck ? "#485463" : "#3f4b5a"
    };
  }
  return base;
}

export function getAssemblyTokenColor(kind: "instruction" | "register" | "plain" | "annotation"): string {
  if (kind === "instruction") return "#7c3aed";
  if (kind === "register") return "#b7791f";
  return "#111827";
}

function mixColor(first: string, second: string, secondWeight: number): string {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const firstWeight = 1 - secondWeight;
  return `rgb(${Math.round(a.r * firstWeight + b.r * secondWeight)}, ${Math.round(
    a.g * firstWeight + b.g * secondWeight
  )}, ${Math.round(a.b * firstWeight + b.b * secondWeight)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}
