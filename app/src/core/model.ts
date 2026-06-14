export const stageRoots = ["IF", "ID", "EX", "MEM", "WB"] as const;

export type StageRoot = (typeof stageRoots)[number];

export interface CellData {
  text: string;
  struck: boolean;
}

export interface InstructionRow {
  instruction: string;
  cells: CellData[];
  label?: string;
  separatorBefore?: boolean;
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
