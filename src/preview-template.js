export function createPreviewHtml(jsCode) {
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
        touch-action: none;
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
        function installTouchMouseBridge(target) {
          const canvas = target && target.elt ? target.elt : target;
          if (!canvas || typeof canvas.addEventListener !== "function" || canvas.__p5forgeTouchMouseBridgeInstalled) {
            return;
          }

          const options = { passive: false };

          function getPrimaryTouch(event) {
            if (event.touches && event.touches.length > 0) {
              return event.touches[0];
            }
            if (event.changedTouches && event.changedTouches.length > 0) {
              return event.changedTouches[0];
            }
            return null;
          }

          function dispatchMappedMouseEvent(event, type) {
            const touch = getPrimaryTouch(event);
            if (!touch) {
              return;
            }

            event.preventDefault();
            const mappedEvent = new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              clientX: touch.clientX,
              clientY: touch.clientY,
              screenX: touch.screenX,
              screenY: touch.screenY,
              button: 0,
              buttons: type === "mouseup" ? 0 : 1
            });

            canvas.dispatchEvent(mappedEvent);
          }

          canvas.addEventListener("touchstart", function (event) {
            dispatchMappedMouseEvent(event, "mousedown");
          }, options);
          canvas.addEventListener("touchmove", function (event) {
            dispatchMappedMouseEvent(event, "mousemove");
          }, options);
          canvas.addEventListener("touchend", function (event) {
            dispatchMappedMouseEvent(event, "mouseup");
          }, options);
          canvas.addEventListener("touchcancel", function (event) {
            dispatchMappedMouseEvent(event, "mouseup");
          }, options);

          canvas.__p5forgeTouchMouseBridgeInstalled = true;
        }

        if (window.p5 && window.p5.prototype && !window.__p5forgePatchedCreateCanvas) {
          const originalCreateCanvas = window.p5.prototype.createCanvas;
          window.p5.prototype.createCanvas = function patchedCreateCanvas(width, height, ...rest) {
            const renderer = originalCreateCanvas.call(this, width, height, ...rest);
            installTouchMouseBridge(renderer);
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
            return renderer;
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
