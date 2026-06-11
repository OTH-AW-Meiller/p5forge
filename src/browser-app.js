import { transpileProcessingToJs } from "./transpiler.js";
import { transpileProcessingApiToP5 } from "./p5-post-transpiler.js";

const inputCode = document.getElementById("inputCode");
const lineNumbers = document.getElementById("lineNumbers");
const btnRun = document.getElementById("btnRun");
const statusText = document.getElementById("statusText");
const previewFrame = document.getElementById("previewFrame");

const SAMPLE = `int particles = 80;
float drift = 0.0;

void setup() {
  size(820, 520);
  colorMode(HSB, 360, 100, 100, 100);
  background(220, 35, 10);
  noStroke();
}

void draw() {
  fill(220, 35, 10, 8);
  rect(0, 0, width, height);

  for (int i = 0; i < particles; i++) {
    float t = frameCount * 0.01 + i * 0.17 + drift;
    float x = noise(t, 31.2) * width;
    float y = noise(77.8, t) * height;
    float d = 8 + noise(t, t * 1.7) * 70;
    float hue = (frameCount * 0.7 + i * 5) % 360;
    fill(hue, 80, 100, 45);
    circle(x, y, d);
  }
}

void mousePressed() {
  background(220, 35, 10);
  drift = random(0, 1000);
}`;

function setStatus(message) {
  statusText.textContent = message;
}

function updateLineNumbers() {
  const lineCount = Math.max(1, inputCode.value.split("\n").length);
  let numbers = "";
  for (let i = 1; i <= lineCount; i++) {
    numbers += `${i}\n`;
  }
  lineNumbers.textContent = numbers;
}

function syncLineNumberScroll() {
  lineNumbers.scrollTop = inputCode.scrollTop;
}

function runTranspile() {
  try {
    const source = inputCode.value ?? "";
    const stage1 = transpileProcessingToJs(source);
    const runnableCode = transpileProcessingApiToP5(stage1);
    updatePreview(runnableCode);
    setStatus("Run successful. Preview updated.");
  } catch (error) {
    setStatus(`Transpile error: ${error.message}`);
  }
}

function updatePreview(jsCode) {
  const previewCode = jsCode.replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "");
  const doc = createPreviewHtml(previewCode);
  previewFrame.srcdoc = doc;
}

function createPreviewHtml(jsCode) {
  const escapedCode = jsCode.replace(/<\/script>/gi, "<\\/script>");
  const serializedCode = JSON.stringify(escapedCode);

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #f5f5f5;
      }

      body {
        font-family: Arial, sans-serif;
      }

      #error {
        position: fixed;
        left: 8px;
        bottom: 8px;
        max-width: calc(100% - 16px);
        padding: 8px 10px;
        background: rgba(160, 26, 26, 0.92);
        color: #fff;
        border-radius: 6px;
        font-size: 12px;
        white-space: pre-wrap;
        display: none;
        z-index: 9999;
      }
    </style>
  </head>
  <body>
    <div id="error"></div>
    <script>
      window.addEventListener("error", function (event) {
        var el = document.getElementById("error");
        el.style.display = "block";
        el.textContent = "Preview error: " + (event.message || "Unknown error");
      });
    <\/script>
    <script src="./processing-defs.js"><\/script>
    <script>
      function loadScript(src, onLoad, onError) {
        var script = document.createElement("script");
        script.src = src;
        script.onload = onLoad;
        script.onerror = onError;
        document.head.appendChild(script);
      }

      function showBootError(message) {
        var el = document.getElementById("error");
        el.style.display = "block";
        el.textContent = message;
      }

      function runSketch() {
        var sketchCode = ${serializedCode};
        var sketchScript = document.createElement("script");
        sketchScript.textContent = sketchCode;
        document.body.appendChild(sketchScript);
      }

      function loadP5AndRun() {
        loadScript(
          "./vendor/p5.min.js",
          runSketch,
          function () {
            loadScript(
              "https://cdn.jsdelivr.net/npm/p5@1.9.4/lib/p5.min.js",
              runSketch,
              function () {
                showBootError("Failed to load p5.js from local vendor and CDN.");
              }
            );
          }
        );
      }

      loadP5AndRun();
    <\/script>
  </body>
</html>`;
}

btnRun.addEventListener("click", runTranspile);

inputCode.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "enter") {
    runTranspile();
  }
});

inputCode.addEventListener("input", updateLineNumbers);
inputCode.addEventListener("scroll", syncLineNumberScroll);

inputCode.value = SAMPLE;
updateLineNumbers();
runTranspile();
