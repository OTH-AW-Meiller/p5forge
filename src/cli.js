#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { compileSource } from "./compiler/compiler.js";
import { transpileProcessingApiToP5 } from "./p5-post-transpiler.js";

function printUsage() {
  console.log("p5forge - Processing(Java)-style to p5.js transpiler");
  console.log("");
  console.log("Usage:");
  console.log("  p5forge <input-file> [output-file]");
  console.log("  p5forge --stdin");
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  if (args[0] === "--stdin") {
    let stdin = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      stdin += chunk;
    });
    process.stdin.on("end", () => {
      const { jsCode } = compileSource(stdin, "pde");
      process.stdout.write(transpileProcessingApiToP5(jsCode));
    });
    return;
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : null;

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(inputPath, "utf8");
  const fileType = path.extname(inputPath).toLowerCase() === ".pde" ? "pde" : "java";
  const { jsCode } = compileSource(source, fileType);
  const transpiled = transpileProcessingApiToP5(jsCode);

  if (outputPath) {
    fs.writeFileSync(outputPath, transpiled, "utf8");
    console.log(`Transpiled file written to: ${outputPath}`);
    return;
  }

  process.stdout.write(transpiled);
}

main();
