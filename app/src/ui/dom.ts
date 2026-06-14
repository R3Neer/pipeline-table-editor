import { tokenizeAssembly } from "../core/assembly";
import type { AppElements } from "../core/model";

export function getAppElements(): AppElements {
  return {
    layoutRoot: byId("layoutRoot", HTMLElement),
    collapseSidebarBtn: byId("collapseSidebarBtn", HTMLButtonElement),
    expandSidebarBtn: byId("expandSidebarBtn", HTMLButtonElement),
    titleInput: byId("titleInput", HTMLInputElement),
    cyclesInput: byId("cyclesInput", HTMLInputElement),
    instructionsInput: byId("instructionsInput", HTMLTextAreaElement),
    exportMenuBtn: byId("exportMenuBtn", HTMLButtonElement),
    exportMenu: byId("exportMenu", HTMLElement),
    copyExportBtn: byId("copyExportBtn", HTMLButtonElement),
    importInput: byId("importInput", HTMLTextAreaElement),
    importBtn: byId("importBtn", HTMLButtonElement),
    clearBtn: byId("clearBtn", HTMLButtonElement),
    saveStatus: byId("saveStatus", HTMLElement),
    tableShell: byId("tableShell", HTMLElement),
    instructionMount: byId("instructionMount", HTMLElement),
    cycleViewport: byId("cycleViewport", HTMLElement),
    tableMount: byId("tableMount", HTMLElement),
    arrowLayer: byId("arrowLayer", SVGSVGElement),
    exportModal: byId("exportModal", HTMLElement),
    exportOutput: byId("exportOutput", HTMLTextAreaElement),
    closeExportBtn: byId("closeExportBtn", HTMLButtonElement),
    cellMenu: byId("cellMenu", HTMLElement),
    autocompleteMenu: byId("autocompleteMenu", HTMLElement)
  };
}

export function getInputPosition(input: HTMLInputElement): { row: number; cycle: number } {
  return {
    row: Number(input.dataset.row),
    cycle: Number(input.dataset.cycle)
  };
}

export function renderAssemblyHighlight(target: HTMLElement, text: string): void {
  target.replaceChildren();
  tokenizeAssembly(text).forEach((token) => {
    if (token.kind === "instruction") appendAssemblyToken(target, token.text, "asm-token-instruction");
    if (token.kind === "register") appendAssemblyToken(target, token.text, "asm-token-register");
    if (token.kind === "plain") appendAssemblyText(target, token.text);
  });
}

function appendAssemblyText(target: HTMLElement, text: string): void {
  if (text) target.appendChild(document.createTextNode(text));
}

function appendAssemblyToken(target: HTMLElement, text: string, className: string): void {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  target.appendChild(span);
}

function byId<T extends Element>(id: string, ctor: { new (...args: never[]): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Element #${id} was not found or has an unexpected type`);
  }
  return element;
}
