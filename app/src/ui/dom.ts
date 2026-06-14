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

function byId<T extends Element>(id: string, ctor: { new (...args: never[]): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Element #${id} was not found or has an unexpected type`);
  }
  return element;
}
