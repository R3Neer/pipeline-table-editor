import assert from "node:assert/strict";
import { createArrowAndExpansionController } from "../src/app/modes/arrowAndExpansionController";
import { createSelectionController } from "../src/app/selection/selectionController";
import { getAutocompleteSuggestions, type SuggestionProvider } from "../src/core/autocomplete";
import type { AppState, CellPosition } from "../src/core/model";
import { createCellValidator, validateCellText, type CellValidationRule } from "../src/core/validation";
import {
  applyInstructionText,
  changeCycleCount,
  pruneArrowsFromStruckCells,
  removeOutgoingArrows,
  wouldLoseCellsAfterCycleReduction
} from "../src/core/useCases/tableEditing";
import { exportJson } from "../src/export/index";
import { createTextExportFile } from "../src/export/service";
import { loadStateFromStorage, saveStateToStorage } from "../src/integration/storage";
import { getCellClassName } from "../src/ui/cellClasses";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function makeState(rows: string[][]): AppState {
  const cycles = Math.max(1, ...rows.map((row) => row.length));
  return {
    title: "Integration test",
    cycles,
    rows: rows.map((row, rowIndex) => ({
      instruction: `row ${rowIndex + 1}`,
      cells: Array.from({ length: cycles }, (_, cycle) => ({ text: row[cycle] || "", struck: false }))
    })),
    arrows: []
  };
}

{
  const selection = createSelectionController();
  selection.setSingleSelection({ row: 0, cycle: 0 });
  selection.updateSelectionFromClick({ row: 1, cycle: 1 }, { shiftKey: true, altKey: false, ctrlKey: false, metaKey: false });
  assert.deepEqual(
    selection.getSelectedPositions(makeState([["IF", ""], ["", "ID"]])).sort((a, b) => a.row - b.row || a.cycle - b.cycle),
    [
      { row: 0, cycle: 0 },
      { row: 0, cycle: 1 },
      { row: 1, cycle: 0 },
      { row: 1, cycle: 1 }
    ]
  );
  selection.setSingleRowSelection(1);
  selection.updateRowSelectionFromClick(2, { shiftKey: true, altKey: false, ctrlKey: false, metaKey: false });
  assert.deepEqual(selection.getRowActionTargets(1), [1, 2]);
}

{
  const state = makeState([["IF", "ID", ""], ["", "ID", "EX"]]);
  let rendered = 0;
  let saved = 0;
  const inputs = new Map<string, { value: string }>();
  const controller = createArrowAndExpansionController(
    {
      elements: {} as never,
      getState: () => state,
      render: () => {
        rendered += 1;
      },
      scheduleSave: () => {
        saved += 1;
      },
      showStatus: () => undefined,
      showConfirm: async () => true
    },
    {
      getCellElement: (pos) => inputs.get(`${pos.row}:${pos.cycle}`) as HTMLInputElement | null,
      hideAutocomplete: () => undefined,
      refreshCellClasses: () => undefined,
      renderSelectionInfo: () => undefined
    }
  );

  controller.startArrow({ row: 0, cycle: 0 });
  controller.tryCreateArrowTo({ row: 1, cycle: 1 });
  assert.deepEqual(state.arrows, [{ from: { row: 0, cycle: 0 }, to: { row: 1, cycle: 1 }, label: "" }]);
  assert.equal(rendered, 1);
  assert.equal(saved, 1);

  inputs.set("0:2", { value: "" });
  controller.startExpand({ row: 0, cycle: 0 });
  await controller.tryExpandTo({ row: 0, cycle: 2 });
  assert.equal(state.rows[0].cells[2].text, "IF3");
  assert.equal(inputs.get("0:2")?.value, "IF3");
}

{
  const noWbRule: CellValidationRule = {
    id: "no-wb-in-this-mode",
    isValid: ({ value }) => value !== "WB"
  };
  const state = makeState([["IF", "ID", "EX", "MEM", "WB"]]);
  const result = validateCellText("WB", state, { row: 0, cycle: 4 }, [noWbRule]);
  assert.equal(result.valid, false);
  assert.equal(result.failedRule, "no-wb-in-this-mode");
  assert.equal(createCellValidator([noWbRule]).isValid("WB", state, { row: 0, cycle: 4 }), false);
}

{
  const customProvider: SuggestionProvider = (_context, add) => {
    add("IF7", -20);
  };
  const stopProvider: SuggestionProvider = (_context, add) => {
    add("MEM9", -30);
    return "stop";
  };
  const state = makeState([["", ""]]);
  assert.deepEqual(getAutocompleteSuggestions(state, { row: 0, cycle: 0 }, "", [customProvider]), ["IF7"]);
  assert.deepEqual(getAutocompleteSuggestions(state, { row: 0, cycle: 0 }, "", [stopProvider, customProvider]), ["MEM9"]);
}

{
  const state = makeState([["IF", "ID", "EX"], ["", "ID", ""]]);
  state.rows[0].cells[2].struck = true;
  const selected = new Set(["0:2", "1:1"]);
  assert.match(
    getCellClassName(state, { row: 0, cycle: 2 }, {
      selectedCell: { row: 0, cycle: 2 },
      selectedCellKeys: selected,
      arrowFrom: { row: 0, cycle: 0 },
      arrowHoverTarget: { row: 1, cycle: 1 },
      expandFrom: { row: 0, cycle: 2 }
    }),
    /stage-ex.*stage-struck.*selected.*multi-selected.*expand-from/
  );
  assert.match(
    getCellClassName(state, { row: 1, cycle: 1 }, {
      selectedCell: null,
      selectedCellKeys: selected,
      arrowFrom: { row: 0, cycle: 0 },
      arrowHoverTarget: { row: 1, cycle: 1 },
      expandFrom: null
    }),
    /arrow-target-valid/
  );
}

{
  const storage = new MemoryStorage();
  const state = makeState([["IF", ""], ["", "ID"]]);
  state.arrows.push({ from: { row: 0, cycle: 0 }, to: { row: 1, cycle: 1 }, label: "" });
  saveStateToStorage(state, storage);
  const loaded = loadStateFromStorage(storage);
  assert.deepEqual(loaded, state);
  assert.equal(exportJson(loaded as AppState), JSON.stringify(state, null, 2));
  assert.equal(createTextExportFile(state, "json").extension, "json");
  assert.equal(createTextExportFile(state, "markdown").extension, "md");
  assert.match(createTextExportFile(state, "text").mimeType, /text\/plain/);
}

{
  const state = makeState([["IF", "ID", "EX"], ["IF", "", ""]]);
  state.rows[0].label = "loop";
  state.rows[0].separatorBefore = true;
  state.arrows.push({ from: { row: 0, cycle: 0 }, to: { row: 1, cycle: 0 }, label: "" });
  applyInstructionText(state, "renamed\nnew");
  assert.equal(state.rows[0].instruction, "renamed");
  assert.equal(state.rows[0].label, "loop");
  assert.equal(state.rows[0].separatorBefore, true);
  assert.equal(state.rows[1].instruction, "new");
  assert.equal(state.arrows.length, 1);
  assert.equal(wouldLoseCellsAfterCycleReduction(state, 1), true);
  changeCycleCount(state, 1);
  assert.equal(state.cycles, 1);
  assert.equal(state.rows[0].cells.length, 1);
  assert.equal(state.arrows.length, 1);
  assert.equal(removeOutgoingArrows(state, { row: 0, cycle: 0 }), true);
  assert.equal(state.arrows.length, 0);
  state.arrows.push({ from: { row: 0, cycle: 0 }, to: { row: 1, cycle: 0 }, label: "" });
  state.rows[0].cells[0].struck = true;
  assert.equal(pruneArrowsFromStruckCells(state), true);
  assert.equal(state.arrows.length, 0);
}

console.log("Integration unit tests passed");
