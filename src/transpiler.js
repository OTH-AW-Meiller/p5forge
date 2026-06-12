const TYPE_KEYWORDS = [
  "int",
  "float",
  "double",
  "long",
  "short",
  "byte",
  "boolean",
  "char",
  "String",
  "color",
  "PImage",
  "PFont",
  "PVector"
];

const MODIFIERS = ["public", "private", "protected", "static", "final"];

const TYPE_PATTERN = TYPE_KEYWORDS.join("|");
const MODIFIER_PATTERN = MODIFIERS.join("|");

/**
 * Applies a best-effort conversion from Processing(Java)-style syntax to JavaScript.
 * The goal is pragmatic p5.js compatibility, not full Java semantics.
 */
export function transpileProcessingToJs(inputCode) {
  let code = inputCode;

  // Normalize line endings to simplify regex-based transforms.
  code = code.replace(/\r\n?/g, "\n");

  // Remove Java-specific import/package statements.
  code = code
    .replace(/^\s*package\s+[\w.]+\s*;\s*$/gm, "")
    .replace(/^\s*import\s+[\w.*]+\s*;\s*$/gm, "");

  // Convert common Java collection construction to plain JS arrays.
  // Example: ArrayList<int> arr = new ArrayList<int>(); -> let arr = new Array();
  code = code.replace(
    /(^|\n)(\s*)ArrayList\s*<[^>\n]+>\s+([A-Za-z_]\w*)\s*=\s*new\s+ArrayList\s*<[^>\n]*>\s*\(\s*\)\s*;/g,
    "$1$2let $3 = new Array();"
  );

  // Convert known Java/Processing class-like declarations to JS lets.
  // Examples: "int x = 0;" -> "let x = 0;", "float a, b;" -> "let a, b;"
  code = code.replace(
    new RegExp(`(^|\\n)(\\s*)(?:${TYPE_PATTERN})(?:\\s*\\[\\s*\\])*\\s+([^;\\n]+);`, "g"),
    (full, leadingNewline, indent, declarationBody) => {
      return `${leadingNewline}${indent}let ${declarationBody};`;
    }
  );

  // Convert custom class-typed declarations to JS lets.
  // Example: UFO meinUfo; -> let meinUfo;
  code = code.replace(
    /(^|\n)(\s*)([A-Z][A-Za-z0-9_]*)(?:\s*\[\s*\])*\s+([^;\n]+);/g,
    (full, leadingNewline, indent, typeName, declarationBody) => {
      return `${leadingNewline}${indent}let ${declarationBody};`;
    }
  );

  // Convert generic custom type declarations to JS lets.
  // Example: HashMap<String, Integer> hm = new HashMap<String, Integer>(); -> let hm = new HashMap<String, Integer>();
  code = code.replace(
    /(^|\n)(\s*)([A-Z][A-Za-z0-9_]*\s*<[^>\n]+>)(?:\s*\[\s*\])*\s+([^;\n]+);/g,
    (full, leadingNewline, indent, typeName, declarationBody) => {
      return `${leadingNewline}${indent}let ${declarationBody};`;
    }
  );

  // Strip Java generic constructor annotations that are invalid JS.
  // Example: new HashMap<String, Integer>() -> new HashMap()
  code = code.replace(/new\s+([A-Za-z_][\w.]*)\s*<[^>\n]+>\s*\(/g, "new $1(");

  // Convert Java array literal declarations to JS array literals.
  // Example: int[] arr = {1,2,3}; -> let arr = [1,2,3];
  code = code.replace(
    new RegExp(
      `(^|\\n)(\\s*)(?:${TYPE_PATTERN})\\s*\\[\\s*\\]\\s+([A-Za-z_]\\w*)\\s*=\\s*\\{([^}]*)\\}\\s*;`,
      "g"
    ),
    "$1$2let $3 = [$4];"
  );

  // Convert Java 2D array literal declarations to JS nested array literals.
  // Example: int[][] arr = {{1,2,3}, {4,5,6}}; -> let arr = [[1,2,3], [4,5,6]];
  code = code.replace(
    new RegExp(
      `(^|\\n)(\\s*)(?:${TYPE_PATTERN})\\s*\\[\\s*\\]\\s*\\[\\s*\\]\\s+([A-Za-z_]\\w*)\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*;`,
      "g"
    ),
    (full, leadingNewline, indent, varName, inner) => {
      const normalized = inner.replace(/\}\s*,\s*\{/g, "], [").replace(/\{/g, "[").replace(/\}/g, "]");
      return `${leadingNewline}${indent}let ${varName} = [${normalized}];`;
    }
  );

  // Also handle the same pattern after typed declarations were already turned into let.
  // Example: let arr = {1,2,3}; -> let arr = [1,2,3];
  code = code.replace(
    /(^|\n)(\s*)let\s+([A-Za-z_]\w*)\s*=\s*\{([^:{}]*)\}\s*;/g,
    "$1$2let $3 = [$4];"
  );

  // Also handle 2D array literals after type declarations are converted to let.
  // Example: let arr = {{1,2,3}, {4,5,6}}; -> let arr = [[1,2,3], [4,5,6]];
  code = code.replace(
    /(^|\n)(\s*)let\s+([A-Za-z_]\w*)\s*=\s*\{\s*\{([\s\S]*?)\}\s*\}\s*;/g,
    (full, leadingNewline, indent, varName, inner) => {
      const normalized = inner.replace(/\}\s*,\s*\{/g, "], [");
      return `${leadingNewline}${indent}let ${varName} = [[${normalized}]];`;
    }
  );

  // Convert typed for-loop initializer declarations.
  // Example: for (int i = 0; ...) -> for (let i = 0; ...)
  code = code.replace(
    new RegExp(`for\\s*\\(\\s*(?:${TYPE_PATTERN})\\s+`, "g"),
    "for (let "
  );

  // Convert Java enhanced for-loops to JS for...of loops.
  // Example: for (int n : nums) -> for (const n of nums)
  const enhancedForTypePattern = `(?:${TYPE_PATTERN}|[A-Za-z_][\\w.]*(?:\\s*<[^>\\n]+>)?(?:\\s*\\[\\s*\\])*)`;
  code = code.replace(
    new RegExp(
      `for\\s*\\(\\s*${enhancedForTypePattern}\\s+([A-Za-z_]\\w*)\\s*:\\s*([^\\)]+)\\)` ,
      "g"
    ),
    "for (const $1 of $2)"
  );

  // Remove Java modifiers where they are mostly syntactic noise in JS.
  code = code.replace(
    new RegExp(`\\b(?:${MODIFIER_PATTERN})\\s+`, "g"),
    ""
  );

  // Convert Java method declarations to JS function declarations.
  // Handles return types including simple generics and arrays.
  // Example: "void setup() {" -> "function setup() {"
  code = code.replace(
    /(^|\n)(\s*)(?:[A-Za-z_][\w<>\[\]]*\s+)+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g,
    (full, leadingNewline, indent, methodName, args) => {
      // Skip control-flow constructs that regex may accidentally catch.
      if (["if", "for", "while", "switch", "catch"].includes(methodName)) {
        return full;
      }

      const jsArgs = stripArgTypes(args);
      return `${leadingNewline}${indent}function ${methodName}(${jsArgs}) {`;
    }
  );

  // Convert typed catch declarations to JS catch bindings.
  // Example: catch (IOException e) -> catch (e)
  code = code.replace(/catch\s*\(\s*[A-Za-z_][\w<>\[\]]*\s+([A-Za-z_]\w*)\s*\)/g, "catch ($1)");

  // Convert Java-style array creation to JS arrays where straightforward.
  // Example: new int[10] -> new Array(10)
  code = code.replace(
    /new\s+(?:int|float|double|long|short|byte|boolean|char)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]/g,
    "Array.from({ length: $1 }, () => new Array($2))"
  );

  code = code.replace(/new\s+(?:int|float|double|long|short|byte|boolean|char)\s*\[\s*([^\]]+)\s*\]/g, "new Array($1)");

  // Convert Java-style object/custom array creation to JS arrays.
  // Examples: new UFO[3] -> new Array(3), new Cell[w][h] -> Array.from({ length: w }, () => new Array(h))
  code = code.replace(
    /new\s+([A-Za-z_][\w.]*)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]/g,
    "Array.from({ length: $2 }, () => new Array($3))"
  );

  code = code.replace(/new\s+([A-Za-z_][\w.]*)\s*\[\s*([^\]]+)\s*\]/g, "new Array($2)");

  // Convert Processing println to console.log.
  code = code.replace(/\bprintln\s*\(/g, "console.log(");

  // Translate Java booleans/null naming to JS where needed.
  code = code
    .replace(/\bnull\b/g, "null")
    .replace(/\btrue\b/g, "true")
    .replace(/\bfalse\b/g, "false");

  // Remove Java casts like (int), (float), (String) in expression context.
  code = code.replace(new RegExp(`\\(\\s*(?:${TYPE_PATTERN})\\s*\\)`, "g"), "");

  // Normalize syntax inside class bodies after generic rewrites.
  // Example: "let x = 1;" -> "x = 1;", "function foo() {" -> "foo() {"
  code = normalizeClassSyntax(code);

  // Clean up excessive empty lines introduced by removals.
  code = code.replace(/\n{3,}/g, "\n\n");

  return code.trimEnd() + "\n";
}

function stripArgTypes(argsText) {
  const trimmed = argsText.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .split(",")
    .map((rawArg) => rawArg.trim())
    .filter(Boolean)
    .map((arg) => {
      // Keep varargs marker by normalizing "type... name" -> "...name"
      const varargMatch = arg.match(/^([A-Za-z_][\w<>\[\]]*)\s*\.\.\.\s*([A-Za-z_]\w*)$/);
      if (varargMatch) {
        return `...${varargMatch[2]}`;
      }

      // Remove leading type tokens and keep variable name + default expression if present.
      // Example: "int x" -> "x", "float x = 2" -> "x = 2"
      const parts = arg.split(/\s+/);
      if (parts.length === 1) {
        return arg;
      }

      const nameAndMaybeDefault = parts.slice(-1)[0];
      const defaultIndex = arg.indexOf("=");
      if (defaultIndex !== -1) {
        const left = arg.slice(0, defaultIndex).trim();
        const leftParts = left.split(/\s+/);
        const variableName = leftParts[leftParts.length - 1];
        const defaultExpr = arg.slice(defaultIndex + 1).trim();
        return `${variableName} = ${defaultExpr}`;
      }

      return nameAndMaybeDefault;
    })
    .join(", ");
}

function normalizeClassSyntax(code) {
  const classHeaderRegex = /class\s+([A-Za-z_]\w*)(?:\s+extends\s+([A-Za-z_]\w*))?\s*\{/g;
  const classBlocks = [];
  let match;

  while ((match = classHeaderRegex.exec(code)) !== null) {
    const openBraceIndex = code.indexOf("{", match.index);
    if (openBraceIndex === -1) {
      break;
    }

    const closeBraceIndex = findMatchingBrace(code, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    classBlocks.push({
      start: match.index,
      end: closeBraceIndex + 1,
      className: match[1],
      parentName: match[2] || null,
      blockText: code.slice(match.index, closeBraceIndex + 1)
    });

    classHeaderRegex.lastIndex = closeBraceIndex + 1;
  }

  if (classBlocks.length === 0) {
    return code;
  }

  const ownFieldsByClass = new Map();
  for (const cls of classBlocks) {
    ownFieldsByClass.set(cls.className, collectOwnClassFields(cls.blockText));
  }

  const allFieldsByClass = new Map();
  const visiting = new Set();
  const resolveFields = (className) => {
    if (allFieldsByClass.has(className)) {
      return allFieldsByClass.get(className);
    }

    if (visiting.has(className)) {
      return ownFieldsByClass.get(className) || new Set();
    }

    visiting.add(className);

    const classInfo = classBlocks.find((c) => c.className === className);
    const own = ownFieldsByClass.get(className) || new Set();
    const merged = new Set(own);

    if (classInfo && classInfo.parentName && ownFieldsByClass.has(classInfo.parentName)) {
      const parentFields = resolveFields(classInfo.parentName);
      for (const fieldName of parentFields) {
        merged.add(fieldName);
      }
    }

    visiting.delete(className);
    allFieldsByClass.set(className, merged);
    return merged;
  };

  for (const cls of classBlocks) {
    resolveFields(cls.className);
  }

  let result = "";
  let lastIndex = 0;

  for (const cls of classBlocks) {
    result += code.slice(lastIndex, cls.start);
    result += normalizeSingleClassBlock(cls.blockText, cls.className, allFieldsByClass.get(cls.className));
    lastIndex = cls.end;
  }

  result += code.slice(lastIndex);
  return result;
}

function findMatchingBrace(text, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function normalizeSingleClassBlock(blockText, className, inheritedFields = new Set()) {
  const lines = blockText.split("\n");
  let depth = 0;
  const fieldNames = new Set(inheritedFields);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (depth === 1) {
      lines[i] = line
        .replace(/^(\s*)let\s+([^;]+);(\s*)$/, "$1$2;$3")
        .replace(/^(\s*)function\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{(\s*)$/, "$1$2($3) {$4");

      const constructorRegex = new RegExp(`^(\\s*)${className}\\s*\\(([^)]*)\\)\\s*\\{(\\s*)$`);
      lines[i] = lines[i].replace(constructorRegex, (full, indent, args, tail) => {
        return `${indent}constructor(${stripArgTypes(args)}) {${tail}`;
      });

      const fieldMatch = lines[i].match(/^\s*([A-Za-z_]\w*)\s*(?:=[^;]*)?;\s*$/);
      if (fieldMatch) {
        fieldNames.add(fieldMatch[1]);
      }
    } else if (depth >= 2 && fieldNames.size > 0) {
      let rewritten = lines[i];
      for (const fieldName of fieldNames) {
        if (rewritten.includes(`let ${fieldName}`) || rewritten.includes(`const ${fieldName}`) || rewritten.includes(`var ${fieldName}`)) {
          continue;
        }

        const fieldUseRegex = new RegExp(`(?<![\\w$.])${fieldName}(?![\\w])`, "g");
        rewritten = rewritten.replace(fieldUseRegex, `this.${fieldName}`);
      }
      lines[i] = rewritten;
    }

    depth += countChar(line, "{");
    depth -= countChar(line, "}");
  }

  return lines.join("\n");
}

function collectOwnClassFields(blockText) {
  const lines = blockText.split("\n");
  let depth = 0;
  const fieldNames = new Set();

  for (const line of lines) {
    if (depth === 1) {
      const fieldMatch = line.match(/^\s*(?:let\s+)?([A-Za-z_]\w*)\s*(?:=[^;]*)?;\s*$/);
      if (fieldMatch) {
        fieldNames.add(fieldMatch[1]);
      }
    }

    depth += countChar(line, "{");
    depth -= countChar(line, "}");
  }

  return fieldNames;
}

function countChar(text, ch) {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ch) {
      count += 1;
    }
  }
  return count;
}
