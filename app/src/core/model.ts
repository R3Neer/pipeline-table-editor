export const stageRoots = ["IF", "ID", "EX", "MEM", "WB"] as const;

export type StageRoot = (typeof stageRoots)[number];

export interface CellData {
  text: string;
  struck: boolean;
}

export interface InstructionRow {
  instruction: string;
  cells: CellData[];
}

export interface CellPosition {
  row: number;
  cycle: number;
}

export interface PipelineArrow {
  from: CellPosition;
  to: CellPosition;
  label: string;
}

export interface AppState {
  title: string;
  cycles: number;
  rows: InstructionRow[];
  arrows: PipelineArrow[];
}

export interface CopiedCell {
  text: string;
  struck: boolean;
}

export interface ArrowDraft {
  from: CellPosition | null;
}

export interface ExpandDraft {
  from: CellPosition | null;
}

export type ExportFormat = "json" | "markdown" | "text" | "png";

export type ContextAction =
  | "arrow"
  | "remove-arrows"
  | "strike"
  | "expand"
  | "copy"
  | "cut"
  | "paste"
  | "clear";

export interface AppElements {
  layoutRoot: HTMLElement;
  collapseSidebarBtn: HTMLButtonElement;
  expandSidebarBtn: HTMLButtonElement;
  titleInput: HTMLInputElement;
  cyclesInput: HTMLInputElement;
  instructionsInput: HTMLTextAreaElement;
  exportMenuBtn: HTMLButtonElement;
  exportMenu: HTMLElement;
  copyExportBtn: HTMLButtonElement;
  importInput: HTMLTextAreaElement;
  importBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
  saveStatus: HTMLElement;
  tableShell: HTMLElement;
  instructionMount: HTMLElement;
  cycleViewport: HTMLElement;
  tableMount: HTMLElement;
  arrowLayer: SVGSVGElement;
  exportModal: HTMLElement;
  exportOutput: HTMLTextAreaElement;
  closeExportBtn: HTMLButtonElement;
  cellMenu: HTMLElement;
  autocompleteMenu: HTMLElement;
}
