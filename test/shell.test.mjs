import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const appScript = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("app shell exposes a three item dock and reusable sheet panels", () => {
  assert.match(html, /class="dock-nav"/);
  assert.match(html, /id="appSheet"/);
  assert.match(html, /id="sheetOverlay"/);
  assert.match(html, /data-sheet-panel="catalog"/);
  assert.match(html, /data-sheet-panel="records"/);
  assert.match(html, /data-sheet-panel="year"/);
  assert.match(html, /data-sheet-panel="more"/);
  assert.doesNotMatch(html, /data-sheet-panel="week"/);
  assert.doesNotMatch(html, /data-sheet-target="week"/);
  assert.match(html, /id="homeWeekPanel"/);
  assert.match(html, /id="weekList"/);
  assert.doesNotMatch(html, /id="shuffleButton"/);
  assert.match(html, /id="dockShuffleButton"/);
  assert.match(html, /data-open-rules/);
  assert.doesNotMatch(html, /id="ruleButton"/);
  assert.doesNotMatch(html, /id="insightGrid"/);
});

test("dock navigation only keeps today, shuffle, and more", () => {
  const dockMatch = html.match(/<nav class="dock-nav"[\s\S]*?<\/nav>/);
  assert.ok(dockMatch, "dock navigation exists");
  const labels = [...dockMatch[0].matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((match) => match[1].trim());
  assert.deepEqual(labels, ["今日", "换一个", "更多"]);
  assert.match(dockMatch[0], /id="dockShuffleButton"[^>]*class="[^"]*dock-shuffle-button/);
  assert.doesNotMatch(dockMatch[0], /data-view="records"/);
  assert.match(html, /data-sheet-target="records"/);
});

test("sheet and dock have transition styles with reduced motion fallback", () => {
  assert.match(css, /\.dock-nav/);
  assert.match(css, /\.app-sheet/);
  assert.match(css, /\.sheet-overlay\.is-open/);
  assert.match(css, /\.home-week-panel/);
  assert.match(css, /\.dock-shuffle-button/);
  assert.match(css, /@keyframes sheetRise/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("open sheets block dock interaction and keep catalog editing controls sticky", () => {
  assert.match(css, /\.sheet-overlay\s*{[^}]*z-index:\s*70/s);
  assert.match(css, /\.app-sheet\s*{[^}]*z-index:\s*80/s);
  assert.match(css, /\.dock-nav\s*{[^}]*z-index:\s*60/s);
  assert.match(css, /#catalogView\s*>\s*\.section-header\s*{[^}]*position:\s*sticky/s);
  assert.match(css, /#catalogView\s*>\s*\.section-header\s*{[^}]*top:\s*0/s);
});

test("catalog replacement feedback stays visible inside the sheet", () => {
  assert.match(appScript, /catalogFeedback/);
  assert.match(appScript, /showCatalogFeedback/);
  assert.match(appScript, /catalogHint\.classList\.toggle\("has-feedback"/);
  assert.match(css, /\.catalog-hint\.has-feedback/);
  assert.match(css, /\.toast-pill\s*{[^}]*position:\s*fixed/s);
  assert.match(css, /\.toast-pill\s*{[^}]*z-index:\s*90/s);
});
