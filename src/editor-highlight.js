import { KEYWORDS } from "./compiler/tokenizer.js";

// Common Processing / p5 types, highlighted distinctly from control keywords.
const TYPES = new Set([
  "color",
  "PImage",
  "PFont",
  "PShape",
  "PVector",
  "PGraphics",
  "ArrayList",
  "HashMap",
  "IntDict",
  "FloatDict",
  "StringDict",
  "IntList",
  "FloatList",
  "StringList",
  "char",
  "byte",
  "short",
  "long"
]);

function escapeHtml(text) {
  let out = "";
  for (const ch of text) {
    if (ch === "&") out += "&amp;";
    else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else out += ch;
  }
  return out;
}

function span(kind, text) {
  return `<span class="tok-${kind}">${escapeHtml(text)}</span>`;
}

function isIdentifierStart(ch) {
  return (
    (ch >= "a" && ch <= "z") ||
    (ch >= "A" && ch <= "Z") ||
    ch === "_" ||
    ch === "$"
  );
}

function isIdentifierPart(ch) {
  return isIdentifierStart(ch) || (ch >= "0" && ch <= "9");
}

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

function isWhitespace(ch) {
  return ch === " " || ch === "\n" || ch === "\r" || ch === "\t";
}

// Produces an HTML string mirroring the source character-for-character, with
// recognized tokens wrapped in colored <span>s. It is intentionally lenient:
// it never throws on incomplete/invalid input (the editor is often mid-edit),
// so unterminated strings/comments simply run to end-of-input.
export function highlightToHtml(source) {
  const text = source ?? "";
  const n = text.length;
  let out = "";
  let i = 0;

  while (i < n) {
    const ch = text[i];

    // Line comment.
    if (ch === "/" && text[i + 1] === "/") {
      let j = i + 2;
      while (j < n && text[j] !== "\n") j += 1;
      out += span("comment", text.slice(i, j));
      i = j;
      continue;
    }

    // Block comment.
    if (ch === "/" && text[i + 1] === "*") {
      let j = i + 2;
      while (j < n && !(text[j] === "*" && text[j + 1] === "/")) j += 1;
      j = j < n ? j + 2 : n;
      out += span("comment", text.slice(i, j));
      i = j;
      continue;
    }

    // Annotation (@Override, @SuppressWarnings("x"), @org.junit.Test, ...).
    if (ch === "@") {
      let j = i + 1;
      while (j < n && isWhitespace(text[j])) j += 1;
      while (j < n && (isIdentifierPart(text[j]) || text[j] === ".")) j += 1;
      let k = j;
      while (k < n && isWhitespace(text[k])) k += 1;
      if (text[k] === "(") {
        let depth = 0;
        let m = k;
        do {
          const c = text[m];
          if (c === '"' || c === "'") {
            const quote = c;
            m += 1;
            while (m < n && text[m] !== quote) {
              if (text[m] === "\\") m += 1;
              m += 1;
            }
            m += 1;
            continue;
          }
          if (c === "(") depth += 1;
          else if (c === ")") depth -= 1;
          m += 1;
        } while (m < n && depth > 0);
        j = m;
      }
      out += span("annotation", text.slice(i, j));
      i = j;
      continue;
    }

    // String / char literal.
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && text[j] !== ch) {
        if (text[j] === "\\") j += 1;
        j += 1;
      }
      j = j < n ? j + 1 : n;
      out += span("string", text.slice(i, j));
      i = j;
      continue;
    }

    // Number.
    if (isDigit(ch)) {
      let j = i + 1;
      while (j < n && isDigit(text[j])) j += 1;
      if (text[j] === "." && isDigit(text[j + 1])) {
        j += 1;
        while (j < n && isDigit(text[j])) j += 1;
      }
      if (j < n && "fFdDlL".includes(text[j])) j += 1;
      out += span("number", text.slice(i, j));
      i = j;
      continue;
    }

    // Identifier / keyword / type.
    if (isIdentifierStart(ch)) {
      let j = i + 1;
      while (j < n && isIdentifierPart(text[j])) j += 1;
      const word = text.slice(i, j);
      if (KEYWORDS.has(word)) out += span("keyword", word);
      else if (TYPES.has(word)) out += span("type", word);
      else out += escapeHtml(word);
      i = j;
      continue;
    }

    // Everything else (whitespace, punctuation, operators) passes through.
    out += escapeHtml(ch);
    i += 1;
  }

  return out;
}
