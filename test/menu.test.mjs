import assert from "node:assert/strict";
import { test } from "node:test";

import { DISH_POOL, MENU_PLAN } from "../src/menu-data.mjs";
import {
  BANNED_TERMS,
  buildShareText,
  findSameDishFamilies,
  getAlternatePlan,
  getPlanForDate,
  getReassignedPlan,
  getWeekPlans,
  groupPlansByMonth,
  searchMenuPlan,
  searchDishPool,
  validateMenuPlan,
} from "../src/core.mjs";

test("goose intestine is treated as a banned dish family", () => {
  assert.ok(BANNED_TERMS.includes("鹅肠"));
});

test("requested dishes appear in the generated menu plan", () => {
  const dishes = new Set(MENU_PLAN.flatMap((item) => item.dishes));

  for (const dish of ["蒸黄沙蚬", "烤鱼"]) {
    assert.ok(dishes.has(dish), `${dish} should be scheduled at least once`);
  }
  assert.ok([...dishes].some((dish) => dish.includes("青口")), "青口 should be scheduled at least once");
});

test("total dish pool is exposed for the catalog view", () => {
  assert.ok(Array.isArray(DISH_POOL));
  assert.ok(DISH_POOL.length >= 5);

  const allDishes = DISH_POOL.flatMap((category) => category.dishes);
  assert.ok(allDishes.length > 120);
  assert.ok(allDishes.some((dish) => dish.includes("青口")));
  assert.deepEqual(BANNED_TERMS.filter((term) => allDishes.join(" ").includes(term)), []);
});

test("total dish pool search filters categories and dishes", () => {
  const results = searchDishPool(DISH_POOL, "青口");

  assert.ok(results.length >= 1);
  assert.ok(results.every((category) => category.dishes.every((dish) => dish.includes("青口"))));
  assert.ok(results.some((category) => category.dishes.includes("蒜蓉蒸青口")));
  assert.equal(searchDishPool(DISH_POOL, "  ").length, DISH_POOL.length);
});

test("menu data covers every day of 2026", () => {
  assert.equal(MENU_PLAN.length, 365);
  assert.equal(MENU_PLAN[0].date, "2026-01-01");
  assert.equal(MENU_PLAN.at(-1).date, "2026-12-31");
});

test("year menu can be grouped by month and searched", () => {
  const months = groupPlansByMonth(MENU_PLAN);
  const matches = searchMenuPlan(MENU_PLAN, "青口");

  assert.equal(months.length, 12);
  assert.equal(months[0].month, "1月");
  assert.equal(months[0].items[0].date, "2026-01-01");
  assert.ok(matches.length >= 1);
  assert.ok(matches.every((item) => `${item.combo} ${item.style} ${item.date}`.includes("青口")));
  assert.equal(searchMenuPlan(MENU_PLAN, "  ").length, MENU_PLAN.length);
});

test("menu data follows dietary rules and has no repeated dish within 10 days", () => {
  assert.deepEqual(validateMenuPlan(MENU_PLAN), []);
});

test("same dish family combinations are rejected", () => {
  const repeated = findSameDishFamilies(["烤鱼", "蒸黄沙蚬", "蒜蓉白菜仔"]);

  assert.deepEqual(repeated, [{ family: "水产", dishes: ["烤鱼", "蒸黄沙蚬"] }]);
  assert.ok(
    validateMenuPlan([
      {
        date: "2026-01-01",
        weekday: "周四",
        dishes: ["烤鱼", "蒸黄沙蚬"],
        combo: "烤鱼 + 蒸黄沙蚬",
        style: "鱼水产下酒",
      },
    ]).some((error) => error.includes("same dish family")),
  );
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

test("reassigned plans keep the selected date while replacing its dishes", () => {
  const source = getPlanForDate("2026-01-01", MENU_PLAN);
  const reassigned = getReassignedPlan("2026-01-01", MENU_PLAN, 1);
  const sourceDishes = new Set(source.dishes);

  assert.equal(reassigned.date, source.date);
  assert.equal(reassigned.weekday, source.weekday);
  assert.equal(reassigned.dishes.length, source.dishes.length);
  assert.notEqual(reassigned.combo, source.combo);
  assert.equal(reassigned.dishes.some((dish) => sourceDishes.has(dish)), false);
  assert.deepEqual(BANNED_TERMS.filter((term) => reassigned.combo.includes(term)), []);
  assert.deepEqual(findSameDishFamilies(reassigned.dishes), []);
});

test("reassigned plans avoid same-family dish stacks across repeated shuffles", () => {
  for (let offset = 1; offset <= 30; offset += 1) {
    const reassigned = getReassignedPlan("2026-04-28", MENU_PLAN, offset);
    assert.deepEqual(findSameDishFamilies(reassigned.dishes), [], reassigned.combo);
  }
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
