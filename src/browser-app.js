import { compileSource } from "./compiler/compiler.js";
import { transpileProcessingApiToP5 } from "./p5-post-transpiler.js";
import { createPreviewHtml } from "./preview-template.js";
import { bindEditorKeyHandlers, bindGlobalHotkeys } from "./keyboard-handlers.js";
import { createEditorAutocomplete } from "./editor-autocomplete.js";

const inputCode = document.getElementById("inputCode");
const lineNumbers = document.getElementById("lineNumbers");
const sketchName = document.getElementById("sketchName");
const fileInputPde = document.getElementById("fileInputPde");
const btnLoad = document.getElementById("btnLoad");
const btnSave = document.getElementById("btnSave");
const btnExportJs = document.getElementById("btnExportJs");
const btnHelp = document.getElementById("btnHelp");
const btnRun = document.getElementById("btnRun");
const statusText = document.getElementById("statusText");
const statusBar = statusText ? statusText.closest(".statusbar") : null;
const previewFrame = document.getElementById("previewFrame");
const editorAutocomplete = createEditorAutocomplete({ inputCode });
let lastStatusMessage = statusText && typeof statusText.textContent === "string" ? statusText.textContent : "";
const SAMPLE_FILE_PATH = "./sample.pde";
const PLAY_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 6L19 12L8 18Z" /></svg>';
const STOP_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>';


function stopPreview() {
  previewFrame.srcdoc = `<!doctype html><html><body style="margin:0;background:#061118;"></body></html>`;
  setPreviewRunningState(false);
  setStatus("Preview stopped.");
}
const PREVIEW_MIN_HEIGHT = 320;
const PREVIEW_MAX_VIEWPORT_RATIO = 0.72;
const PREVIEW_FRAME_PADDING = 6;

function getMaxPreviewHeight() {
  return Math.max(PREVIEW_MIN_HEIGHT, Math.floor(window.innerHeight * PREVIEW_MAX_VIEWPORT_RATIO));
}

function setPreviewHeightFromCanvas(canvasHeight) {
  const desired = Number.isFinite(canvasHeight) ? Math.ceil(canvasHeight + PREVIEW_FRAME_PADDING) : PREVIEW_MIN_HEIGHT;
  const clamped = Math.min(Math.max(desired, PREVIEW_MIN_HEIGHT), getMaxPreviewHeight());
  previewFrame.style.height = `${clamped}px`;
}

async function loadInitialSample() {
  try {
    const response = await fetch(SAMPLE_FILE_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch {
    return null;
  }
}

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
  btnRun.classList.toggle("btn-danger", isRunning);
  btnRun.setAttribute("aria-label", isRunning ? "Stop preview" : "Run preview");
  btnRun.setAttribute("title", isRunning ? "Stop (F5)" : "Run (F5)");
  btnRun.dataset.running = isRunning ? "true" : "false";
  btnRun.innerHTML = isRunning ? STOP_ICON_SVG : PLAY_ICON_SVG;
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
    const { jsCode } = compileSource(source, "pde");
    const runnableCode = transpileProcessingApiToP5(jsCode);
    updatePreview(runnableCode);
    setPreviewRunningState(true);
    setStatus("Run successful. Preview updated.");
  } catch (error) {
    setPreviewRunningState(false);
    setStatus(`Transpile error: ${error.message}`);
  }
}

function togglePreviewRunState() {
  if (btnRun.dataset.running === "true") {
    stopPreview();
    return;
  }

  runTranspile();
}

function stopPreviewOnEdit() {
  if (btnRun.dataset.running === "true") {
    stopPreview();
    setStatus("Preview stopped. Code changed.");
  }
}

function triggerLoadPde() {
  fileInputPde.value = "";
  fileInputPde.click();
}

function openProcessingReference() {
  window.open("https://processing.org/reference/", "_blank", "noopener,noreferrer");
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

async function exportTranspiledJs() {
  try {
    const source = inputCode.value ?? "";
    const { jsCode } = compileSource(source, "pde");
    const runnableCode = transpileProcessingApiToP5(jsCode);
    const filename = normalizeJsFileName(sketchName.value);
    const hasNativeSaveDialog = typeof window.showSaveFilePicker === "function";

    if (hasNativeSaveDialog) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "JavaScript file",
            accept: {
              "text/javascript": [".js"]
            }
          }
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(runnableCode);
      await writable.close();
      setStatus(`Exported ${handle.name || filename}.`);
      return;
    }

    const blob = new Blob([runnableCode], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus(`Exported ${filename}.`);
  } catch (error) {
    if (error && error.name === "AbortError") {
      setStatus("Export canceled.");
      return;
    }

    setStatus(`Export failed: ${error.message}`);
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

function normalizeJsFileName(rawName) {
  const base = normalizePdeFileName(rawName).replace(/\.pde$/i, "");
  return `${base}.js`;
}

function updatePreview(jsCode) {
  const previewCode = jsCode.replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "");
  setPreviewHeightFromCanvas(PREVIEW_MIN_HEIGHT);
  const doc = createPreviewHtml(previewCode);
  previewFrame.srcdoc = doc;
}

btnLoad.addEventListener("click", triggerLoadPde);
btnSave.addEventListener("click", savePde);
btnExportJs.addEventListener("click", exportTranspiledJs);
btnHelp.addEventListener("click", openProcessingReference);
btnRun.addEventListener("click", togglePreviewRunState);
fileInputPde.addEventListener("change", handleLoadPde);

bindGlobalHotkeys({ onToggleRun: togglePreviewRunState });

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

bindEditorKeyHandlers({
  inputCode,
  onRun: runTranspile,
  autocomplete: editorAutocomplete,
  onAfterEdit: () => {
    stopPreviewOnEdit();
    updateLineNumbers();
    autoResizeEditor();
    syncLineNumberScroll();
  }
});

inputCode.addEventListener("input", stopPreviewOnEdit);
inputCode.addEventListener("input", updateLineNumbers);
inputCode.addEventListener("input", autoResizeEditor);
inputCode.addEventListener("input", editorAutocomplete.handleInput);
inputCode.addEventListener("scroll", syncLineNumberScroll);

async function initializeApp() {
  const sampleSource = await loadInitialSample();
  inputCode.value = sampleSource || "";
  updateLineNumbers();
  autoResizeEditor();
  setPreviewRunningState(false);

  if (sampleSource !== null) {
    runTranspile();
    return;
  }

  stopPreview();
  setStatus("Sample file could not be loaded.");
}

initializeApp();
