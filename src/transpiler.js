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
    new RegExp(`(^|\\n)(\\s*)(?:${TYPE_PATTERN})\\s+([^;\\n]+);`, "g"),
    (full, leadingNewline, indent, declarationBody) => {
      return `${leadingNewline}${indent}let ${declarationBody};`;
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
  code = code.replace(
    new RegExp(
      `for\\s*\\(\\s*(?:${TYPE_PATTERN}|[A-Za-z_][\\w<>\\[\\]]*)\\s+([A-Za-z_]\\w*)\\s*:\\s*([^\\)]+)\\)` ,
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
  code = code.replace(/new\s+(?:int|float|double|long|short|byte|boolean|char)\s*\[\s*([^\]]+)\s*\]/g, "new Array($1)");

  // Convert Processing println to console.log.
  code = code.replace(/\bprintln\s*\(/g, "console.log(");

  // Translate Java booleans/null naming to JS where needed.
  code = code
    .replace(/\bnull\b/g, "null")
    .replace(/\btrue\b/g, "true")
    .replace(/\bfalse\b/g, "false");

  // Remove Java casts like (int), (float), (String) in expression context.
  code = code.replace(new RegExp(`\\(\\s*(?:${TYPE_PATTERN})\\s*\\)`, "g"), "");

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
