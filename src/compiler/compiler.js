import { tokenize } from "./tokenizer.js";
import { parse } from "./parser.js";
import { generate } from "./generator.js";
import { validateSemantics } from "./semantics.js";

const PDE_CLASS_NAME = "__P5ForgeSketch";

function normalizeFileType(fileType) {
  const raw = String(fileType || "java").toLowerCase();
  if (raw === "pde" || raw === ".pde") {
    return "pde";
  }
  return "java";
}

function detectFileTypeFromPath(inputPath) {
  return String(inputPath || "").toLowerCase().endsWith(".pde") ? "pde" : "java";
}

function indentBlock(text, spaces = 2) {
  const indent = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? `${indent}${line}` : ""))
    .join("\n");
}

function findMatchingBrace(source, openBraceIndex) {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openBraceIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingleQuote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inTemplate) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === "`") {
        inTemplate = false;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (ch === "`") {
      inTemplate = true;
      continue;
    }

    if (ch === "{") {
      depth += 1;
      continue;
    }

    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function extractTopLevelClassDeclarations(source) {
  const ranges = [];
  const classStartRegex = /(^|\n)\s*class\s+[A-Za-z_]\w*(?:\s+extends\s+[A-Za-z_]\w+)?\s*\{/g;
  let match;

  while ((match = classStartRegex.exec(source)) !== null) {
    const start = match.index + (match[1] ? 1 : 0);
    const openBrace = source.indexOf("{", classStartRegex.lastIndex - 1);
    if (openBrace < 0) {
      continue;
    }

    const closeBrace = findMatchingBrace(source, openBrace);
    if (closeBrace < 0) {
      continue;
    }

    let end = closeBrace + 1;
    while (end < source.length && /[\s\n\r\t]/.test(source[end])) {
      end += 1;
    }

    ranges.push({ start, end });
    classStartRegex.lastIndex = end;
  }

  if (ranges.length === 0) {
    return { classBlocks: [], remainingBody: source.trim() };
  }

  ranges.sort((a, b) => a.start - b.start);

  const classBlocks = [];
  const remainderParts = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      remainderParts.push(source.slice(cursor, range.start));
    }
    classBlocks.push(source.slice(range.start, range.end).trim());
    cursor = range.end;
  }
  if (cursor < source.length) {
    remainderParts.push(source.slice(cursor));
  }

  const remainingBody = remainderParts.join("\n").trim();
  return { classBlocks, remainingBody };
}

function wrapPdeSource(source) {
  const normalized = String(source).replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return {
      source: `class ${PDE_CLASS_NAME} {\n  void setup() {\n  }\n}\n`,
      syntheticClassName: PDE_CLASS_NAME
    };
  }

  const lines = normalized.split("\n");
  const importLines = [];
  let bodyStart = 0;
  while (bodyStart < lines.length) {
    const trimmed = lines[bodyStart].trim();
    if (trimmed === "") {
      bodyStart += 1;
      continue;
    }
    if (/^import\b.*;\s*$/.test(trimmed)) {
      importLines.push(lines[bodyStart]);
      bodyStart += 1;
      continue;
    }
    break;
  }

  const bodySource = lines.slice(bodyStart).join("\n").trim();
  const { classBlocks, remainingBody } = extractTopLevelClassDeclarations(bodySource);
  const importsPrefix = importLines.length > 0 ? `${importLines.join("\n")}\n\n` : "";

  if (!remainingBody) {
    if (classBlocks.length > 0) {
      return {
        source: `${importsPrefix}${classBlocks.join("\n\n")}\n`,
        syntheticClassName: null
      };
    }

    return {
      source: `${importsPrefix}class ${PDE_CLASS_NAME} {\n  void setup() {\n  }\n}\n`,
      syntheticClassName: PDE_CLASS_NAME
    };
  }

  const hasSetupMethod = /\bvoid\s+setup\s*\(/.test(remainingBody);
  let classBody = remainingBody;
  if (!hasSetupMethod) {
    const hasLikelyMethodDeclarations =
      /(^|\n)\s*(?:public|private|protected|static\s+)*[A-Za-z_][\w<>\[\]]*\s+[A-Za-z_]\w*\s*\([^;{}]*\)\s*\{/m.test(
        remainingBody
      );

    if (hasLikelyMethodDeclarations) {
      classBody = `void setup() {\n  }\n\n${remainingBody}`;
    } else {
      classBody = `void setup() {\n${indentBlock(remainingBody, 4)}\n  }`;
    }
  }

  const syntheticWrapper = `class ${PDE_CLASS_NAME} {\n${indentBlock(classBody, 2)}\n}`;
  const blocks = [...classBlocks, syntheticWrapper];
  return {
    source: `${importsPrefix}${blocks.join("\n\n")}\n`,
    syntheticClassName: PDE_CLASS_NAME
  };
}

function prepareSource(source, fileType) {
  const normalizedType = normalizeFileType(fileType);
  if (normalizedType === "pde") {
    return wrapPdeSource(source);
  }

  return {
    source: String(source).replace(/\r\n?/g, "\n"),
    syntheticClassName: null
  };
}

export function compileSource(source, fileType = "java") {
  const prepared = prepareSource(source, fileType);
  const tokens = tokenize(prepared.source);
  const ast = parse(tokens);
  validateSemantics(ast);
  const jsCode = generate(ast, { flattenClassName: prepared.syntheticClassName });
  return { tokens, ast, jsCode };
}

export async function compileFile(inputPath, outputPath, fileType) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const source = fs.readFileSync(inputPath, "utf8");
  const resolvedFileType = fileType || detectFileTypeFromPath(inputPath);
  const { jsCode } = compileSource(source, resolvedFileType);

  const resolvedOutput =
    outputPath ||
    path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, path.extname(inputPath))}.js`
    );

  fs.writeFileSync(resolvedOutput, jsCode, "utf8");
  return resolvedOutput;
}
