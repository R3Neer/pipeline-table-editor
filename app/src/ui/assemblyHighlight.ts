import { tokenizeAssembly } from "../core/assembly";
import { getLabelColor } from "../core/labels";

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

