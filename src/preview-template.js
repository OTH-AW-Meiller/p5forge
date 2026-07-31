export function createPreviewHtml(jsCode, assetBaseHref = "./") {
  const escapedCode = jsCode.replace(/<\/script>/gi, "<\\/script>");
  const serializedCode = JSON.stringify(escapedCode);
  const serializedAssetBaseHref = JSON.stringify(assetBaseHref);

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
        var originalConsoleError = console.error ? console.error.bind(console) : null;
        console.log = function patchedConsoleLog() {
          emitStatusLog.apply(null, arguments);
          if (originalConsoleLog) {
            originalConsoleLog.apply(null, arguments);
          }
        };
        console.error = function patchedConsoleError() {
          emitStatusLog.apply(null, arguments);
          if (originalConsoleError) {
            originalConsoleError.apply(null, arguments);
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

      window.addEventListener("unhandledrejection", function (event) {
        var reason = event && event.reason ? event.reason : "Unknown promise rejection";
        var message = typeof reason === "string" ? reason : (reason && reason.message ? reason.message : String(reason));
        emitStatusLog("Preview rejection:", message);
      });
    <\/script>
    <script>
      var p5forgeAssetBaseHref = ${serializedAssetBaseHref};

      function resolveAssetUrl(path) {
        try {
          return new URL(path, p5forgeAssetBaseHref).toString();
        } catch {
          return path;
        }
      }

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
        function patchImageGuard() {
          if (!window.p5 || !window.p5.prototype || window.__p5forgePatchedImageGuard) {
            return;
          }

          const originalImage = window.p5.prototype.image;
          if (typeof originalImage !== "function") {
            return;
          }

          window.p5.prototype.image = function patchedImage(img, ...rest) {
            if (img === undefined || img === null) {
              return;
            }
            return originalImage.call(this, img, ...rest);
          };

          window.__p5forgePatchedImageGuard = true;
        }

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

        patchImageGuard();

        var sketchCode = ${serializedCode};
        var sketchScript = document.createElement("script");
        sketchScript.textContent = sketchCode;
        document.body.appendChild(sketchScript);

        // In this srcdoc boot flow, p5 global mode may start before user code
        // defines preload(). If so, preload is never called and async asset
        // fields stay undefined. Fallback: trigger preload once when p5 did not.
        if (typeof window.preload === "function" && !window.__p5forgePatchedPreloadFallback) {
          const originalPreload = window.preload;
          window.__p5forgePreloadCalled = false;
          window.preload = async function patchedPreloadFallback(...args) {
            window.__p5forgePreloadCalled = true;
            return originalPreload.apply(this, args);
          };
          window.__p5forgePatchedPreloadFallback = true;

          setTimeout(() => {
            if (window.__p5forgePreloadCalled) {
              return;
            }
            Promise.resolve(window.preload()).catch((error) => {
              console.error(error);
            });
          }, 0);
        }
      }

      function loadP5AndRun() {
        var defsUrl = resolveAssetUrl("processing-defs.js");

        function loadDefsAndRun() {
          loadScript(
            defsUrl,
            runSketch,
            function () {
              showBootError("Failed to load processing-defs.js.");
            }
          );
        }

        loadScript(
          "https://cdn.jsdelivr.net/npm/p5@2.3.0/lib/p5.min.js",
          loadDefsAndRun,
          function () {
            showBootError("Failed to load p5.js from CDN.");
          }
        );
      }

      loadP5AndRun();
    <\/script>
  </body>
</html>`;
}
