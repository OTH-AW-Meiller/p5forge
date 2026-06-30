# p5forge

AST-based Processing(Java)-to-p5.js compiler with browser preview and CLI.

## Goal

p5forge is not a full Java compiler. The focus is on practical, robust conversion of Processing sketches into runnable JavaScript for p5.js.

## Live Demo

https://oth-aw-meiller.github.io/p5forge/

## Architecture

The build has two stages:

1. AST compiler (`src/compiler/*`)
1. p5 post-transpiler (`src/p5-post-transpiler.js`)

### 1) AST Compiler

Pipeline:

1. `tokenizer.js` tokenizes the source code.
1. `parser.js` builds an AST for classes, members, statements, and expressions.
1. `semantics.js` validates types and core language rules.
1. `generator.js` emits JavaScript from the AST.

Key capabilities:

- File-type aware compilation (`java` or `pde`) in `compileSource(source, fileType)`.
- For `pde`, parser-compatible normalization is applied when needed:
  - Top-level sketch code is normalized so parsing remains class-based internally.
  - `setup()` is added if missing.
  - Additional user-defined classes, abstract classes, interfaces, and enums in `.pde` files are preserved.
- The internal synthetic wrapper (used only for parsing) is flattened again during JS generation:
  - Output uses global `setup()/draw()/...` functions like idiomatic Processing/p5 global mode.
  - No runtime sketch-instance wrapper is required.
- Scope-aware field binding in instance methods/constructors:
  - Bare field identifiers are resolved to `this.<field>`.
  - Bare instance method calls are resolved to `this.<method>()` when needed.
  - Inherited instance fields and methods are also resolved correctly across class hierarchies.
- Java-style enums are supported:
  - Top-level enum declarations compile in both `java` and `pde` mode.
  - Enum constants may have constructor arguments.
  - Enum fields, methods, constructors, `values()`, and `valueOf(name)` are supported.
- Java-style interfaces are supported:
  - Top-level interface declarations compile in both `java` and `pde` mode.
  - Classes may use `implements` and interfaces may use `extends`.
  - Interface method signatures are validated against implementing classes, including inherited implementations.
  - Interfaces are compile-time only and do not emit runtime JavaScript.
- Java-style abstract classes are supported:
  - Top-level `abstract class` declarations compile in both `java` and `pde` mode.
  - Abstract methods may be declared without a body.
  - Abstract classes may carry interface contracts that concrete subclasses fulfill later.
  - Concrete subclasses must implement inherited abstract methods.
  - Abstract methods are compile-time only and do not emit runtime JavaScript.
- Control-flow coverage includes `if`, `while`, `for`, enhanced `for`, `try/catch/finally`, `switch/case/default`, and `break`.
- Java-style field declarations with multiple names are supported (for example `float x, y;`).
- Expression grouping is preserved correctly (parenthesized output where needed).

### 2) p5 Post-Transpiler

After AST generation, p5 API mappings are applied:

- `size(...) -> createCanvas(...)`
- `P3D`/`OPENGL -> WEBGL`
- 4-arg `circle(...) -> ellipse(...)`
- `arr.length() -> arr.length`
- `mousePressed` (state variable) -> `mouseIsPressed` (callable `mousePressed()` callback is preserved)
- `keyPressed` (state variable) -> `keyIsPressed` (callable `keyPressed()` callback is preserved)
- `colorMode(HSB|RGB, a, b, c) -> colorMode(HSB|RGB, a, b, c, 255)` for predictable alpha behavior
- Adds `import "./processing-defs.js";`

## Installation

```bash
npm install
```

## Browser Version

Open `index.html` or serve the project locally via an HTTP server.

Features:

- Editor + live preview
- `Run/Stop` Toggle
- `F5` Hotkey
- Autocomplete for Processing commands
- Preview stops after code edits
- Help button opens the Processing reference

p5.js loading strategy:

1. local `vendor/p5.min.js`
1. fallback to CDN

## CLI

Transpile to file:

```bash
node src/cli.js input.pde output.js
```

Print to STDOUT:

```bash
node src/cli.js input.pde
```

Via stdin:

```bash
cat input.pde | node src/cli.js --stdin
```

## Example

Input (Processing/pde):

```java
int particles = 80;
float drift = 0.0;

void setup() {
  size(820, 520);
}

void draw() {
  for (int i = 0; i < particles; i++) {
    float hue = (frameCount * 0.7 + i * 5) % 360;
    fill(hue, 80, 100, 45);
    circle(100, 100, 20, 20);
  }
}
```

Output (shortened):

```javascript
import "./processing-defs.js";

let particles = 80;
let drift = 0;

function setup() {
  createCanvas(820, 520);
}

function draw() {
  for (let i = 0; i < particles; i++) {
    let hue = (((frameCount * 0.7) + (i * 5)) % 360);
    fill(hue, 80, 100, 45);
    ellipse(100, 100, 20, 20);
  }
}
```

## Current Limitations

- Not a full Java frontend; advanced Java language features are still only partially supported.
- Enum constant-specific class bodies are not supported yet (for example `A { ... }` inside an enum).
- Interface default methods and other runtime-bearing interface features are not supported yet.
- Abstract methods outside abstract classes are rejected.
- Full Java override compatibility checks are still pragmatic rather than exhaustive.
- Semantic validation is intentionally pragmatic and optimized for sketch use cases.
- Focus is Processing/p5 workflows, not full general-purpose Java compatibility.
