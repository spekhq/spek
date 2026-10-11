// Drives a running VS Code over the Chrome DevTools Protocol. Node 22+ (built-in WebSocket).
// Works against a desktop window (--remote-debugging-port) and a browser-hosted one in Chrome.
//
//   node cdp.mjs <port> targets                          list CDP targets
//   node cdp.mjs <port> palette "<command>"              run a command through the command palette
//   node cdp.mjs <port> app "<js>"                       evaluate in the spek webview; `d` is the app's document
//   node cdp.mjs <port> workbench "<js>"                 evaluate in the workbench page (native trees, editors)
//   node cdp.mjs <port> click-link "<href>"              mouse-click the app link whose href attribute is <href>
//   node cdp.mjs <port> click-app "<css selector>"       mouse-click the first app element matching the selector
//   node cdp.mjs <port> click-row "<label>"              mouse-click the spek sidebar row whose displayed label is <label>
//   node cdp.mjs <port> expand-row "<label>"             mouse-click that row's expand/collapse arrow
//   node cdp.mjs <port> click "<css selector>"           mouse-click the first workbench element matching the selector
//   node cdp.mjs <port> key "<combo>"                    press a key where focus is: Ctrl+K, Enter, ArrowDown, a, …
//   node cdp.mjs <port> type "<text>"                    insert text where focus is
//   node cdp.mjs <port> shot <file.png>                  screenshot the workbench
//   node cdp.mjs <port> close                            close the browser (Browser.close) and wait for its port to go quiet
//
// Expressions should be one expression (wrap statements in an IIFE) and return something serialisable.
// The click commands send real mouse events (isTrusted), which is what VS Code's own listeners see from a user.
import fs from "node:fs";
import net from "node:net";

const [port, step, arg] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = `http://127.0.0.1:${port}`;

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  const closed = new Promise((resolve) => ws.addEventListener("close", resolve));
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  return { ready, closed, send, close: () => ws.close() };
}

// Every HTTP request is bounded: a port can accept connections and never answer — on Ubuntu 20.04 (GNOME,
// X11) a `dconf watch /system/proxy/` started beside the window inherited the DevTools socket and outlived it.
const get = (path) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(2000) });
const silent = (e) => e.name === "TimeoutError";
// Whether anything listens, asked with a bare TCP connect rather than HTTP. Only a refusal means free:
// each unanswered probe stays in the leaked listener's accept queue, and once it is full the kernel
// drops new SYNs, so an unbounded connect retried for ~130s and then reported ETIMEDOUT, read as free.
const listening = () =>
  new Promise((resolve) => {
    const s = net.connect({ port: Number(port), host: "127.0.0.1" });
    const done = (v) => (s.destroy(), resolve(v));
    s.once("connect", () => done(true));
    s.setTimeout(2000, () => done(true));
    s.once("error", (e) => done(e.code !== "ECONNREFUSED"));
  });
// free: nothing listens; answering: an HTTP reply came back; occupied: something listens and gave none in time.
const portState = () => get("/json/version").then(() => "answering", async () => ((await listening()) ? "occupied" : "free"));
const leakHint = `port ${port} accepts connections and never answers, as when a process outside VS Code inherited the socket. Find the holder with \`ss -ltnp | grep :${port}\` and stop it.`;
async function getJson(path) {
  try {
    return await (await get(path)).json();
  } catch (e) {
    fail(silent(e) ? leakHint : `nothing answers on port ${port}: is VS Code up, with its DevTools port there?`, 2);
  }
}

async function evaluate(target, expression) {
  const c = connect(target.webSocketDebuggerUrl);
  await c.ready;
  const r = await c.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  c.close();
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description ?? "exception" };
  return { value: r.result?.result?.value };
}

const print = (v) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
const fail = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};

if (step === "close") {
  const c = connect((await getJson("/json/version")).webSocketDebuggerUrl);
  await c.ready;
  c.send("Browser.close");
  // The browser connection dropping is the instance going away; the port is checked after, since a
  // listener can outlive it and would break the next launch on this port.
  await Promise.race([c.closed, sleep(30_000)]);
  // A listener still there after the deadline is a leak; before it, it may be a slow shutdown.
  const deadline = Date.now() + 30_000;
  let state;
  while ((state = await portState()) !== "free" && Date.now() < deadline) await sleep(500);
  if (state === "answering") fail("still answering after 30s");
  if (state === "occupied") fail(`window closed; ${leakHint}`);
  console.log("closed");
  process.exit(0);
}

const targets = await getJson("/json/list");

if (step === "targets") {
  for (const t of targets) console.log(t.type, "|", t.title.slice(0, 50), "|", t.url.slice(0, 120));
  process.exit(0);
}

// The workbench is the page that renders `.monaco-workbench`: desktop serves it from vscode-file://,
// a browser-hosted VS Code from whatever URL its server listens on.
let page;
for (const t of targets.filter((t) => t.type === "page")) {
  if ((await evaluate(t, `!!document.querySelector(".monaco-workbench")`)).value) {
    page = t;
    break;
  }
}
if (!page) fail("no workbench page: is VS Code up, with its DevTools port on " + port + "?", 2);

// The webview target's own document is VS Code's host frame; the spek app is its inner iframe.
async function inApp(expression) {
  // Boxed, so an expression yielding null or undefined still counts as having found the app.
  const wrapped = `(() => { const d = document.querySelector("iframe")?.contentDocument; if (!d?.getElementById("root")) return undefined; return { v: (${expression}) }; })()`;
  for (const t of targets.filter((t) => t.type === "iframe")) {
    const r = await evaluate(t, wrapped);
    if (r.error) fail(r.error);
    if (r.value) return { target: t, value: r.value.v };
  }
  fail('no webview held the spek app: open the panel first (palette "spek: Open spek")');
}

async function mouseClick(x, y) {
  const c = connect(page.webSocketDebuggerUrl);
  await c.ready;
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  c.close();
  console.log(`clicked ${Math.round(x)},${Math.round(y)}`);
}

async function workbenchCenter(expression, what) {
  const r = await evaluate(page, `(el => el && (b => [b.x + b.width / 2, b.y + b.height / 2])(el.getBoundingClientRect()))(${expression})`);
  if (r.error) fail(r.error);
  if (!r.value) fail(`not found: ${what}`);
  return r.value;
}

if (step === "palette") {
  const c = connect(page.webSocketDebuggerUrl);
  await c.ready;
  await c.send("Page.bringToFront");
  const key = (type, key, code, vk) => c.send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: vk });
  // F1, not Ctrl+Shift+P: one key for every platform, and it opened the palette on both hosts.
  await key("rawKeyDown", "F1", "F1", 112);
  await key("keyUp", "F1", "F1", 112);
  await sleep(800);
  await c.send("Input.insertText", { text: arg });
  await sleep(1000);
  await key("rawKeyDown", "Enter", "Enter", 13);
  await key("keyUp", "Enter", "Enter", 13);
  c.close();
} else if (step === "key" || step === "type") {
  // Keys go to whatever has focus, as a user's would: click into the app first to reach it.
  const c = connect(page.webSocketDebuggerUrl);
  await c.ready;
  if (step === "type") {
    await c.send("Input.insertText", { text: arg });
  } else {
    const parts = arg.split("+");
    const name = parts.pop();
    const bits = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 };
    const modifiers = parts.reduce((m, p) => m | (bits[p] ?? fail(`unknown modifier ${p} (Alt, Ctrl, Meta, Shift)`, 2)), 0);
    const named = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Space: 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35, PageUp: 33, PageDown: 34 };
    const char = /^[a-z0-9]$/i.test(name);
    if (!char && !(name in named)) fail(`unknown key ${name}: a letter, a digit, or one of ${Object.keys(named).join(", ")}`, 2);
    const key = name === "Space" ? " " : char ? name.toLowerCase() : name;
    const code = char ? (/\d/.test(name) ? `Digit${name}` : `Key${name.toUpperCase()}`) : name;
    const vk = char ? name.toUpperCase().charCodeAt(0) : named[name];
    // A plain character carries `text`, which is what makes it type; with a modifier it is a shortcut.
    const text = !modifiers && (char || name === "Space") ? key : undefined;
    await c.send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key, code, windowsVirtualKeyCode: vk, modifiers, text });
    await c.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers });
  }
  c.close();
  console.log(`${step === "key" ? "pressed" : "typed"} ${arg}`);
} else if (step === "app") {
  print((await inApp(arg)).value);
} else if (step === "workbench") {
  const r = await evaluate(page, arg);
  if (r.error) fail(r.error);
  print(r.value);
} else if (step === "click-link" || step === "click-app") {
  // The element's box is relative to the app frame; add the app frame's offset in the host frame,
  // then the host frame's offset in the workbench (the webview element whose src names this target).
  const element =
    step === "click-link"
      ? `[...d.querySelectorAll("a")].find(a => a.getAttribute("href") === ${JSON.stringify(arg)})`
      : `d.querySelector(${JSON.stringify(arg)})`;
  const { target, value } = await inApp(
    `(a => a && (f => (b => [f.x + b.x + Math.min(12, b.width / 2), f.y + b.y + b.height / 2])(a.getBoundingClientRect()))(document.querySelector("iframe").getBoundingClientRect()))(${element}) || "missing"`,
  );
  if (value === "missing") fail(step === "click-link" ? `no app link with href ${arg}` : `nothing in the app matches ${arg}`);
  const id = new URL(target.url).searchParams.get("id");
  const frame = await evaluate(
    page,
    `(f => f && [f.getBoundingClientRect().x, f.getBoundingClientRect().y])([...document.querySelectorAll("iframe.webview")].find(f => f.src.includes(${JSON.stringify(id ?? "")})))`,
  );
  if (!frame.value) fail("no workbench webview element for the app's frame");
  await mouseClick(frame.value[0] + value[0], frame.value[1] + value[1]);
} else if (step === "click-row" || step === "expand-row") {
  // Matched on the label the row displays, not its aria-label, which VS Code fills from the tooltip.
  const row = `[...document.querySelectorAll('[id="workbench.view.extension.spek-sidebar"] .monaco-list-row')].find(r => r.querySelector(".label-name")?.textContent === ${JSON.stringify(arg)})`;
  const [x, y] = await workbenchCenter(
    step === "click-row" ? row : `${row}?.querySelector(".monaco-tl-twistie")`,
    `spek sidebar row "${arg}" (is the spek view open, and its folder expanded?)`,
  );
  await mouseClick(x, y);
} else if (step === "click") {
  const [x, y] = await workbenchCenter(`document.querySelector(${JSON.stringify(arg)})`, arg);
  await mouseClick(x, y);
} else if (step === "shot") {
  const c = connect(page.webSocketDebuggerUrl);
  await c.ready;
  const r = await c.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(arg, Buffer.from(r.result.data, "base64"));
  c.close();
  console.log(arg);
} else {
  fail(`unknown step: ${step}`, 2);
}
process.exit(0);
