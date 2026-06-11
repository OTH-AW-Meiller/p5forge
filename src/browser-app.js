import { transpileProcessingToJs } from "./transpiler.js";
import { transpileProcessingApiToP5 } from "./p5-post-transpiler.js";

const inputCode = document.getElementById("inputCode");
const lineNumbers = document.getElementById("lineNumbers");
const sketchName = document.getElementById("sketchName");
const fileInputPde = document.getElementById("fileInputPde");
const btnLoad = document.getElementById("btnLoad");
const btnSave = document.getElementById("btnSave");
const btnStop = document.getElementById("btnStop");
const btnRun = document.getElementById("btnRun");
const statusText = document.getElementById("statusText");
const statusBar = statusText ? statusText.closest(".statusbar") : null;
const previewFrame = document.getElementById("previewFrame");
let lastStatusMessage = statusText && typeof statusText.textContent === "string" ? statusText.textContent : "";


function stopPreview() {
  previewFrame.srcdoc = `<!doctype html><html><body style="margin:0;background:#061118;"></body></html>`;
  setPreviewRunningState(false);
  setStatus("Preview stopped.");
}
const PREVIEW_MIN_HEIGHT = 320;
const PREVIEW_MAX_VIEWPORT_RATIO = 0.72;
btnStop.addEventListener("click", stopPreview);
const PREVIEW_FRAME_PADDING = 6;

function getMaxPreviewHeight() {
  return Math.max(PREVIEW_MIN_HEIGHT, Math.floor(window.innerHeight * PREVIEW_MAX_VIEWPORT_RATIO));
}

function setPreviewHeightFromCanvas(canvasHeight) {
  const desired = Number.isFinite(canvasHeight) ? Math.ceil(canvasHeight + PREVIEW_FRAME_PADDING) : PREVIEW_MIN_HEIGHT;
  const clamped = Math.min(Math.max(desired, PREVIEW_MIN_HEIGHT), getMaxPreviewHeight());
  previewFrame.style.height = `${clamped}px`;
}

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
  const nextMessage = String(message);
  const hasChanged = nextMessage !== lastStatusMessage;
  statusText.textContent = nextMessage;
  lastStatusMessage = nextMessage;

  if (hasChanged && statusBar) {
    statusBar.classList.remove("statusbar-flash");
    void statusBar.offsetWidth;
    statusBar.classList.add("statusbar-flash");
  }
}

function setPreviewRunningState(isRunning) {
  btnRun.hidden = isRunning;
  btnStop.hidden = !isRunning;
}

function updateLineNumbers() {
  const lineCount = Math.max(1, inputCode.value.split("\n").length);
  let numbers = "";
  for (let i = 1; i <= lineCount; i++) {
    numbers += `${i}\n`;
  }
  lineNumbers.textContent = numbers;
}

function autoResizeEditor() {
  inputCode.style.height = "auto";
  const nextHeight = Math.max(inputCode.scrollHeight, 320);
  inputCode.style.height = `${nextHeight}px`;
  lineNumbers.style.height = `${nextHeight}px`;
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
    setPreviewRunningState(true);
    setStatus("Run successful. Preview updated.");
  } catch (error) {
    setPreviewRunningState(false);
    setStatus(`Transpile error: ${error.message}`);
  }
}

function triggerLoadPde() {
  fileInputPde.value = "";
  fileInputPde.click();
}

async function handleLoadPde(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    inputCode.value = text;
    sketchName.value = file.name;
    updateLineNumbers();
    autoResizeEditor();
    syncLineNumberScroll();
    runTranspile();
    setStatus(`Loaded ${file.name}.`);
  } catch (error) {
    setStatus(`Load failed: ${error.message}`);
  }
}

async function savePde() {
  try {
    const content = inputCode.value ?? "";
    const filename = normalizePdeFileName(sketchName.value);
    const hasNativeSaveDialog = typeof window.showSaveFilePicker === "function";

    if (hasNativeSaveDialog) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Processing sketch",
            accept: {
              "text/plain": [".pde"]
            }
          }
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      sketchName.value = normalizePdeFileName(handle.name || filename);
      setStatus(`Saved ${sketchName.value}.`);
      return;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    sketchName.value = filename;
    setStatus(`Saved ${filename}.`);
  } catch (error) {
    if (error && error.name === "AbortError") {
      setStatus("Save canceled.");
      return;
    }

    setStatus(`Save failed: ${error.message}`);
  }
}

function normalizePdeFileName(rawName) {
  const fallback = "sketch.pde";
  const cleaned = (rawName || "").trim().replace(/[\\\\/:*?"<>|]/g, "_");
  if (!cleaned) {
    return fallback;
  }

  if (/\.pde$/i.test(cleaned)) {
    return cleaned;
  }

  return `${cleaned}.pde`;
}

function updatePreview(jsCode) {
  const previewCode = jsCode.replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "");
  setPreviewHeightFromCanvas(PREVIEW_MIN_HEIGHT);
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
        background: #061118;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      canvas {
        display: block;
        margin: auto;
      }

      body {
        font-family: Arial, sans-serif;
        position: relative;
      }

      main {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
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
      function emitStatusLog() {
        try {
          var parts = Array.prototype.slice.call(arguments).map(function (item) {
            if (typeof item === "string") {
              return item;
            }
            if (item === null || item === undefined) {
              return String(item);
            }
            try {
              return JSON.stringify(item);
            } catch {
              return String(item);
            }
          });

          if (window.parent) {
            window.parent.postMessage({
              type: "p5forge-log",
              message: parts.join(" ")
            }, "*");
          }
        } catch {
          // Ignore parent messaging errors.
        }
      }

      (function patchLogging() {
        var originalConsoleLog = console.log ? console.log.bind(console) : null;
        console.log = function patchedConsoleLog() {
          emitStatusLog.apply(null, arguments);
          if (originalConsoleLog) {
            originalConsoleLog.apply(null, arguments);
          }
        };

        // Processing-style print helpers for code that still calls print/println.
        window.print = function p5forgePrint() {
          emitStatusLog.apply(null, arguments);
        };
        window.println = function p5forgePrintln() {
          emitStatusLog.apply(null, arguments);
        };
      })();

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
        if (window.p5 && window.p5.prototype && !window.__p5forgePatchedCreateCanvas) {
          const originalCreateCanvas = window.p5.prototype.createCanvas;
          window.p5.prototype.createCanvas = function patchedCreateCanvas(width, height, ...rest) {
            const canvas = originalCreateCanvas.call(this, width, height, ...rest);
            try {
              if (window.parent && Number.isFinite(width) && Number.isFinite(height)) {
                window.parent.postMessage({
                  type: "p5forge-canvas-size",
                  width,
                  height
                }, "*");
              }
            } catch {
              // Ignore cross-context messaging issues.
            }
            return canvas;
          };
          window.__p5forgePatchedCreateCanvas = true;
        }

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

btnLoad.addEventListener("click", triggerLoadPde);
btnSave.addEventListener("click", savePde);
btnRun.addEventListener("click", runTranspile);
fileInputPde.addEventListener("change", handleLoadPde);

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || !data.type) {
    return;
  }

  if (data.type === "p5forge-canvas-size") {
    setPreviewHeightFromCanvas(data.height);
    return;
  }

  if (data.type === "p5forge-log") {
    const message = typeof data.message === "string" ? data.message : String(data.message);
    setStatus(`Sketch output: ${message}`);
  }
});

window.addEventListener("resize", () => {
  const currentHeight = parseInt(previewFrame.style.height || `${PREVIEW_MIN_HEIGHT}`, 10);
  setPreviewHeightFromCanvas(currentHeight - PREVIEW_FRAME_PADDING);
});

inputCode.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "enter") {
    runTranspile();
  }
});

inputCode.addEventListener("input", updateLineNumbers);
inputCode.addEventListener("input", autoResizeEditor);
inputCode.addEventListener("scroll", syncLineNumberScroll);

inputCode.value = SAMPLE;
updateLineNumbers();
autoResizeEditor();
setPreviewRunningState(false);
runTranspile();
