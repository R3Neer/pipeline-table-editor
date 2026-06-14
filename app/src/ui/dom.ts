import { tokenizeAssembly } from "../core/assembly";
import { getLabelColor } from "../core/labels";

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
  downloadExportBtn: HTMLButtonElement;
  labelModal: HTMLElement;
  labelInput: HTMLInputElement;
  labelModalTitle: HTMLElement;
  saveLabelBtn: HTMLButtonElement;
  cancelLabelBtn: HTMLButtonElement;
  confirmModal: HTMLElement;
  confirmModalTitle: HTMLElement;
  confirmModalMessage: HTMLElement;
  acceptConfirmBtn: HTMLButtonElement;
  cancelConfirmBtn: HTMLButtonElement;
  cellMenu: HTMLElement;
  rowMenu: HTMLElement;
  autocompleteMenu: HTMLElement;
}

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
    downloadExportBtn: byId("downloadExportBtn", HTMLButtonElement),
    labelModal: byId("labelModal", HTMLElement),
    labelInput: byId("labelInput", HTMLInputElement),
    labelModalTitle: byId("labelModalTitle", HTMLElement),
    saveLabelBtn: byId("saveLabelBtn", HTMLButtonElement),
    cancelLabelBtn: byId("cancelLabelBtn", HTMLButtonElement),
    confirmModal: byId("confirmModal", HTMLElement),
    confirmModalTitle: byId("confirmModalTitle", HTMLElement),
    confirmModalMessage: byId("confirmModalMessage", HTMLElement),
    acceptConfirmBtn: byId("acceptConfirmBtn", HTMLButtonElement),
    cancelConfirmBtn: byId("cancelConfirmBtn", HTMLButtonElement),
    cellMenu: byId("cellMenu", HTMLElement),
    rowMenu: byId("rowMenu", HTMLElement),
    autocompleteMenu: byId("autocompleteMenu", HTMLElement)
  };
}

export function getInputPosition(input: HTMLInputElement): { row: number; cycle: number } {
  return {
    row: Number(input.dataset.row),
    cycle: Number(input.dataset.cycle)
  };
}

export function renderAssemblyHighlight(target: HTMLElement, text: string, labels: string[] = []): boolean {
  target.replaceChildren();
  const tokens = tokenizeAssembly(text);
  tokens.forEach((token) => {
    if (isKnownLabel(token.text, labels)) {
      appendLabelToken(target, token.text);
      return;
    }
    if (token.kind === "annotation") appendAssemblyToken(target, token.text, "asm-token-annotation");
    if (token.kind === "instruction") appendAssemblyToken(target, token.text, "asm-token-instruction");
    if (token.kind === "register") appendAssemblyToken(target, token.text, "asm-token-register");
    if (token.kind === "plain") appendAssemblyLabelAwareText(target, token.text, labels);
  });
  return tokens.length === 1 && tokens[0].kind === "annotation";
}

function appendAssemblyText(target: HTMLElement, text: string): void {
  if (text) target.appendChild(document.createTextNode(text));
}

function appendAssemblyLabelAwareText(target: HTMLElement, text: string, labels: string[]): void {
  if (!labels.length) {
    appendAssemblyText(target, text);
    return;
  }

  const pattern = makeLabelPattern(labels);
  let cursor = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > cursor) appendAssemblyText(target, text.slice(cursor, match.index));
    appendLabelToken(target, match[0]);
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (cursor < text.length) appendAssemblyText(target, text.slice(cursor));
}

function appendAssemblyToken(target: HTMLElement, text: string, className: string): void {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  target.appendChild(span);
}

function appendLabelToken(target: HTMLElement, text: string): void {
  const span = document.createElement("span");
  span.className = "asm-token-label";
  span.style.color = getLabelColor(text.replace(/:$/, ""));
  span.textContent = text;
  target.appendChild(span);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isKnownLabel(text: string, labels: string[]): boolean {
  return labels.some((label) => label.toLowerCase() === text.replace(/:$/, "").toLowerCase());
}

function makeLabelPattern(labels: string[]): RegExp {
  return new RegExp(`\\b(${labels.map(escapeRegExp).join("|")}):?(?=\\W|$)`, "gi");
}

function byId<T extends Element>(id: string, ctor: { new (...args: never[]): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Element #${id} was not found or has an unexpected type`);
  }
  return element;
}
