import assert from "node:assert/strict";
import { test } from "node:test";

import { MENU_PLAN } from "../src/menu-data.mjs";
import {
  buildShareText,
  getAlternatePlan,
  getPlanForDate,
  getWeekPlans,
  validateMenuPlan,
} from "../src/core.mjs";

test("menu data covers every day of 2026", () => {
  assert.equal(MENU_PLAN.length, 365);
  assert.equal(MENU_PLAN[0].date, "2026-01-01");
  assert.equal(MENU_PLAN.at(-1).date, "2026-12-31");
});

test("menu data follows dietary rules and has no repeated dish within 10 days", () => {
  assert.deepEqual(validateMenuPlan(MENU_PLAN), []);
});

test("gets the plan for an exact date and wraps non-2026 years onto the same month/day", () => {
  const exact = getPlanForDate("2026-01-01", MENU_PLAN);
  const wrapped = getPlanForDate("2027-01-01", MENU_PLAN);

  assert.equal(exact.date, "2026-01-01");
  assert.equal(wrapped.date, "2026-01-01");
  assert.equal(wrapped.combo, exact.combo);
});

test("alternate plans avoid the same dishes as the source day", () => {
  const source = getPlanForDate("2026-01-01", MENU_PLAN);
  const alternate = getAlternatePlan("2026-01-01", MENU_PLAN, 1);
  const sourceDishes = new Set(source.dishes);

  assert.notEqual(alternate.date, source.date);
  assert.equal(alternate.dishes.some((dish) => sourceDishes.has(dish)), false);
});

test("week plans returns a seven-day window starting from the selected date", () => {
  const week = getWeekPlans("2026-02-26", MENU_PLAN);

  assert.equal(week.length, 7);
  assert.deepEqual(
    week.map((item) => item.date),
    [
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
    ],
  );
});

test("share text is short enough for a WeChat message preview", () => {
  const plan = getPlanForDate("2026-01-01", MENU_PLAN);
  const text = buildShareText(plan);

  assert.match(text, /今晚吃/);
  assert.match(text, /2026-01-01/);
  assert.ok(text.length < 90);
});
