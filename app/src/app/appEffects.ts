export interface AppMutationEffects {
  renderAndSave(): void;
  refreshCellsAndSave(options?: { redrawArrows?: boolean }): void;
  refreshCells(): void;
  scheduleSave(): void;
  requestArrowRedraw(): void;
}

interface AppMutationEffectsOptions {
  render(): void;
  refreshCellClasses(): void;
  scheduleSave(): void;
  drawArrows(): void;
}

export function createAppMutationEffects({
  render,
  refreshCellClasses,
  scheduleSave,
  drawArrows
}: AppMutationEffectsOptions): AppMutationEffects {
  function renderAndSave(): void {
    render();
    scheduleSave();
  }

  function refreshCellsAndSave(options: { redrawArrows?: boolean } = {}): void {
    refreshCellClasses();
    scheduleSave();
    if (options.redrawArrows) requestArrowRedraw();
  }

  function requestArrowRedraw(): void {
    window.requestAnimationFrame(drawArrows);
  }

  return {
    renderAndSave,
    refreshCellsAndSave,
    refreshCells: refreshCellClasses,
    scheduleSave,
    requestArrowRedraw
  };
}
