import assert from "node:assert/strict";
import { getAutocompleteSuggestions } from "../src/core/autocomplete";
import { isValidArrowTarget } from "../src/core/arrows";
import { canStartExpand, makeExpansionValues, wouldChangeFilledCells } from "../src/core/expansion";
import type { AppState } from "../src/core/model";
import { normalizeState } from "../src/core/state";
import { normalizeCellText, parseStageText, validCellPattern } from "../src/core/stage";
import { isCellTextValid } from "../src/core/validation";
import { exportJson } from "../src/export/index";

function makeState(rows: string[][]): AppState {
  const cycles = Math.max(1, ...rows.map((row) => row.length));
  return {
    title: "Unit test",
    cycles,
    rows: rows.map((row, rowIndex) => ({
      instruction: `row ${rowIndex + 1}`,
      cells: Array.from({ length: cycles }, (_, cycle) => ({ text: row[cycle] || "", struck: false }))
    })),
    arrows: []
  };
}

function assertCellValidity(state: AppState, row: number, cycle: number, expected: boolean): void {
  assert.equal(isCellTextValid(state.rows[row].cells[cycle].text, state, { row, cycle }), expected);
}

function assertIncludesOnlyPending(values: string[]): void {
  assert.ok(values.length > 0);
  assert.ok(values.every((value) => value.endsWith("p")));
}

assert.equal(normalizeCellText(" if2P "), "IF2p");
assert.equal(normalizeCellText("EXp1"), "EXp1");
assert.deepEqual(parseStageText("MEM12p"), { root: "MEM", number: 12, pending: true });
assert.equal(validCellPattern.test("RAIZ1"), false);
assert.equal(validCellPattern.test("IF0"), false);
assert.equal(validCellPattern.test("IDp"), true);

{
  const state = makeState([["IF", "IDp", "", "EX"]]);
  assertCellValidity(state, 0, 1, true);
  state.rows[0].cells[2].text = "EX";
  assertCellValidity(state, 0, 1, false);
  state.rows[0].cells[2].text = "IDp";
  state.rows[0].cells[3].text = "ID";
  assertCellValidity(state, 0, 1, true);
  assertCellValidity(state, 0, 2, true);
}

{
  const state = makeState([["IF", "MEM", "EX", "MEM", "WB"]]);
  assertCellValidity(state, 0, 1, false);
  assertCellValidity(state, 0, 2, false);
  assertCellValidity(state, 0, 3, false);
  assertCellValidity(state, 0, 4, false);
}

{
  const state = makeState([["IF1p", "IF1p", "IF1"]]);
  assertCellValidity(state, 0, 0, true);
  assertCellValidity(state, 0, 1, true);
  assertCellValidity(state, 0, 2, true);
}

{
  const state = makeState([
    ["IFp", "IF"],
    ["IF", ""],
    ["", ""]
  ]);
  assertCellValidity(state, 1, 0, false);
  state.rows[1].cells[0].text = "IFp";
  state.rows[1].cells[1].text = "IF";
  assertCellValidity(state, 1, 0, true);
  state.rows[2].cells[0].text = "IF";
  assertCellValidity(state, 2, 0, false);
}

{
  const state = makeState([["IF1", "IF2p", "IF2p", ""], ["", "IF1", "IF2p", ""]]);
  const suggestions = getAutocompleteSuggestions(state, { row: 1, cycle: 2 }, "IF2p");
  assert.equal(suggestions[0], "IF2p");
  assert.equal(suggestions.includes("IFp"), false);
  assert.equal(suggestions.includes("ID"), false);
}

{
  const state = makeState([["IF1", "IF2p", "IF2p", ""], ["", "", "", ""]]);
  const suggestions = getAutocompleteSuggestions(state, { row: 1, cycle: 2 }, "");
  assertIncludesOnlyPending(suggestions);
  assert.equal(suggestions.includes("ID"), false);
}

{
  const state = makeState([["IF1", "", ""]]);
  const suggestions = getAutocompleteSuggestions(state, { row: 0, cycle: 1 }, "");
  assert.equal(suggestions[0], "IF2");
}

{
  const state = makeState([["IF", "ID", ""]]);
  const suggestions = getAutocompleteSuggestions(state, { row: 0, cycle: 1 }, "ID");
  assert.equal(suggestions[0], "ID");
}

{
  const state = makeState([["IF1", "IF2", ""]]);
  const suggestions = getAutocompleteSuggestions(state, { row: 0, cycle: 1 }, "IF2");
  assert.equal(suggestions[0], "IF2");
}

{
  const state = makeState([["IF1", "IF2", ""]]);
  const suggestions = getAutocompleteSuggestions(state, { row: 0, cycle: 1 }, "IFp");
  assert.notEqual(suggestions[0], "IFp");
}

{
  const state = makeState([
    ["IF", "ID", "EX", "MEM2", ""],
    ["IF", "ID", "EX", "MEM2", ""],
    ["IF", "ID", "EX", "", ""]
  ]);
  const suggestions = getAutocompleteSuggestions(state, { row: 2, cycle: 3 }, "MEM");
  assert.equal(suggestions.includes("MEM2"), false);
  assert.equal(suggestions[0], "MEM");
}

{
  const state = makeState([
    ["IF", "ID", "EX", "MEM1", "MEM2", "WB"],
    ["IF", "ID", "EX", "MEM1", "MEM2", "WB"],
    ["IF", "ID", "EX", "MEM1", "MEM2", ""]
  ]);
  const suggestions = getAutocompleteSuggestions(state, { row: 2, cycle: 5 }, "");
  assert.equal(suggestions[0], "WB");
  assert.ok(suggestions.indexOf("MEM3") === -1 || suggestions.indexOf("WB") < suggestions.indexOf("MEM3"));
}

{
  const state = makeState([["EX", "", ""], ["IDp", "IDp", "ID"]]);
  assert.equal(canStartExpand(state, { row: 0, cycle: 0 }), true);
  assert.deepEqual(makeExpansionValues(state, { row: 0, cycle: 0 }, { row: 0, cycle: 2 }), ["EX1", "EX2", "EX3"]);
  assert.deepEqual(makeExpansionValues(state, { row: 1, cycle: 0 }, { row: 1, cycle: 2 }), ["IDp", "IDp", "IDp"]);
  assert.equal(wouldChangeFilledCells(state, { row: 0, cycle: 0 }, ["EX1", "EX2", "EX3"]), false);
}

{
  const state = makeState([["EX", ""], ["", "EX1"], ["", "EX2"]]);
  state.arrows.push({ from: { row: 0, cycle: 0 }, to: { row: 1, cycle: 1 }, label: "" });
  assert.equal(isValidArrowTarget({ row: 0, cycle: 0 }, { row: 1, cycle: 1 }, state), false);
  assert.equal(isValidArrowTarget({ row: 0, cycle: 0 }, { row: 2, cycle: 1 }, state), true);
}

{
  const state = makeState([["IF", ""], ["", "EX"]]);
  state.arrows.push({ from: { row: 0, cycle: 0 }, to: { row: 1, cycle: 1 }, label: "" });
  const normalized = normalizeState(JSON.parse(exportJson(state)) as Partial<AppState>);
  assert.equal(normalized.rows[0].cells[0].text, "IF");
  assert.deepEqual(normalized.arrows, state.arrows);
}

console.log("Core unit tests passed");
