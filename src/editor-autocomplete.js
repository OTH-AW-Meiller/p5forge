const PROCESSING_SUGGESTIONS = [
  { insert: "setup", detail: "event: setup()", appendText: "() {\n  \n}" },
  { insert: "draw", detail: "event: draw()", appendText: "() {\n  \n}" },
  { insert: "mousePressed", detail: "event: mousePressed()", appendText: "() {\n  \n}" },
  { insert: "mouseMoved", detail: "event: mouseMoved()", appendText: "() {\n  \n}" },
  { insert: "mouseDragged", detail: "event: mouseDragged()", appendText: "() {\n  \n}" },
  { insert: "keyPressed", detail: "event: keyPressed()", appendText: "() {\n  \n}" },
  { insert: "keyReleased", detail: "event: keyReleased()", appendText: "() {\n  \n}" },
  { insert: "size", detail: "size(w, h)", appendText: "(w, h);" },
  { insert: "background", detail: "background(gray | r, g, b)", appendText: "(gray);" },
  { insert: "fill", detail: "fill(gray | r, g, b)", appendText: "(gray);" },
  { insert: "stroke", detail: "stroke(gray | r, g, b)", appendText: "(gray);" },
  { insert: "noStroke", detail: "noStroke()", appendText: "();" },
  { insert: "noFill", detail: "noFill()", appendText: "();" },
  { insert: "rect", detail: "rect(x, y, w, h)", appendText: "(x, y, w, h);" },
  { insert: "ellipse", detail: "ellipse(x, y, w, h)", appendText: "(x, y, w, h);" },
  { insert: "circle", detail: "circle(x, y, d)", appendText: "(x, y, d);" },
  { insert: "line", detail: "line(x1, y1, x2, y2)", appendText: "(x1, y1, x2, y2);" },
  { insert: "triangle", detail: "triangle(x1, y1, x2, y2, x3, y3)", appendText: "(x1, y1, x2, y2, x3, y3);" },
  { insert: "quad", detail: "quad(x1, y1, x2, y2, x3, y3, x4, y4)", appendText: "(x1, y1, x2, y2, x3, y3, x4, y4);" },
  { insert: "beginShape", detail: "beginShape()", appendText: "();" },
  { insert: "endShape", detail: "endShape([CLOSE])", appendText: "();" },
  { insert: "vertex", detail: "vertex(x, y)", appendText: "(x, y);" },
  { insert: "bezier", detail: "bezier(...)", appendText: "(x1, y1, cx1, cy1, cx2, cy2, x2, y2);" },
  { insert: "curve", detail: "curve(...)", appendText: "(x1, y1, cx1, cy1, cx2, cy2, x2, y2);" },
  { insert: "text", detail: "text(str, x, y)", appendText: "(\"text\", x, y);" },
  { insert: "textSize", detail: "textSize(size)", appendText: "(size);" },
  { insert: "textAlign", detail: "textAlign(HORIZ, [VERT])", appendText: "(LEFT);" },
  { insert: "image", detail: "image(img, x, y)", appendText: "(img, x, y);" },
  { insert: "loadImage", detail: "loadImage(path)", appendText: "(\"path/to/image.png\");" },
  { insert: "translate", detail: "translate(x, y)", appendText: "(x, y);" },
  { insert: "rotate", detail: "rotate(angle)", appendText: "(angle);" },
  { insert: "scale", detail: "scale(s)", appendText: "(s);" },
  { insert: "push", detail: "push()", appendText: "();" },
  { insert: "pop", detail: "pop()", appendText: "();" },
  { insert: "random", detail: "random(max | min, max)", appendText: "(max)" },
  { insert: "noise", detail: "noise(x[, y[, z]])", appendText: "(x)" },
  { insert: "map", detail: "map(value, a1, a2, b1, b2)", appendText: "(value, a1, a2, b1, b2)" },
  { insert: "constrain", detail: "constrain(v, min, max)", appendText: "(v, min, max)" },
  { insert: "dist", detail: "dist(x1, y1, x2, y2)", appendText: "(x1, y1, x2, y2)" },
  { insert: "colorMode", detail: "colorMode(mode, ...)", appendText: "(RGB, 255);" },
  { insert: "frameRate", detail: "frameRate(fps)", appendText: "(60);" },
  { insert: "println", detail: "println(value)", appendText: "(value);" },
  { insert: "print", detail: "print(value)", appendText: "(value);" }
];

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTokenRange(value, caret) {
  const before = value.slice(0, caret);
  const match = before.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!match) {
    return null;
  }

  const token = match[1];
  return {
    token,
    start: caret - token.length,
    end: caret
  };
}

function measureCharWidth(inputCode) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return 8;
  }

  const style = window.getComputedStyle(inputCode);
  ctx.font = `${style.fontSize} ${style.fontFamily}`;
  return Math.max(6, ctx.measureText("M").width);
}

function getProcessingReferenceUrl(entryName) {
  return `https://processing.org/reference/${entryName}_.html`;
}

function getCaretOffsetForAppend(appendText) {
  const blockMarker = "\n  \n}";
  const blockIndex = appendText.indexOf(blockMarker);
  if (blockIndex !== -1) {
    return blockIndex + 3;
  }

  return appendText.length;
}

export function createEditorAutocomplete({ inputCode }) {
  const menu = document.createElement("div");
  menu.className = "editor-autocomplete";
  menu.hidden = true;
  menu.setAttribute("role", "listbox");

  const host = inputCode.parentElement;
  host.appendChild(menu);

  let visibleSuggestions = [];
  let activeIndex = 0;
  let lastTokenRange = null;
  let charWidth = measureCharWidth(inputCode);

  function hide() {
    visibleSuggestions = [];
    activeIndex = 0;
    lastTokenRange = null;
    menu.hidden = true;
    menu.innerHTML = "";
  }

  function render() {
    if (!visibleSuggestions.length || !lastTokenRange) {
      hide();
      return;
    }

    menu.innerHTML = visibleSuggestions
      .map((entry, index) => {
        const isActive = index === activeIndex;
        const label = escapeHtml(entry.insert);
        const detail = escapeHtml(entry.detail);
        const refUrl = escapeHtml(getProcessingReferenceUrl(entry.insert));
        return `<div class="editor-autocomplete-item${isActive ? " is-active" : ""}" data-index="${index}" role="option" aria-selected="${isActive ? "true" : "false"}"><span class="editor-autocomplete-text"><span class="editor-autocomplete-label">${label}</span><span class="editor-autocomplete-detail">${detail}</span></span><button type="button" class="editor-autocomplete-help" data-url="${refUrl}" title="Open Processing reference" aria-label="Open help for ${label}">?</button></div>`;
      })
      .join("");

    const valueBeforeToken = inputCode.value.slice(0, lastTokenRange.start);
    const lines = valueBeforeToken.split("\n");
    const line = lines.length - 1;
    const column = lines[lines.length - 1].length;

    const style = window.getComputedStyle(inputCode);
    const lineHeight = parseFloat(style.lineHeight) || 21.6;
    const paddingTop = parseFloat(style.paddingTop) || 12;
    const paddingLeft = parseFloat(style.paddingLeft) || 12;
    const gutter = 52;

    const left = gutter + paddingLeft + (column * charWidth) - inputCode.scrollLeft;
    const top = paddingTop + ((line + 1) * lineHeight) - inputCode.scrollTop + 2;

    menu.style.left = `${Math.max(gutter + 6, left)}px`;
    menu.style.top = `${Math.max(36, top)}px`;
    menu.hidden = false;
  }

  function refreshSuggestions() {
    const caret = inputCode.selectionStart;
    const noSelection = inputCode.selectionStart === inputCode.selectionEnd;
    if (!noSelection) {
      hide();
      return;
    }

    const tokenRange = getTokenRange(inputCode.value, caret);
    if (!tokenRange || tokenRange.token.length < 1) {
      hide();
      return;
    }

    const tokenLower = tokenRange.token.toLowerCase();
    const matches = PROCESSING_SUGGESTIONS.filter((entry) => entry.insert.toLowerCase().startsWith(tokenLower)).slice(0, 8);

    if (!matches.length) {
      hide();
      return;
    }

    visibleSuggestions = matches;
    activeIndex = 0;
    lastTokenRange = tokenRange;
    render();
  }

  function applySuggestion(index) {
    if (!lastTokenRange || index < 0 || index >= visibleSuggestions.length) {
      return false;
    }

    const suggestion = visibleSuggestions[index];
    const before = inputCode.value.slice(0, lastTokenRange.start);
    const after = inputCode.value.slice(lastTokenRange.end);
    const appendText = suggestion.appendText || "";
    const insertion = `${suggestion.insert}${appendText}`;

    inputCode.value = `${before}${insertion}${after}`;
    const caret = before.length + suggestion.insert.length + getCaretOffsetForAppend(appendText);
    inputCode.selectionStart = caret;
    inputCode.selectionEnd = caret;

    hide();
    return true;
  }

  function handleKeydown(event) {
    if (!visibleSuggestions.length || menu.hidden) {
      return false;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % visibleSuggestions.length;
      render();
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + visibleSuggestions.length) % visibleSuggestions.length;
      render();
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      return applySuggestion(activeIndex);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      hide();
      return true;
    }

    return false;
  }

  menu.addEventListener("mousedown", (event) => {
    event.preventDefault();

    const helpButton = event.target.closest(".editor-autocomplete-help");
    if (helpButton) {
      const url = helpButton.dataset.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const target = event.target.closest(".editor-autocomplete-item");
    if (!target) {
      return;
    }

    const idx = Number.parseInt(target.dataset.index || "-1", 10);
    if (applySuggestion(idx)) {
      inputCode.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });

  inputCode.addEventListener("blur", () => {
    window.setTimeout(hide, 100);
  });

  inputCode.addEventListener("scroll", () => {
    if (visibleSuggestions.length) {
      render();
    }
  });

  inputCode.addEventListener("click", refreshSuggestions);

  window.addEventListener("resize", () => {
    charWidth = measureCharWidth(inputCode);
    if (visibleSuggestions.length) {
      render();
    }
  });

  return {
    handleKeydown,
    handleInput: refreshSuggestions,
    hide
  };
}
