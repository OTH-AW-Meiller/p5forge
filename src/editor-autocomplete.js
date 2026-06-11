const PROCESSING_SUGGESTIONS = [
  { insert: "setup", detail: "event: setup()", appendParen: false },
  { insert: "draw", detail: "event: draw()", appendParen: false },
  { insert: "mousePressed", detail: "event: mousePressed()", appendParen: false },
  { insert: "mouseMoved", detail: "event: mouseMoved()", appendParen: false },
  { insert: "mouseDragged", detail: "event: mouseDragged()", appendParen: false },
  { insert: "keyPressed", detail: "event: keyPressed()", appendParen: false },
  { insert: "keyReleased", detail: "event: keyReleased()", appendParen: false },
  { insert: "size", detail: "size(w, h)", appendParen: true },
  { insert: "background", detail: "background(gray | r, g, b)", appendParen: true },
  { insert: "fill", detail: "fill(gray | r, g, b)", appendParen: true },
  { insert: "stroke", detail: "stroke(gray | r, g, b)", appendParen: true },
  { insert: "noStroke", detail: "noStroke()", appendParen: true },
  { insert: "noFill", detail: "noFill()", appendParen: true },
  { insert: "rect", detail: "rect(x, y, w, h)", appendParen: true },
  { insert: "ellipse", detail: "ellipse(x, y, w, h)", appendParen: true },
  { insert: "circle", detail: "circle(x, y, d)", appendParen: true },
  { insert: "line", detail: "line(x1, y1, x2, y2)", appendParen: true },
  { insert: "triangle", detail: "triangle(x1, y1, x2, y2, x3, y3)", appendParen: true },
  { insert: "quad", detail: "quad(x1, y1, x2, y2, x3, y3, x4, y4)", appendParen: true },
  { insert: "beginShape", detail: "beginShape()", appendParen: true },
  { insert: "endShape", detail: "endShape([CLOSE])", appendParen: true },
  { insert: "vertex", detail: "vertex(x, y)", appendParen: true },
  { insert: "bezier", detail: "bezier(...)", appendParen: true },
  { insert: "curve", detail: "curve(...)", appendParen: true },
  { insert: "text", detail: "text(str, x, y)", appendParen: true },
  { insert: "textSize", detail: "textSize(size)", appendParen: true },
  { insert: "textAlign", detail: "textAlign(HORIZ, [VERT])", appendParen: true },
  { insert: "image", detail: "image(img, x, y)", appendParen: true },
  { insert: "loadImage", detail: "loadImage(path)", appendParen: true },
  { insert: "translate", detail: "translate(x, y)", appendParen: true },
  { insert: "rotate", detail: "rotate(angle)", appendParen: true },
  { insert: "scale", detail: "scale(s)", appendParen: true },
  { insert: "push", detail: "push()", appendParen: true },
  { insert: "pop", detail: "pop()", appendParen: true },
  { insert: "random", detail: "random(max | min, max)", appendParen: true },
  { insert: "noise", detail: "noise(x[, y[, z]])", appendParen: true },
  { insert: "map", detail: "map(value, a1, a2, b1, b2)", appendParen: true },
  { insert: "constrain", detail: "constrain(v, min, max)", appendParen: true },
  { insert: "dist", detail: "dist(x1, y1, x2, y2)", appendParen: true },
  { insert: "colorMode", detail: "colorMode(mode, ...)", appendParen: true },
  { insert: "frameRate", detail: "frameRate(fps)", appendParen: true },
  { insert: "println", detail: "println(value)", appendParen: true },
  { insert: "print", detail: "print(value)", appendParen: true }
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
        return `<button type="button" class="editor-autocomplete-item${isActive ? " is-active" : ""}" data-index="${index}" role="option" aria-selected="${isActive ? "true" : "false"}"><span class="editor-autocomplete-label">${label}</span><span class="editor-autocomplete-detail">${detail}</span></button>`;
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
    const nextChar = after.charAt(0);
    const shouldAddParen = suggestion.appendParen && nextChar !== "(";
    const insertion = shouldAddParen ? `${suggestion.insert}(` : suggestion.insert;

    inputCode.value = `${before}${insertion}${after}`;
    const caret = before.length + insertion.length;
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
