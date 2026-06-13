import type { AppState, CellPosition, PipelineArrow } from "../core/model";

type CellResolver = (pos: CellPosition) => HTMLInputElement | null;
type RemoveHandler = (index: number) => void;

export function drawArrows(
  tableShell: HTMLElement,
  arrowLayer: SVGSVGElement,
  state: AppState,
  getCellElement: CellResolver,
  onRemove: RemoveHandler
): void {
  const shellRect = tableShell.getBoundingClientRect();
  const width = tableShell.scrollWidth;
  const height = tableShell.scrollHeight;
  arrowLayer.setAttribute("width", String(width));
  arrowLayer.setAttribute("height", String(height));
  arrowLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
  arrowLayer.replaceChildren(makeArrowDefs());

  state.arrows.forEach((arrow, index) => {
    appendArrowPath(tableShell, arrowLayer, shellRect, arrow, index, getCellElement, onRemove);
  });
}

function appendArrowPath(
  tableShell: HTMLElement,
  arrowLayer: SVGSVGElement,
  shellRect: DOMRect,
  arrow: PipelineArrow,
  index: number,
  getCellElement: CellResolver,
  onRemove: RemoveHandler
): void {
  const fromEl = getCellElement(arrow.from);
  const toEl = getCellElement(arrow.to);
  if (!fromEl || !toEl) return;

  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const x1 = fromRect.left - shellRect.left + tableShell.scrollLeft + fromRect.width / 2;
  const y1 = fromRect.top - shellRect.top + tableShell.scrollTop + fromRect.height / 2;
  const x2 = toRect.left - shellRect.left + tableShell.scrollLeft + toRect.width / 2;
  const y2 = toRect.top - shellRect.top + tableShell.scrollTop + toRect.height / 2;
  const midX = (x1 + x2) / 2;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.classList.add("arrow-path");
  path.dataset.arrowIndex = String(index);
  path.setAttribute("d", `M ${x1} ${y1} C ${midX} ${y1 - 34}, ${midX} ${y2 - 34}, ${x2} ${y2}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#006c7a");
  path.setAttribute("stroke-width", "2.5");
  path.setAttribute("marker-end", "url(#arrowHead)");
  path.addEventListener("click", (event) => {
    event.stopPropagation();
    if (window.confirm("Delete this arrow?")) onRemove(index);
  });
  arrowLayer.appendChild(path);

  if (arrow.label) {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.textContent = arrow.label;
    label.setAttribute("x", String(midX));
    label.setAttribute("y", String(Math.min(y1, y2) - 20));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "12");
    label.setAttribute("font-weight", "800");
    label.setAttribute("fill", "#00525d");
    arrowLayer.appendChild(label);
  }
}

function makeArrowDefs(): SVGDefsElement {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "arrowHead");
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "3");
  marker.setAttribute("orient", "auto");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M 0 0 L 8 3 L 0 6 z");
  path.setAttribute("fill", "#006c7a");
  marker.appendChild(path);
  defs.appendChild(marker);
  return defs;
}
