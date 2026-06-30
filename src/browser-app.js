import { compileSource } from "./compiler/compiler.js";
import { transpileProcessingApiToP5 } from "./p5-post-transpiler.js";
import { createPreviewHtml } from "./preview-template.js";
import { bindEditorKeyHandlers, bindGlobalHotkeys } from "./keyboard-handlers.js";
import { createEditorAutocomplete } from "./editor-autocomplete.js";
import { highlightToHtml } from "./editor-highlight.js";
import { createZipBlob } from "./zip.js";

const inputCode = document.getElementById("inputCode");
const lineNumbers = document.getElementById("lineNumbers");
const highlightLayer = document.getElementById("highlightLayer");
const tabStrip = document.getElementById("tabStrip");
const btnAddTab = document.getElementById("btnAddTab");
const fileInputPde = document.getElementById("fileInputPde");
const btnLoad = document.getElementById("btnLoad");
const btnSave = document.getElementById("btnSave");
const btnExportJs = document.getElementById("btnExportJs");
const btnExportProcessing = document.getElementById("btnExportProcessing");
const btnHelp = document.getElementById("btnHelp");
const appMenu = document.getElementById("appMenu");
const btnMenu = document.getElementById("btnMenu");
const menuDropdown = document.getElementById("menuDropdown");
const btnAbout = document.getElementById("btnAbout");
const aboutDialog = document.getElementById("aboutDialog");
const btnAboutClose = document.getElementById("btnAboutClose");
const aboutVersion = document.getElementById("aboutVersion");
const btnRun = document.getElementById("btnRun");
const consoleLog = document.getElementById("consoleLog");
const previewFrame = document.getElementById("previewFrame");
const previewWindow = document.getElementById("previewWindow");
const previewTitlebar = document.getElementById("previewTitlebar");
const previewTitle = document.getElementById("previewTitle");
const btnPreviewClose = document.getElementById("btnPreviewClose");
const editorAutocomplete = createEditorAutocomplete({ inputCode });
const MAX_CONSOLE_LINES = 200;
const SAMPLE_FILE_PATH = "./sample.pde";
const APP_VERSION = "0.1.0";
const PLAY_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 6L19 12L8 18Z" /></svg>';
const STOP_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>';

// ---------------------------------------------------------------------------
// Tabs — each tab is one Processing-style source file. Only the active tab is
// shown in the (single) textarea; switching tabs swaps the text. On compile,
// every tab's code is concatenated in tab order into one program.
// ---------------------------------------------------------------------------
let tabs = [];
let activeTabId = null;
let tabSeq = 0;

function makeTab(name, code) {
  tabSeq += 1;
  return { id: `tab-${tabSeq}`, name, code: code ?? "" };
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) ?? null;
}

function mainSketchName() {
  return tabs.length > 0 ? tabs[0].name : "sketch.pde";
}

function defaultTabName() {
  let n = tabs.length + 1;
  let name = `tab${n}.pde`;
  while (tabs.some((tab) => tab.name === name)) {
    n += 1;
    name = `tab${n}.pde`;
  }
  return name;
}

// Persist the textarea's current text back into the active tab's model.
function commitEditorToActiveTab() {
  const tab = getActiveTab();
  if (tab) {
    tab.code = inputCode.value;
  }
}

function loadActiveTabIntoEditor() {
  const tab = getActiveTab();
  inputCode.value = tab ? tab.code : "";
  updateLineNumbers();
  updateHighlight();
  syncLineNumberScroll();
}

function setActiveTab(id) {
  if (id === activeTabId) {
    return;
  }
  commitEditorToActiveTab();
  activeTabId = id;
  loadActiveTabIntoEditor();
  renderTabs();
}

function addTab() {
  commitEditorToActiveTab();
  const tab = makeTab(defaultTabName(), "");
  tabs.push(tab);
  activeTabId = tab.id;
  loadActiveTabIntoEditor();
  renderTabs();
  stopPreviewOnEdit();
}

function closeTab(id) {
  if (tabs.length <= 1) {
    return;
  }
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) {
    return;
  }
  const wasActive = id === activeTabId;
  tabs.splice(index, 1);
  if (wasActive) {
    activeTabId = tabs[Math.max(0, index - 1)].id;
    loadActiveTabIntoEditor();
  }
  renderTabs();
  stopPreviewOnEdit();
}

// Combined source of all tabs, in order, for compilation.
function getCombinedSource() {
  commitEditorToActiveTab();
  return tabs.map((tab) => tab.code).join("\n\n");
}

function beginRenameTab(tab, tabEl, nameButton) {
  const input = document.createElement("input");
  input.className = "tab-rename";
  input.value = tab.name;
  tabEl.replaceChild(input, nameButton);
  input.focus();
  input.select();

  let finished = false;
  const finish = (save) => {
    if (finished) {
      return;
    }
    finished = true;
    if (save) {
      const value = input.value.trim();
      if (value) {
        tab.name = value;
      }
    }
    renderTabs();
    refreshPreviewTitle();
  };

  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
}

function renderTabs() {
  if (!tabStrip) {
    return;
  }
  tabStrip.textContent = "";
  for (const tab of tabs) {
    const tabEl = document.createElement("div");
    tabEl.className = "editor-tab" + (tab.id === activeTabId ? " is-active" : "");
    tabEl.dataset.id = tab.id;
    tabEl.setAttribute("role", "tab");

    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = "tab-name";
    nameButton.textContent = tab.name;
    nameButton.title = "Click to open, double-click to rename";
    nameButton.addEventListener("click", () => setActiveTab(tab.id));
    nameButton.addEventListener("dblclick", () => beginRenameTab(tab, tabEl, nameButton));
    tabEl.appendChild(nameButton);

    if (tabs.length > 1) {
      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "tab-close";
      closeButton.textContent = "×";
      closeButton.title = "Close tab";
      closeButton.setAttribute("aria-label", `Close ${tab.name}`);
      closeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        closeTab(tab.id);
      });
      tabEl.appendChild(closeButton);
    }

    tabStrip.appendChild(tabEl);
  }
}

function refreshPreviewTitle() {
  if (previewTitle && btnRun.dataset.running === "true") {
    previewTitle.textContent = normalizePdeFileName(mainSketchName()).replace(/\.pde$/i, "");
  }
}


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

// Appends a line to the console-style status area and scrolls to the bottom.
function setStatus(message) {
  if (!consoleLog) {
    return;
  }
  const line = document.createElement("div");
  line.className = "console-line";
  line.textContent = String(message);
  consoleLog.appendChild(line);

  while (consoleLog.childElementCount > MAX_CONSOLE_LINES) {
    consoleLog.removeChild(consoleLog.firstElementChild);
  }

  consoleLog.scrollTop = consoleLog.scrollHeight;
}

function setPreviewRunningState(isRunning) {
  btnRun.classList.toggle("btn-danger", isRunning);
  btnRun.setAttribute("aria-label", isRunning ? "Stop preview" : "Run preview");
  btnRun.setAttribute("title", isRunning ? "Stop (F5)" : "Run (F5)");
  btnRun.dataset.running = isRunning ? "true" : "false";
  btnRun.innerHTML = isRunning ? STOP_ICON_SVG : PLAY_ICON_SVG;
  document.body.classList.toggle("preview-running", isRunning);
  if (isRunning && previewTitle) {
    previewTitle.textContent = normalizePdeFileName(mainSketchName()).replace(/\.pde$/i, "");
  }
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
  if (highlightLayer) {
    highlightLayer.scrollTop = inputCode.scrollTop;
    highlightLayer.scrollLeft = inputCode.scrollLeft;
  }
}

function updateHighlight() {
  if (highlightLayer) {
    highlightLayer.innerHTML = highlightToHtml(inputCode.value);
  }
}

function clearConsole() {
  if (consoleLog) {
    consoleLog.textContent = "";
  }
}

function runTranspile() {
  // Each (re)start of the sketch begins with a fresh console.
  clearConsole();
  try {
    const source = getCombinedSource();
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

function closeMenu() {
  if (!menuDropdown || menuDropdown.hidden) {
    return;
  }
  menuDropdown.hidden = true;
  document.body.classList.remove("menu-open");
  if (btnMenu) {
    btnMenu.setAttribute("aria-expanded", "false");
  }
}

function toggleMenu() {
  if (!menuDropdown) {
    return;
  }
  const open = menuDropdown.hidden;
  menuDropdown.hidden = !open;
  document.body.classList.toggle("menu-open", open);
  if (btnMenu) {
    btnMenu.setAttribute("aria-expanded", open ? "true" : "false");
  }
}

function openAbout() {
  if (!aboutDialog) {
    return;
  }
  if (aboutVersion) {
    aboutVersion.textContent = APP_VERSION;
  }
  if (typeof aboutDialog.showModal === "function") {
    aboutDialog.showModal();
  } else {
    aboutDialog.setAttribute("open", "");
  }
}

function closeAbout() {
  if (!aboutDialog) {
    return;
  }
  if (typeof aboutDialog.close === "function") {
    aboutDialog.close();
  } else {
    aboutDialog.removeAttribute("open");
  }
}

async function handleLoadPde(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const tab = getActiveTab();
    if (tab) {
      tab.name = file.name;
      tab.code = text;
      loadActiveTabIntoEditor();
      renderTabs();
    }
    runTranspile();
    setStatus(`Loaded ${file.name}.`);
  } catch (error) {
    setStatus(`Load failed: ${error.message}`);
  }
}

async function savePde() {
  try {
    commitEditorToActiveTab();
    const activeTab = getActiveTab();
    const content = activeTab ? activeTab.code : "";
    const filename = normalizePdeFileName(activeTab ? activeTab.name : mainSketchName());
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
      const savedName = normalizePdeFileName(handle.name || filename);
      if (activeTab) {
        activeTab.name = savedName;
        renderTabs();
        refreshPreviewTitle();
      }
      setStatus(`Saved ${savedName}.`);
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
    if (activeTab) {
      activeTab.name = filename;
      renderTabs();
      refreshPreviewTitle();
    }
    setStatus(`Saved ${filename}.`);
  } catch (error) {
    if (error && error.name === "AbortError") {
      setStatus("Save canceled.");
      return;
    }

    setStatus(`Save failed: ${error.message}`);
  }
}

const P5_CDN_URL = "https://cdn.jsdelivr.net/npm/p5@2.3.0/lib/p5.min.js";

function buildProjectIndexHtml(title) {
  const safeTitle = String(title).replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch]));
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <style>
      html, body { margin: 0; padding: 0; background: #061118; }
      canvas { display: block; margin: 0 auto; }
    </style>
  </head>
  <body>
    <!-- p5.js 2.x -->
    <script src="${P5_CDN_URL}"></script>
    <!-- Processing-style runtime helpers (PVector, PShape, ArrayList, ...) -->
    <script src="processing-defs.js"></script>
    <!-- Processing print helpers (p5 has no println) -->
    <script>
      if (typeof window.println !== "function") {
        window.println = function () { console.log.apply(console, arguments); };
      }
    </script>
    <!-- Transpiled sketch -->
    <script src="sketch.js"></script>
  </body>
</html>
`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Project / ZIP name derived from the first tab, with any extension removed
// and made filename-safe.
function projectBaseName() {
  const stripped = (mainSketchName() || "").trim().replace(/\.(pde|js)$/i, "");
  const safe = stripped.replace(/[\\/:*?"<>|]/g, "_").trim();
  return safe || "sketch";
}

async function exportP5Project() {
  try {
    const source = getCombinedSource();
    const { jsCode } = compileSource(source, "pde");
    const runnableCode = transpileProcessingApiToP5(jsCode);
    // Drop the ESM import line; the project loads processing-defs.js via a
    // <script> tag instead.
    const sketchJs = runnableCode
      .replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "")
      .replace(/^\n+/, "");

    const baseName = projectBaseName();

    const defsResponse = await fetch("./processing-defs.js", { cache: "no-store" });
    if (!defsResponse.ok) {
      throw new Error(`Could not load processing-defs.js (HTTP ${defsResponse.status})`);
    }
    const processingDefs = await defsResponse.text();

    const blob = createZipBlob([
      { name: "index.html", content: buildProjectIndexHtml(baseName) },
      { name: "sketch.js", content: sketchJs },
      { name: "processing-defs.js", content: processingDefs }
    ]);

    downloadBlob(blob, `${baseName}.zip`);
    setStatus(`Exported ${baseName}.zip (p5.js project).`);
  } catch (error) {
    setStatus(`Export failed: ${error.message}`);
  }
}

// Exports the tabs as a Processing sketch folder: one .pde file per tab inside
// a folder named after the sketch, with the main (first) tab's file matching
// the folder name — the layout Processing expects.
function exportProcessingProject() {
  try {
    commitEditorToActiveTab();
    const base = projectBaseName();
    const usedNames = new Set();

    const files = tabs.map((tab, index) => {
      const wanted = index === 0 ? `${base}.pde` : normalizePdeFileName(tab.name);
      let candidate = wanted;
      let suffix = 2;
      while (usedNames.has(candidate.toLowerCase())) {
        candidate = `${wanted.replace(/\.pde$/i, "")}_${suffix}.pde`;
        suffix += 1;
      }
      usedNames.add(candidate.toLowerCase());
      return { name: `${base}/${candidate}`, content: tab.code };
    });

    const blob = createZipBlob(files);
    downloadBlob(blob, `${base}.zip`);
    setStatus(`Exported ${base}.zip (Processing project).`);
  } catch (error) {
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
btnExportJs.addEventListener("click", exportP5Project);
btnExportProcessing.addEventListener("click", exportProcessingProject);
btnHelp.addEventListener("click", openProcessingReference);
btnRun.addEventListener("click", togglePreviewRunState);
fileInputPde.addEventListener("change", handleLoadPde);

if (btnMenu) {
  btnMenu.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu();
  });
}

if (menuDropdown) {
  // Any menu item closes the menu after its own click handler runs.
  menuDropdown.addEventListener("click", (event) => {
    if (event.target.closest(".menu-item")) {
      closeMenu();
    }
  });
}

if (btnAbout) {
  btnAbout.addEventListener("click", openAbout);
}

if (btnAboutClose) {
  btnAboutClose.addEventListener("click", closeAbout);
}

if (aboutDialog) {
  // Close when clicking the backdrop (outside the content box).
  aboutDialog.addEventListener("click", (event) => {
    if (event.target === aboutDialog) {
      closeAbout();
    }
  });
}

document.addEventListener("click", (event) => {
  if (appMenu && !appMenu.contains(event.target)) {
    closeMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
  }
});

if (btnPreviewClose) {
  btnPreviewClose.addEventListener("click", stopPreview);
}

if (btnAddTab) {
  btnAddTab.addEventListener("click", addTab);
}

// Floating preview window: drag it around by its titlebar (desktop only).
if (previewTitlebar && previewWindow) {
  const desktopQuery = window.matchMedia("(min-width: 901px)");
  let drag = null;

  previewTitlebar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !desktopQuery.matches) {
      return;
    }
    if (event.target.closest(".preview-close")) {
      return;
    }
    const rect = previewWindow.getBoundingClientRect();
    drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    previewWindow.style.left = `${rect.left}px`;
    previewWindow.style.top = `${rect.top}px`;
    previewWindow.style.right = "auto";
    previewTitlebar.setPointerCapture(event.pointerId);
  });

  previewTitlebar.addEventListener("pointermove", (event) => {
    if (!drag) {
      return;
    }
    const x = Math.max(0, Math.min(event.clientX - drag.dx, window.innerWidth - 48));
    const y = Math.max(0, Math.min(event.clientY - drag.dy, window.innerHeight - 48));
    previewWindow.style.left = `${x}px`;
    previewWindow.style.top = `${y}px`;
  });

  const endDrag = (event) => {
    if (!drag) {
      return;
    }
    drag = null;
    if (previewTitlebar.hasPointerCapture(event.pointerId)) {
      previewTitlebar.releasePointerCapture(event.pointerId);
    }
  };
  previewTitlebar.addEventListener("pointerup", endDrag);
  previewTitlebar.addEventListener("pointercancel", endDrag);
}

bindGlobalHotkeys({ onToggleRun: togglePreviewRunState });

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || !data.type) {
    return;
  }

  if (data.type === "p5forge-canvas-size") {
    setPreviewHeightFromCanvas(data.height);
    if (previewWindow && Number.isFinite(data.width)) {
      previewWindow.style.setProperty("--canvas-w", `${Math.ceil(data.width)}px`);
    }
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
    updateHighlight();
    syncLineNumberScroll();
  }
});

inputCode.addEventListener("input", stopPreviewOnEdit);
inputCode.addEventListener("input", updateLineNumbers);
inputCode.addEventListener("input", updateHighlight);
inputCode.addEventListener("input", editorAutocomplete.handleInput);
inputCode.addEventListener("scroll", syncLineNumberScroll);

async function initializeApp() {
  const sampleSource = await loadInitialSample();
  tabs = [makeTab("sketch.pde", sampleSource || "")];
  activeTabId = tabs[0].id;
  renderTabs();
  loadActiveTabIntoEditor();
  // Start stopped: the sketch only runs when the user presses Play (F5).
  setPreviewRunningState(false);

  if (sampleSource !== null) {
    setStatus("Ready. Press Play (F5) to run.");
    return;
  }

  setStatus("Sample file could not be loaded.");
}

initializeApp();
