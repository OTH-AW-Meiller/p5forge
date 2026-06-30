const KEYWORDS = new Set([
  "import",
  "export",
  "from",
  "class",
  "interface",
  "enum",
  "extends",
  "implements",
  "abstract",
  "super",
  "public",
  "private",
  "protected",
  "static",
  "void",
  "int",
  "float",
  "double",
  "boolean",
  "String",
  "new",
  "return",
  "if",
  "else",
  "while",
  "for",
  "switch",
  "case",
  "default",
  "break",
  "try",
  "catch",
  "finally",
  "throw",
  "true",
  "false",
  "null",
  "this"
]);

const SYMBOLS = new Set([
  "{",
  "}",
  "(",
  ")",
  "[",
  "]",
  ";",
  ",",
  ".",
  ":",
  "?"
]);

const TWO_CHAR_OPERATORS = new Set([
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/="
]);

const ONE_CHAR_OPERATORS = new Set([
  "=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "!",
  "|"
]);

function isWhitespace(ch) {
  return ch === " " || ch === "\n" || ch === "\r" || ch === "\t";
}

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
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
  return isIdentifierStart(ch) || isDigit(ch);
}

export function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let column = 1;

  function current() {
    return source[i];
  }

  function peek(n = 1) {
    return source[i + n];
  }

  function advance() {
    const ch = source[i++];
    if (ch === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return ch;
  }

  function add(type, value, startLine, startColumn) {
    tokens.push({ type, value, line: startLine, column: startColumn });
  }

  while (i < source.length) {
    const ch = current();

    if (isWhitespace(ch)) {
      advance();
      continue;
    }

    if (ch === "/" && peek() === "/") {
      while (i < source.length && current() !== "\n") {
        advance();
      }
      continue;
    }

    if (ch === "/" && peek() === "*") {
      advance();
      advance();
      while (i < source.length) {
        if (current() === "*" && peek() === "/") {
          advance();
          advance();
          break;
        }
        advance();
      }
      continue;
    }

    const startLine = line;
    const startColumn = column;

    if (isIdentifierStart(ch)) {
      let value = "";
      while (i < source.length && isIdentifierPart(current())) {
        value += advance();
      }
      const type = KEYWORDS.has(value) ? "keyword" : "identifier";
      add(type, value, startLine, startColumn);
      continue;
    }

    if (isDigit(ch)) {
      let value = "";
      while (i < source.length && isDigit(current())) {
        value += advance();
      }
      if (current() === "." && isDigit(peek())) {
        value += advance();
        while (i < source.length && isDigit(current())) {
          value += advance();
        }
      }
      add("number", value, startLine, startColumn);
      continue;
    }

    if (ch === '"') {
      advance();
      let value = "";
      while (i < source.length && current() !== '"') {
        if (current() === "\\") {
          value += advance();
          if (i < source.length) {
            value += advance();
          }
          continue;
        }
        value += advance();
      }
      if (current() !== '"') {
        throw new Error(
          `Unterminated string at ${startLine}:${startColumn}`
        );
      }
      advance();
      add("string", value, startLine, startColumn);
      continue;
    }

    if (ch === "'") {
      advance();
      let value = "";
      while (i < source.length && current() !== "'") {
        if (current() === "\\") {
          value += advance();
          if (i < source.length) {
            value += advance();
          }
          continue;
        }
        value += advance();
      }
      if (current() !== "'") {
        throw new Error(
          `Unterminated char/string literal at ${startLine}:${startColumn}`
        );
      }
      advance();
      add("string", value, startLine, startColumn);
      continue;
    }

    const twoChar = `${ch}${peek() ?? ""}`;
    if (TWO_CHAR_OPERATORS.has(twoChar)) {
      advance();
      advance();
      add("operator", twoChar, startLine, startColumn);
      continue;
    }

    if (ONE_CHAR_OPERATORS.has(ch)) {
      advance();
      add("operator", ch, startLine, startColumn);
      continue;
    }

    if (SYMBOLS.has(ch)) {
      advance();
      add("symbol", ch, startLine, startColumn);
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at ${line}:${column}`);
  }

  tokens.push({ type: "eof", value: "<eof>", line, column });
  return tokens;
}
