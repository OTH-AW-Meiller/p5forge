/**
 * Second-stage transpiler: converts Processing-specific API calls/constants
 * in already-generated JS code to p5.js-compatible equivalents.
 */
export function transpileProcessingApiToP5(inputJsCode) {
  let code = inputJsCode;

  const compatImport = 'import "./processing-defs.js";';
  if (!code.includes(compatImport)) {
    code = `${compatImport}\n${code}`;
  }

  const callReplacements = [
    ["size", "createCanvas"],
    ["pushMatrix", "push"],
    ["popMatrix", "pop"],
    ["randomSeed", "randomSeed"],
    ["noiseSeed", "noiseSeed"]
  ];

  for (const [from, to] of callReplacements) {
    code = code.replace(new RegExp(`(?<!\\.)\\b${from}\\s*\\(`, "g"), `${to}(`);
  }

  const tokenReplacements = [
    ["P3D", "WEBGL"],
    ["OPENGL", "WEBGL"],
    ["screenWidth", "windowWidth"],
    ["screenHeight", "windowHeight"]
  ];

  for (const [from, to] of tokenReplacements) {
    code = code.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  }

  // Processing's circle-like 4-arg usage maps to p5 ellipse.
  code = code.replace(
    /\bcircle\s*\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g,
    "ellipse($1, $2, $3, $4)"
  );

  // p5 has no P2D renderer constant; 2D is default.
  code = code.replace(/\bcreateCanvas\s*\(([^,]+,[^,]+),\s*P2D\s*\)/g, "createCanvas($1)");

  // Processing keeps alpha meaningful with 3-arg colorMode calls.
  // In p5, omitted maxA can cause unexpected alpha behavior, so set maxA explicitly.
  code = code.replace(
    /\bcolorMode\s*\(\s*(HSB|RGB)\s*,\s*([^,()]+?)\s*,\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g,
    "colorMode($1, $2, $3, $4, 255)"
  );

  // Java-style length() on arrays becomes JS length property access.
  code = code.replace(/\.length\s*\(\s*\)/g, ".length");

  // Processing input state variables differ from p5 global names.
  // Only replace non-call identifier usage so callbacks like mousePressed() remain intact.
  code = code.replace(/(?<!\.)\bmousePressed\b(?!\s*\()/g, "mouseIsPressed");
  code = code.replace(/(?<!\.)\bkeyPressed\b(?!\s*\()/g, "keyIsPressed");

  return code;
}
