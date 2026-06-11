export function bindGlobalHotkeys({ onToggleRun }) {
  window.addEventListener("keydown", (event) => {
    if (event.key !== "F5") {
      return;
    }

    event.preventDefault();
    onToggleRun();
  });
}

export function bindEditorKeyHandlers({
  inputCode,
  onRun,
  autocomplete,
  onAfterEdit
}) {
  inputCode.addEventListener("keydown", (event) => {
    if (autocomplete && autocomplete.handleKeydown(event)) {
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();

      const INDENT = "  ";

      const value = inputCode.value;
      const selectionStart = inputCode.selectionStart;
      const selectionEnd = inputCode.selectionEnd;
      const hasSelection = selectionStart !== selectionEnd;
      const startOfLine = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const selectedText = value.slice(selectionStart, selectionEnd);
      const isMultilineSelection = hasSelection && selectedText.includes("\n");

      if (event.shiftKey) {
        if (hasSelection && isMultilineSelection) {
          const endLineBreak = value.indexOf("\n", selectionEnd);
          const blockEnd = endLineBreak === -1 ? value.length : endLineBreak;
          const blockText = value.slice(startOfLine, blockEnd);
          const lines = blockText.split("\n");

          let removedFromFirstLine = 0;
          let removedBeforeSelectionStart = 0;
          let removedInsideSelection = 0;
          const outdented = lines.map((line, index) => {
            let removedLength = 0;
            if (line.startsWith(INDENT)) {
              removedLength = INDENT.length;
            } else if (line.startsWith("\t")) {
              removedLength = 1;
            }

            if (removedLength > 0) {
              if (index === 0) {
                removedFromFirstLine = removedLength;
              }
              removedInsideSelection += removedLength;
              return line.slice(removedLength);
            }
            return line;
          });

          const newBlock = outdented.join("\n");
          inputCode.value = value.slice(0, startOfLine) + newBlock + value.slice(blockEnd);

          if (selectionStart > startOfLine && removedFromFirstLine > 0) {
            removedBeforeSelectionStart = removedFromFirstLine;
          }

          inputCode.selectionStart = Math.max(startOfLine, selectionStart - removedBeforeSelectionStart);
          inputCode.selectionEnd = Math.max(inputCode.selectionStart, selectionEnd - removedInsideSelection);
        } else {
          let removedLength = 0;
          if (value.startsWith(INDENT, startOfLine)) {
            removedLength = INDENT.length;
          } else if (value.startsWith("\t", startOfLine)) {
            removedLength = 1;
          }

          if (removedLength > 0) {
            const removeAt = startOfLine;
            inputCode.value = value.slice(0, removeAt) + value.slice(removeAt + removedLength);
            const nextPos = Math.max(startOfLine, selectionStart - removedLength);
            inputCode.selectionStart = nextPos;
            inputCode.selectionEnd = nextPos;
          }
        }
      } else if (hasSelection && isMultilineSelection) {
        const endLineBreak = value.indexOf("\n", selectionEnd);
        const blockEnd = endLineBreak === -1 ? value.length : endLineBreak;
        const blockText = value.slice(startOfLine, blockEnd);
        const lines = blockText.split("\n").map((line) => `${INDENT}${line}`);
        const newBlock = lines.join("\n");
        inputCode.value = value.slice(0, startOfLine) + newBlock + value.slice(blockEnd);
        inputCode.selectionStart = selectionStart + INDENT.length;
        inputCode.selectionEnd = selectionEnd + (INDENT.length * lines.length);
      } else {
        inputCode.value = value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd);
        const nextPos = selectionStart + INDENT.length;
        inputCode.selectionStart = nextPos;
        inputCode.selectionEnd = nextPos;
      }

      onAfterEdit();
      if (autocomplete) {
        autocomplete.handleInput();
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "enter") {
      onRun();
    }
  });
}
