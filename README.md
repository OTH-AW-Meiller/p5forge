# p5forge

A pragmatic transpiler that converts Processing(Java)-style code to JavaScript for p5.js.

## Goal

This is not a full Java compiler. It focuses on practical conversions that make Processing-style sketches run in p5.js quickly.

## Live Demo

GitHub Pages URL:

https://oth-aw-meiller.github.io/p5forge/

## Features (Best Effort)

- 2-stage conversion:
  1. Java/Processing syntax -> JavaScript
  2. Processing API -> p5.js API
- Java type declarations to `let`
- Method declarations to `function`
- Type annotations removed from parameters
- Java enhanced for-loops to JS `for...of`:
  - `for (int n : nums)` -> `for (const n of nums)`
- `catch (Exception e)` to `catch (e)`
- `println(...)` to `console.log(...)`
- Basic Java array creation (`new int[n]`) to `new Array(n)`
- `ArrayList<T> arr = new ArrayList<T>();` to `let arr = new Array();`
- `arr.length()` to `arr.length`
- Java `import` and `package` lines are removed
- Processing -> p5 mappings, for example:
  - `size(...)` -> `createCanvas(...)`
  - `P3D`/`OPENGL` -> `WEBGL`
- Automatic runtime import for Java-like helpers:
  - `import "./processing-defs.js";`

## Installation

```bash
npm install
```

## Browser Version (No Terminal)

Open `index.html` in your browser.

Features:

- Hacker-themed UI with a code editor look
- Input on the left, live p5.js preview on the right
- One `Run` button for transpile + render
- Shortcut: `Cmd/Ctrl + Enter`
- p5 loading strategy in preview:
  - Try local `vendor/p5.min.js` first (if present)
  - Automatically fall back to CDN if local file is missing

Current default setup: no local `vendor/p5.min.js` file committed, so preview uses the CDN fallback automatically.

## CLI Usage

```bash
node src/cli.js input.pde output.js
```

Or print to STDOUT:

```bash
node src/cli.js input.pde
```

Or via stdin:

```bash
cat input.pde | node src/cli.js --stdin
```

## Example

Input (Processing-style):

```java
int x = 0;
float speed = 2.5;

void setup() {
  size(400, 400);
}

void draw() {
  for (int i = 0; i < 10; i++) {
    println(i);
  }
}

try {
  riskyCall();
} catch (IOException e) {
  println(e);
}
```

Output (JS/p5.js):

```javascript
import "./processing-defs.js";

let x = 0;
let speed = 2.5;

function setup() {
  createCanvas(400, 400);
}

function draw() {
  for (let i = 0; i < 10; i++) {
    console.log(i);
  }
}

try {
  riskyCall();
} catch (e) {
  console.log(e);
}
```

## Limitations

- Regex-based approach, no AST parser
- Complex Java class features (overloads, inheritance, interfaces, deep generics) are not fully supported
- Not full Java semantics; optimized for a pragmatic Processing -> p5 workflow
