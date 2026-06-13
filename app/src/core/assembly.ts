export interface AssemblyToken {
  text: string;
  kind: "instruction" | "register" | "plain";
}

export function tokenizeAssembly(text: string): AssemblyToken[] {
  const firstWord = text.match(/\S+/);
  if (!firstWord) return text ? [{ text, kind: "plain" }] : [];

  const tokens: AssemblyToken[] = [];
  const start = firstWord.index || 0;
  const end = start + firstWord[0].length;
  if (start > 0) tokens.push({ text: text.slice(0, start), kind: "plain" });
  tokens.push({ text: firstWord[0], kind: "instruction" });
  appendRegisterTokens(tokens, text.slice(end));
  return tokens;
}

function appendRegisterTokens(tokens: AssemblyToken[], text: string): void {
  const registerPattern = /\b[a-z][0-9]{1,2}\b/g;
  let cursor = 0;
  let match = registerPattern.exec(text);

  while (match) {
    if (match.index > cursor) tokens.push({ text: text.slice(cursor, match.index), kind: "plain" });
    tokens.push({ text: match[0], kind: "register" });
    cursor = match.index + match[0].length;
    match = registerPattern.exec(text);
  }

  if (cursor < text.length) tokens.push({ text: text.slice(cursor), kind: "plain" });
}
