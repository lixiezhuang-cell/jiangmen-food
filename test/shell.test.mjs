import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("app shell exposes a dock navigation and reusable sheet panels", () => {
  assert.match(html, /class="dock-nav"/);
  assert.match(html, /id="dockShuffleButton"/);
  assert.match(html, /id="appSheet"/);
  assert.match(html, /id="sheetOverlay"/);
  assert.match(html, /data-sheet-panel="week"/);
  assert.match(html, /data-sheet-panel="catalog"/);
  assert.match(html, /data-sheet-panel="records"/);
  assert.match(html, /data-sheet-panel="year"/);
  assert.match(html, /data-sheet-panel="more"/);
});

test("sheet and dock have transition styles with reduced motion fallback", () => {
  assert.match(css, /\.dock-nav/);
  assert.match(css, /\.dock-fab/);
  assert.match(css, /\.app-sheet/);
  assert.match(css, /\.sheet-overlay\.is-open/);
  assert.match(css, /@keyframes sheetRise/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
