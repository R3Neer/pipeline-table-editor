const labelPalette = [
  "#5b6c8f",
  "#7a668f",
  "#4f7b7a",
  "#8a6f4d",
  "#6f7f55",
  "#6d7586",
  "#8a5f6a",
  "#55748a"
];

export function normalizeRowLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function getLabelColor(label: string): string {
  const normalized = normalizeRowLabel(label).toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return labelPalette[hash % labelPalette.length];
}

export function getKnownLabels(labels: Array<string | undefined>): string[] {
  return [...new Set(labels.map((label) => normalizeRowLabel(label || "")).filter(Boolean))];
}
