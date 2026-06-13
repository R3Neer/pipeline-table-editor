import type { AppState, CellData, CellPosition, PipelineArrow } from "../core/model";
export { exportPng } from "./image";

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function exportMarkdown(state: AppState): string {
  const header = ["Instruction", ...Array.from({ length: state.cycles }, (_, i) => String(i + 1))];
  const separator = header.map(() => "---");
  const lines = [
    `# ${state.title || "Exercise"}`,
    "",
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`
  ];

  state.rows.forEach((row) => {
    const cells = row.cells.map(markdownCell);
    lines.push(`| \`${escapePipe(row.instruction)}\` | ${cells.join(" | ")} |`);
  });

  if (state.arrows.length) {
    lines.push("", "### Forwarding", "");
    state.arrows.forEach((arrow) => {
      lines.push(formatMarkdownArrow(state, arrow));
    });
  }

  return lines.join("\n");
}

export function exportText(state: AppState): string {
  const lines = [state.title || "Exercise", `Cycles: ${state.cycles}`, ""];
  state.rows.forEach((row, rowIndex) => {
    lines.push(`${rowIndex + 1}. ${row.instruction}`);
    row.cells.forEach((cell, cycleIndex) => {
      if (cell.text.trim()) {
        const text = cell.struck ? `~~${cell.text}~~` : cell.text;
        lines.push(`   ${cycleIndex + 1}: ${text}`);
      }
    });
    lines.push("");
  });

  if (state.arrows.length) {
    lines.push("Forwarding:");
    state.arrows.forEach((arrow) => {
      const fromText = state.rows[arrow.from.row].cells[arrow.from.cycle].text || "";
      const toText = state.rows[arrow.to.row].cells[arrow.to.cycle].text || "";
      lines.push(
        `- fila ${arrow.from.row + 1} ciclo ${arrow.from.cycle + 1} ${fromText} -> fila ${
          arrow.to.row + 1
        } ciclo ${arrow.to.cycle + 1} ${toText}${arrow.label ? `: ${arrow.label}` : ""}`
      );
    });
  }

  return lines.join("\n").trimEnd();
}

export function describeCell(state: AppState, pos: CellPosition): string {
  const row = state.rows[pos.row];
  const cell = row && row.cells[pos.cycle];
  const text = cell && cell.text ? ` ${cell.text}` : "";
  return `fila ${pos.row + 1} ciclo ${pos.cycle + 1}${text}`;
}

export function formatArrow(state: AppState, arrow: PipelineArrow): string {
  const from = describeCell(state, arrow.from);
  const to = describeCell(state, arrow.to);
  return `${from} -> ${to}${arrow.label ? `: ${arrow.label}` : ""}`;
}

function formatMarkdownArrow(state: AppState, arrow: PipelineArrow): string {
  const fromRow = state.rows[arrow.from.row];
  const toRow = state.rows[arrow.to.row];
  const fromCell = fromRow.cells[arrow.from.cycle].text || "";
  const toCell = toRow.cells[arrow.to.cycle].text || "";
  const label = arrow.label ? `: \`${escapeBackticks(arrow.label)}\`` : "";
  return `- \`${escapeBackticks(fromRow.instruction)}\` ciclo ${arrow.from.cycle + 1} \`${escapeBackticks(
    fromCell
  )}\` -> \`${escapeBackticks(toRow.instruction)}\` ciclo ${arrow.to.cycle + 1} \`${escapeBackticks(
    toCell
  )}\`${label}`;
}

function markdownCell(cell: CellData): string {
  const text = escapePipe(cell.text || "");
  return cell.struck && text ? `~~${text}~~` : text;
}

function escapePipe(text: string): string {
  return String(text).replace(/\|/g, "\\|");
}

function escapeBackticks(text: string): string {
  return String(text).replace(/`/g, "\\`");
}
