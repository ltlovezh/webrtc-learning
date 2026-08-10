import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "quality-frames.json");
const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CHROME_PATH = process.env.CHROME_PATH || DEFAULT_CHROME;
const PORT = Number(process.env.REVIEW_CDP_PORT || 9347);
const MIN_OVERLAP_PX = 10;
const MIN_OVERLAP_AREA = 180;
const MIN_OVERLAP_RATIO = 0.035;
const MIN_CONNECTOR_OVERLAP_PX = 3;
const MIN_CONNECTOR_OVERLAP_AREA = 24;
const DEFAULT_DENSE_STEP = 5;

const REVIEW_SELECTOR = [
  ".diagram-panel",
  ".protocol-card",
  ".lane-card",
  ".question",
  ".node",
  ".mini-node",
  ".flow-node",
  ".pipeline-step",
  ".media-card",
  ".term-card",
  ".compare-card",
  ".role-pill",
  ".viewer",
  ".path-card",
  ".flow-label",
  ".stream-label",
  ".subscription-note",
  ".sfu-quality-card",
  ".quality-chip",
  ".pill",
  ".caption-cue",
  ".callout",
  ".summary-tile",
  ".glossary-item",
  ".glossary-row",
  ".final-line",
  ".sdp-code",
  ".candidate-row",
  ".field",
  ".lock"
].join(",");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 10000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(120);
  }
  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ""}`);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, timer } = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(timer);
        if (message.error) reject(new Error(`${message.error.message || "CDP error"} ${message.error.data || ""}`.trim()));
        else resolve(message.result || {});
        return;
      }

      const listeners = this.events.get(message.method);
      if (listeners) {
        for (const listener of [...listeners]) listener(message.params || {});
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    return new CDP(ws);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    this.ws.send(JSON.stringify(message));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timed out waiting for ${method}`));
        }
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  waitFor(method, predicate = () => true, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const listeners = this.events.get(method) || new Set();
      this.events.set(method, listeners);
      const timer = setTimeout(() => {
        listeners.delete(listener);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const listener = (params) => {
        if (!predicate(params)) return;
        clearTimeout(timer);
        listeners.delete(listener);
        resolve(params);
      };
      listeners.add(listener);
    });
  }

  close() {
    this.ws.close();
  }
}

async function launchChrome({ width, height }) {
  const userDataDir = await mkdtemp(path.join(tmpdir(), "hf-layout-review-"));
  const chrome = spawn(
    CHROME_PATH,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${width},${height}`,
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  chrome.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(stderr.trim());
    }
  });

  return {
    chrome,
    userDataDir,
    async stop() {
      if (chrome.exitCode === null && chrome.signalCode === null) {
        chrome.kill("SIGTERM");
        await Promise.race([
          new Promise((resolve) => chrome.once("exit", resolve)),
          sleep(1000).then(() => {
            if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGKILL");
          })
        ]);
      }
      await rm(userDataDir, { recursive: true, force: true });
    }
  };
}

async function waitForRuntime(cdp, sessionId) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    const result = await cdp.send(
      "Runtime.evaluate",
      {
        expression: "document.readyState === 'complete' && !!window.__timelines && !!window.__timelines.main",
        returnByValue: true
      },
      sessionId
    );
    if (result.result?.value === true) return;
    await sleep(100);
  }
  throw new Error("Composition runtime did not become ready");
}

function reviewExpression(selector, viewport, thresholds) {
  return `(() => {
    const selector = ${JSON.stringify(selector)};
    const viewport = ${JSON.stringify(viewport)};
    const thresholds = ${JSON.stringify(thresholds)};

    function styleVisible(el) {
      let node = el;
      while (node && node.nodeType === 1) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.03) {
          return false;
        }
        node = node.parentElement;
      }
      return true;
    }

    function rectOf(el) {
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    }

    function connectorRectOf(el) {
      const rect = rectOf(el);
      const extendsLeft = el.classList.contains("arrow-left");
      const extendsRight = el.classList.contains("arrow") && !extendsLeft;
      return {
        left: rect.left - (extendsLeft ? 24 : 0),
        top: rect.top - 12,
        right: rect.right + (extendsRight ? 24 : 0),
        bottom: rect.bottom + 12,
        width: rect.width + (extendsLeft || extendsRight ? 24 : 0),
        height: rect.height + 24
      };
    }

    function intersectsCanvas(rect) {
      return rect.right > 0 && rect.bottom > 0 && rect.left < viewport.width && rect.top < viewport.height;
    }

    function textOf(el) {
      return (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80);
    }

    function labelOf(el) {
      const id = el.id ? "#" + el.id : "";
      const cls = [...el.classList].slice(0, 4).map((name) => "." + name).join("");
      const data = el.getAttribute("data-hf-id") || "";
      return \`\${el.tagName.toLowerCase()}\${id}\${cls}\${data ? "[" + data + "]" : ""}\`;
    }

    function isActive(el) {
      if (el.closest("[data-overlap-ignore]")) return false;
      const scene = el.closest(".scene");
      if (scene) {
        const sceneStyle = getComputedStyle(scene);
        if (Number(sceneStyle.opacity) <= 0.05) return false;
        const sceneRect = scene.getBoundingClientRect();
        if (!intersectsCanvas(sceneRect)) return false;
      }
      const rect = rectOf(el);
      if (rect.width < 2 || rect.height < 2 || !intersectsCanvas(rect)) return false;
      return styleVisible(el);
    }

    const elements = [...document.querySelectorAll(selector)]
      .filter(isActive)
      .map((el) => ({ el, rect: rectOf(el), label: labelOf(el), text: textOf(el) }));

    const collisions = [];
    for (let i = 0; i < elements.length; i += 1) {
      for (let j = i + 1; j < elements.length; j += 1) {
        const a = elements[i];
        const b = elements[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;

        const left = Math.max(a.rect.left, b.rect.left);
        const top = Math.max(a.rect.top, b.rect.top);
        const right = Math.min(a.rect.right, b.rect.right);
        const bottom = Math.min(a.rect.bottom, b.rect.bottom);
        const width = right - left;
        const height = bottom - top;
        if (width <= thresholds.minOverlapPx || height <= thresholds.minOverlapPx) continue;

        const area = width * height;
        const aArea = Math.max(1, a.rect.width * a.rect.height);
        const bArea = Math.max(1, b.rect.width * b.rect.height);
        const ratio = area / Math.min(aArea, bArea);
        if (area < thresholds.minOverlapArea || ratio < thresholds.minOverlapRatio) continue;

        collisions.push({
          a: { label: a.label, text: a.text, rect: a.rect },
          b: { label: b.label, text: b.text, rect: b.rect },
          overlap: { left, top, right, bottom, width, height, area: Math.round(area), ratio: Number(ratio.toFixed(3)) }
        });
      }
    }

    const connectors = [...document.querySelectorAll(".line, .packet, .media-wave")]
      .filter(isActive)
      .map((el) => ({ el, rect: connectorRectOf(el), label: labelOf(el), text: textOf(el) }));

    const solidTargets = [...document.querySelectorAll(".node, .mini-node, .flow-node, .pipeline-step, .media-card, .term-card, .compare-card, .role-pill, .viewer, .protocol-card, .path-card, .lane-card, .question, .sdp-code, .candidate-row, .field, .glossary-item, .glossary-row, .summary-tile, .flow-label, .stream-label, .subscription-note, .sfu-quality-card, .quality-chip, .callout, .caption-cue")]
      .filter(isActive)
      .map((el) => {
        const rect = rectOf(el);
        const insetX = Math.min(24, rect.width * 0.16);
        const insetY = Math.min(24, rect.height * 0.16);
        return {
          el,
          rect: {
            left: rect.left + insetX,
            top: rect.top + insetY,
            right: rect.right - insetX,
            bottom: rect.bottom - insetY,
            width: Math.max(0, rect.width - insetX * 2),
            height: Math.max(0, rect.height - insetY * 2)
          },
          fullRect: rect,
          label: labelOf(el),
          text: textOf(el)
        };
      });

    for (const connector of connectors) {
      for (const target of solidTargets) {
        if (connector.el.contains(target.el) || target.el.contains(connector.el)) continue;

        const left = Math.max(connector.rect.left, target.rect.left);
        const top = Math.max(connector.rect.top, target.rect.top);
        const right = Math.min(connector.rect.right, target.rect.right);
        const bottom = Math.min(connector.rect.bottom, target.rect.bottom);
        const width = right - left;
        const height = bottom - top;
        if (width <= thresholds.minConnectorOverlapPx || height <= thresholds.minConnectorOverlapPx) continue;

        const area = width * height;
        if (area < thresholds.minConnectorOverlapArea) continue;

        collisions.push({
          a: { label: connector.label, text: "connector", rect: connector.rect },
          b: { label: target.label, text: target.text, rect: target.fullRect },
          overlap: { left, top, right, bottom, width, height, area: Math.round(area), ratio: Number((area / Math.max(1, target.rect.width * target.rect.height)).toFixed(3)) }
        });
      }
    }

    return { elementCount: elements.length, collisions };
  })()`;
}

async function reviewFrame(cdp, sessionId, frame, viewport) {
  const url = `${pathToFileURL(path.join(ROOT, "index.html")).href}?seek=${encodeURIComponent(frame.time)}`;
  const loaded = cdp.waitFor("Page.loadEventFired", () => true, 10000).catch(() => undefined);
  await cdp.send("Page.navigate", { url }, sessionId);
  await loaded;
  await waitForRuntime(cdp, sessionId);
  await sleep(120);

  const result = await cdp.send(
    "Runtime.evaluate",
    {
      expression: reviewExpression(REVIEW_SELECTOR, viewport, {
        minOverlapPx: MIN_OVERLAP_PX,
        minOverlapArea: MIN_OVERLAP_AREA,
        minOverlapRatio: MIN_OVERLAP_RATIO,
        minConnectorOverlapPx: MIN_CONNECTOR_OVERLAP_PX,
        minConnectorOverlapArea: MIN_CONNECTOR_OVERLAP_AREA
      }),
      returnByValue: true
    },
    sessionId
  );

  return {
    time: frame.time,
    label: frame.label,
    ...(result.result?.value || { elementCount: 0, collisions: [] })
  };
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const viewport = config.viewport || { width: 1920, height: 1080 };
  const configuredFrames = config.frames || [];
  const denseStep = Number(config.denseStep || process.env.REVIEW_DENSE_STEP || DEFAULT_DENSE_STEP);
  const duration = Number(config.duration || 232.5);
  const denseFrames = [];
  if (denseStep > 0) {
    for (let time = 0; time <= duration; time += denseStep) {
      denseFrames.push({ time: Number(time.toFixed(3)), label: `dense ${Number(time.toFixed(1))}s` });
    }
  }
  const frameMap = new Map();
  for (const frame of [...denseFrames, ...configuredFrames]) {
    frameMap.set(Number(frame.time).toFixed(3), frame);
  }
  const frames = [...frameMap.values()].sort((a, b) => a.time - b.time);
  if (!frames.length) throw new Error("quality-frames.json has no frames");

  const chromeProcess = await launchChrome(viewport);
  let cdp;
  try {
    const version = await waitForJson(`http://127.0.0.1:${PORT}/json/version`);
    cdp = await CDP.connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false },
      sessionId
    );

    const reports = [];
    for (const frame of frames) {
      reports.push(await reviewFrame(cdp, sessionId, frame, viewport));
    }

    const failed = reports.filter((report) => report.collisions.length > 0);
    for (const report of reports) {
      const marker = report.collisions.length ? "FAIL" : "ok";
      console.log(`${marker} ${String(report.time).padStart(6)}s ${report.label} (${report.elementCount} checked)`);
      for (const collision of report.collisions.slice(0, 8)) {
        console.log(`  - ${collision.a.label} "${collision.a.text}" overlaps ${collision.b.label} "${collision.b.text}"`);
        console.log(`    ${Math.round(collision.overlap.width)}x${Math.round(collision.overlap.height)}px ratio=${collision.overlap.ratio}`);
      }
      if (report.collisions.length > 8) {
        console.log(`  - ${report.collisions.length - 8} more collisions`);
      }
    }

    if (failed.length) {
      console.error(`\nLayout review failed: ${failed.reduce((sum, report) => sum + report.collisions.length, 0)} overlap(s) across ${failed.length} frame(s).`);
      process.exitCode = 1;
      return;
    }

    console.log(`\nLayout review passed: ${frames.length} frame(s), no protected-element overlaps.`);
  } finally {
    if (cdp) cdp.close();
    await chromeProcess.stop();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
