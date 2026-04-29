import assert from "node:assert/strict";
import { test } from "node:test";

import { DISH_POOL, MENU_PLAN } from "../src/menu-data.mjs";
import {
  addCustomDish,
  applyMealRecordsToPlan,
  applyMenuOverridesToPlan,
  BANNED_TERMS,
  buildShareText,
  comboToDishes,
  findTenDayDuplicateDishes,
  findSameDishFamilies,
  getMealInsight,
  getAlternatePlan,
  getPlanForDate,
  getReassignedPlan,
  getSmartReassignedPlan,
  getWeekPlans,
  groupPlansByMonth,
  isSelectedDish,
  mergeDishPool,
  removeDishFromPoolState,
  replaceDishInPlanItem,
  searchMenuPlan,
  searchDishPool,
  sortMealRecords,
  syncPlanReplacementState,
  updateMealRecord,
  upsertMealRecord,
  upsertMenuOverride,
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

test("catalog selection highlights only the exact dish name", () => {
  assert.equal(isSelectedDish("豉汁排骨", "豉汁排骨"), true);
  assert.equal(isSelectedDish("豉汁排骨", "排骨"), false);
  assert.equal(isSelectedDish("豉汁蒸排骨", "豉汁排骨"), false);
});

test("meal records can be created and edited by date", () => {
  const plan = getPlanForDate("2026-01-01", MENU_PLAN);
  const created = upsertMealRecord([], plan);
  const updatedSameDate = upsertMealRecord(created, {
    ...plan,
    combo: "铁板牛肉 + 蒜蓉通菜",
  });
  const edited = updateMealRecord(updatedSameDate, plan.date, {
    combo: "手写菜名",
    note: "少油，配啤酒",
  });
  const updatedAfterNote = upsertMealRecord(edited, {
    ...plan,
    combo: "今日重新点的菜",
  });

  assert.equal(created.length, 1);
  assert.equal(updatedSameDate.length, 1);
  assert.equal(updatedSameDate[0].combo, "铁板牛肉 + 蒜蓉通菜");
  assert.equal(edited[0].combo, "手写菜名");
  assert.equal(edited[0].note, "少油，配啤酒");
  assert.equal(updatedAfterNote.length, 1);
  assert.equal(updatedAfterNote[0].combo, "今日重新点的菜");
  assert.equal(updatedAfterNote[0].note, "少油，配啤酒");
  assert.deepEqual(sortMealRecords([{ date: "2026-01-01" }, { date: "2026-01-03" }]).map((item) => item.date), [
    "2026-01-03",
    "2026-01-01",
  ]);
});

test("recorded meals override the yearly plan and split dish names", () => {
  const plan = getPlanForDate("2026-01-01", MENU_PLAN);
  const records = [
    {
      date: plan.date,
      weekday: plan.weekday,
      combo: "手写菜名、蒜蓉通菜\n沙姜鸡尖",
      note: "少油",
    },
  ];
  const effectivePlan = applyMealRecordsToPlan(MENU_PLAN, records);
  const updated = getPlanForDate(plan.date, effectivePlan);

  assert.deepEqual(comboToDishes(records[0].combo), ["手写菜名", "蒜蓉通菜", "沙姜鸡尖"]);
  assert.equal(updated.combo, records[0].combo);
  assert.deepEqual(updated.dishes, ["手写菜名", "蒜蓉通菜", "沙姜鸡尖"]);
  assert.equal(updated.recorded, true);
  assert.equal(updated.note, "少油");
});

test("menu overrides change future menus without creating meal records", () => {
  const plan = getPlanForDate("2026-05-03", MENU_PLAN);
  const replaced = replaceDishInPlanItem(plan, plan.dishes[0], "豉汁排骨", 0);
  const overrides = upsertMenuOverride([], replaced);
  const effectivePlan = applyMealRecordsToPlan(applyMenuOverridesToPlan(MENU_PLAN, overrides), []);
  const updated = getPlanForDate(plan.date, effectivePlan);

  assert.equal(overrides.length, 1);
  assert.deepEqual(updated.dishes, replaced.dishes);
  assert.equal(updated.combo, replaced.combo);
  assert.equal(updated.recorded, undefined);
  assert.equal(updated.note, undefined);
});

test("dish replacement state syncs menu pages and existing records by date", () => {
  const plan = getPlanForDate("2026-05-03", MENU_PLAN);
  const existingRecord = {
    date: plan.date,
    weekday: plan.weekday,
    combo: plan.combo,
    note: "少油",
  };
  const replaced = replaceDishInPlanItem(plan, plan.dishes[0], "豉汁排骨", 0);
  const synced = syncPlanReplacementState(
    {
      mealRecords: [existingRecord],
      menuOverrides: [],
    },
    replaced,
  );
  const unrecorded = syncPlanReplacementState(
    {
      mealRecords: [],
      menuOverrides: [],
    },
    replaced,
  );

  assert.equal(synced.menuOverrides.length, 1);
  assert.equal(synced.menuOverrides[0].combo, replaced.combo);
  assert.equal(synced.mealRecords.length, 1);
  assert.equal(synced.mealRecords[0].combo, replaced.combo);
  assert.equal(synced.mealRecords[0].note, "少油");
  assert.equal(unrecorded.menuOverrides.length, 1);
  assert.equal(unrecorded.mealRecords.length, 0);
});

test("dish replacement rewrites one dish in a plan item", () => {
  const plan = {
    date: "2026-04-28",
    weekday: "周二",
    combo: "鱼肠煎蛋 + 腐乳通菜",
    dishes: ["鱼肠煎蛋", "腐乳通菜"],
    style: "鱼水产下酒",
  };
  const replaced = replaceDishInPlanItem(plan, "鱼肠煎蛋", "豉汁排骨");
  const unchanged = replaceDishInPlanItem(plan, "不存在", "豉汁排骨");

  assert.deepEqual(replaced.dishes, ["豉汁排骨", "腐乳通菜"]);
  assert.equal(replaced.combo, "豉汁排骨 + 腐乳通菜");
  assert.equal(unchanged, plan);
});

test("dish replacement can target the selected dish position", () => {
  const plan = {
    date: "2026-04-29",
    weekday: "周三",
    combo: "腐乳通菜 + 腐乳通菜 + 沙姜鸡尖",
    dishes: ["腐乳通菜", "腐乳通菜", "沙姜鸡尖"],
    style: "三菜下酒",
  };
  const replacedSecond = replaceDishInPlanItem(plan, "腐乳通菜", "豉汁排骨", 1);
  const replacedThird = replaceDishInPlanItem(plan, "沙姜鸡尖", "椒盐鱼骨", 2);

  assert.deepEqual(replacedSecond.dishes, ["腐乳通菜", "豉汁排骨", "沙姜鸡尖"]);
  assert.equal(replacedSecond.combo, "腐乳通菜 + 豉汁排骨 + 沙姜鸡尖");
  assert.deepEqual(replacedThird.dishes, ["腐乳通菜", "腐乳通菜", "椒盐鱼骨"]);
});

test("custom dish pool additions and deletions are applied locally", () => {
  const added = addCustomDish([], "  五邑小炒  ");
  const deduped = addCustomDish(added, "五邑小炒");
  const withCustom = mergeDishPool(DISH_POOL, deduped, []);
  const removedCustom = removeDishFromPoolState({ customDishes: deduped, deletedDishes: [] }, "五邑小炒");
  const hiddenBuiltIn = removeDishFromPoolState(removedCustom, "豉汁排骨");
  const filtered = mergeDishPool(DISH_POOL, hiddenBuiltIn.customDishes, hiddenBuiltIn.deletedDishes);
  const allDishes = filtered.flatMap((category) => category.dishes);

  assert.deepEqual(deduped, ["五邑小炒"]);
  assert.equal(withCustom[0].name, "自定义菜品");
  assert.ok(withCustom[0].dishes.includes("五邑小炒"));
  assert.deepEqual(removedCustom.customDishes, []);
  assert.deepEqual(hiddenBuiltIn.deletedDishes, ["豉汁排骨"]);
  assert.equal(allDishes.includes("豉汁排骨"), false);
});

test("duplicate dish markers include both dates within a ten day window", () => {
  const plan = [
    {
      date: "2026-01-01",
      weekday: "周四",
      combo: "豉汁排骨 + 蒜蓉通菜",
      dishes: ["豉汁排骨", "蒜蓉通菜"],
      style: "大排档",
    },
    {
      date: "2026-01-08",
      weekday: "周四",
      combo: "沙姜鸡尖 + 蒜蓉通菜",
      dishes: ["沙姜鸡尖", "蒜蓉通菜"],
      style: "下酒",
    },
    {
      date: "2026-01-20",
      weekday: "周二",
      combo: "椒盐鱼骨 + 蒜蓉通菜",
      dishes: ["椒盐鱼骨", "蒜蓉通菜"],
      style: "鱼档",
    },
  ];

  assert.deepEqual(findTenDayDuplicateDishes(plan), {
    "2026-01-01": ["蒜蓉通菜"],
    "2026-01-08": ["蒜蓉通菜"],
  });
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

test("meal insight labels pairings, records, and duplicate risk", () => {
  const item = {
    date: "2026-01-01",
    weekday: "周四",
    combo: "铁板牛肉 + 沙姜鸡尖",
    dishes: ["铁板牛肉", "沙姜鸡尖"],
    style: "大排档下酒",
    recorded: true,
  };
  const plan = [
    item,
    {
      date: "2026-01-05",
      weekday: "周一",
      combo: "豉汁排骨 + 沙姜鸡尖",
      dishes: ["豉汁排骨", "沙姜鸡尖"],
      style: "下酒",
    },
  ];

  const insight = getMealInsight(item, plan, [{ date: item.date }]);

  assert.deepEqual(insight.tags.slice(0, 3), ["下酒搭配", "已记录", "重复风险"]);
  assert.equal(insight.repeatedDishes.includes("沙姜鸡尖"), true);
  assert.match(insight.reason, /一份主菜/);
  assert.match(insight.reason, /10 天内撞菜/);
});

test("smart reassigned plans prefer unrecorded pairings without nearby duplicates", () => {
  const plan = [
    {
      date: "2026-01-01",
      weekday: "周四",
      combo: "豉汁排骨 + 蒜蓉通菜",
      dishes: ["豉汁排骨", "蒜蓉通菜"],
      style: "大排档",
    },
    {
      date: "2026-01-02",
      weekday: "周五",
      combo: "沙姜鸡尖 + 凉拌青瓜",
      dishes: ["沙姜鸡尖", "凉拌青瓜"],
      style: "下酒",
    },
    {
      date: "2026-01-03",
      weekday: "周六",
      combo: "铁板牛肉 + 椒盐鱼骨",
      dishes: ["铁板牛肉", "椒盐鱼骨"],
      style: "大排档下酒",
    },
    {
      date: "2026-01-04",
      weekday: "周日",
      combo: "烧排骨 + 沙姜鸡尖",
      dishes: ["烧排骨", "沙姜鸡尖"],
      style: "夜宵",
    },
  ];

  const reassigned = getSmartReassignedPlan("2026-01-01", plan, 1, [{ date: "2026-01-02" }]);

  assert.equal(reassigned.date, "2026-01-01");
  assert.deepEqual(reassigned.dishes, ["铁板牛肉", "椒盐鱼骨"]);
  assert.equal(reassigned.style, "大排档下酒");
  assert.deepEqual(findSameDishFamilies(reassigned.dishes), []);
});

test("smart reassigned plans rotate through different options as offset changes", () => {
  const combos = Array.from({ length: 6 }, (_, index) =>
    getSmartReassignedPlan("2026-04-29", MENU_PLAN, index + 1, []).combo,
  );

  assert.ok(new Set(combos).size >= 4, combos.join(" | "));
});

test("week plans returns a ten-day window starting from the selected date", () => {
  const week = getWeekPlans("2026-02-26", MENU_PLAN);

  assert.equal(week.length, 10);
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
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
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
