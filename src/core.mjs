export const BANNED_TERMS = [
  "白饭",
  "烧鹅饭",
  "排骨饭",
  "炒饭",
  "煲仔饭",
  "鹅翼",
  "鹅掌翼",
  "鹅肠",
  "鸭掌",
  "海带结",
  "鸭胗",
  "咸水角",
  "蜂巢芋角",
  "鲜竹卷",
  "虾",
  "蟹",
  "扇贝",
  "圣子",
  "花甲",
  "濑尿虾",
  "河虾",
  "腐皮炸春卷",
  "炸云吞",
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DISH_FAMILY_RULES = [
  {
    family: "水产",
    terms: [
      "鱼头",
      "鱼腩",
      "鱼皮",
      "鱼骨",
      "鱼肠",
      "鱼滑",
      "鱼蛋",
      "鱼饼",
      "咸鱼",
      "鲮鱼",
      "马鲛",
      "黄花鱼",
      "仓鱼",
      "乌头",
      "带鱼",
      "九肚鱼",
      "鱿鱼",
      "田螺",
      "黄沙蚬",
      "蚬",
      "青口",
      "烤鱼",
      "酿鲮",
    ],
  },
  { family: "猪内脏", terms: ["猪肚", "生肠", "粉肠", "大肠", "猪杂", "猪红", "猪耳", "猪舌"] },
  { family: "牛", terms: ["牛", "金钱肚"] },
  {
    family: "猪肉",
    terms: ["排骨", "猪扒", "猪手", "猪尾", "叉烧", "烧肉", "肉饼", "火腩", "猪肉", "猪皮", "瘦肉"],
  },
  { family: "鹅杂", terms: ["鹅肾", "鹅杂"] },
  { family: "鸡", terms: ["鸡", "凤爪", "鸡脚", "鸡软骨", "鸡中宝", "鸡尖", "鸡翅尖"], excludeTerms: ["鸡蛋"] },
  { family: "鸭", terms: ["鸭脖", "鸭锁骨", "鸭舌"] },
  { family: "豆制品", terms: ["豆腐", "豆干", "腐竹", "千张", "素鸡"] },
  {
    family: "青菜",
    terms: [
      "通菜",
      "菜心",
      "生菜",
      "油麦菜",
      "豆苗",
      "芥兰",
      "苋菜",
      "青瓜",
      "娃娃菜",
      "西洋菜",
      "唐生菜",
      "枸杞叶",
      "番薯叶",
      "水东芥菜",
      "苦麦菜",
      "菠菜",
      "白菜仔",
      "桑叶",
      "胜瓜",
      "凉瓜",
      "夜香花",
      "西兰花",
      "菜远",
      "秋葵",
      "莴笋",
      "茄子",
    ],
  },
  { family: "粉面粥", terms: ["炒粉", "粥", "炒面", "米粉", "牛河", "炒河", "濑粉", "捞面", "肠粉", "银针粉"] },
  { family: "小食", terms: ["花生", "毛豆", "藕片", "土豆片"] },
];

export function getDishFamilies(dish) {
  const family = DISH_FAMILY_RULES.find((rule) => {
    const excluded = rule.excludeTerms?.some((term) => dish.includes(term));
    return !excluded && rule.terms.some((term) => dish.includes(term));
  });

  return family ? [family.family] : [];
}

export function findSameDishFamilies(dishes) {
  const seen = new Map();
  const repeated = new Map();

  for (const dish of dishes) {
    for (const family of getDishFamilies(dish)) {
      if (!seen.has(family)) {
        seen.set(family, dish);
        continue;
      }

      const entry = repeated.get(family) ?? { family, dishes: [seen.get(family)] };
      if (!entry.dishes.includes(dish)) {
        entry.dishes.push(dish);
      }
      repeated.set(family, entry);
    }
  }

  return [...repeated.values()];
}

export function searchDishPool(dishPool, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return dishPool;
  }

  return dishPool
    .map((category) => {
      const categoryMatches = category.name.toLowerCase().includes(normalized);
      const dishes = category.dishes.filter((dish) => categoryMatches || dish.toLowerCase().includes(normalized));
      return { ...category, dishes };
    })
    .filter((category) => category.dishes.length > 0);
}

export function addCustomDish(customDishes, dish) {
  const normalized = dish.trim();
  if (!normalized || customDishes.includes(normalized)) {
    return customDishes;
  }
  return [...customDishes, normalized];
}

export function removeDishFromPoolState(state, dish) {
  const normalized = dish.trim();
  if (!normalized) {
    return state;
  }

  if (state.customDishes.includes(normalized)) {
    return {
      customDishes: state.customDishes.filter((item) => item !== normalized),
      deletedDishes: state.deletedDishes.filter((item) => item !== normalized),
    };
  }

  if (state.deletedDishes.includes(normalized)) {
    return state;
  }

  return {
    customDishes: state.customDishes,
    deletedDishes: [...state.deletedDishes, normalized],
  };
}

export function mergeDishPool(dishPool, customDishes = [], deletedDishes = []) {
  const deleted = new Set(deletedDishes);
  const custom = customDishes.filter((dish) => !deleted.has(dish));
  const merged = dishPool
    .map((category) => ({
      ...category,
      dishes: category.dishes.filter((dish) => !deleted.has(dish) && !custom.includes(dish)),
    }))
    .filter((category) => category.dishes.length > 0);

  if (custom.length) {
    merged.unshift({ name: "自定义菜品", dishes: custom });
  }

  return merged;
}

export function isSelectedDish(dish, selectedDish) {
  return selectedDish.trim() !== "" && dish === selectedDish;
}

export function sortMealRecords(records) {
  return [...records].sort((left, right) => right.date.localeCompare(left.date));
}

export function upsertMealRecord(records, plan) {
  const existing = records.find((record) => record.date === plan.date);
  const nextRecord = {
    date: plan.date,
    weekday: plan.weekday,
    combo: plan.combo,
    note: existing?.note ?? "",
    updatedAt: new Date().toISOString(),
  };
  const withoutCurrent = records.filter((record) => record.date !== plan.date);
  return sortMealRecords([nextRecord, ...withoutCurrent]);
}

export function updateMealRecord(records, date, patch) {
  return sortMealRecords(
    records.map((record) =>
      record.date === date
        ? {
            ...record,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : record,
    ),
  );
}

export function comboToDishes(combo) {
  return String(combo ?? "")
    .split(/\s*(?:\+|、|，|,|\/|；|;|\n+)\s*/)
    .map((dish) => dish.trim())
    .filter(Boolean);
}

export function applyMealRecordsToPlan(plan, records) {
  const recordsByDate = new Map(records.map((record) => [record.date, record]));

  return plan.map((item) => {
    const record = recordsByDate.get(item.date);
    if (!record) {
      return item;
    }

    const combo = String(record.combo ?? "").trim() || item.combo;
    const dishes = comboToDishes(combo);
    return {
      ...item,
      combo,
      dishes: dishes.length ? dishes : item.dishes,
      note: record.note ?? "",
      recorded: true,
    };
  });
}

export function replaceDishInPlanItem(item, oldDish, newDish) {
  const oldName = oldDish.trim();
  const newName = newDish.trim();
  const index = item.dishes.findIndex((dish) => dish === oldName);
  if (index < 0 || !newName) {
    return item;
  }

  const dishes = item.dishes.map((dish, dishIndex) => (dishIndex === index ? newName : dish));
  return {
    ...item,
    dishes,
    combo: dishes.join(" + "),
  };
}

function addDuplicateDish(duplicates, date, dish) {
  if (!duplicates.has(date)) {
    duplicates.set(date, new Set());
  }
  duplicates.get(date).add(dish);
}

export function findTenDayDuplicateDishes(plan) {
  const duplicates = new Map();

  for (let index = 0; index < plan.length; index += 1) {
    const currentDishes = new Set(plan[index].dishes.map((dish) => dish.trim()).filter(Boolean));
    const currentDate = new Date(`${plan[index].date}T00:00:00`);
    for (let previous = 0; previous < index; previous += 1) {
      const previousDate = new Date(`${plan[previous].date}T00:00:00`);
      const daysBetween = Math.abs((currentDate.getTime() - previousDate.getTime()) / MS_PER_DAY);
      if (daysBetween > 10) {
        continue;
      }
      for (const dish of plan[previous].dishes) {
        const normalized = dish.trim();
        if (normalized && currentDishes.has(normalized)) {
          addDuplicateDish(duplicates, plan[previous].date, normalized);
          addDuplicateDish(duplicates, plan[index].date, normalized);
        }
      }
    }
  }

  return Object.fromEntries([...duplicates.entries()].map(([date, dishes]) => [date, [...dishes]]));
}

export function searchMenuPlan(plan, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return plan;
  }

  return plan.filter((item) => {
    const text = [item.date, item.weekday, item.combo, item.style, ...item.dishes].join(" ").toLowerCase();
    return text.includes(normalized);
  });
}

export function groupPlansByMonth(plan) {
  const groups = new Map();

  for (const item of plan) {
    const month = `${Number(item.date.slice(5, 7))}月`;
    if (!groups.has(month)) {
      groups.set(month, { month, items: [] });
    }
    groups.get(month).items.push(item);
  }

  return [...groups.values()];
}

export function normalizeTo2026(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  const month = date.getMonth();
  const day = date.getDate();
  const normalized = new Date(2026, month, day);

  if (month === 1 && day === 29) {
    return "2026-02-28";
  }

  return formatDate(normalized);
}

export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPlanForDate(value, plan) {
  const date = normalizeTo2026(value);
  const item = plan.find((entry) => entry.date === date);
  if (!item) {
    throw new Error(`No plan found for ${date}`);
  }
  return item;
}

export function getAlternatePlan(value, plan, offset = 1) {
  const source = getPlanForDate(value, plan);
  const sourceDishes = new Set(source.dishes);
  const sourceIndex = plan.findIndex((entry) => entry.date === source.date);

  for (let distance = offset; distance < plan.length; distance += 1) {
    const candidate = plan[(sourceIndex + distance) % plan.length];
    if (!candidate.dishes.some((dish) => sourceDishes.has(dish))) {
      return candidate;
    }
  }

  return source;
}

function hasBannedTerm(text) {
  return BANNED_TERMS.some((term) => text.includes(term));
}

function isDishCompatible(candidate, currentDishes) {
  return findSameDishFamilies([...currentDishes, candidate]).length === 0;
}

function pickReplacementDish(plan, sourceIndex, slotIndex, offset, blockedDishes, currentDishes) {
  for (let distance = offset; distance < plan.length + offset; distance += 1) {
    const candidate = plan[(sourceIndex + distance) % plan.length].dishes[slotIndex];
    if (
      candidate &&
      !blockedDishes.has(candidate) &&
      !hasBannedTerm(candidate) &&
      isDishCompatible(candidate, currentDishes)
    ) {
      return candidate;
    }
  }

  for (const item of plan) {
    for (const candidate of item.dishes) {
      if (!blockedDishes.has(candidate) && !hasBannedTerm(candidate) && isDishCompatible(candidate, currentDishes)) {
        return candidate;
      }
    }
  }

  throw new Error("No replacement dish available");
}

export function getReassignedPlan(value, plan, offset = 1) {
  const source = getPlanForDate(value, plan);
  const sourceIndex = plan.findIndex((entry) => entry.date === source.date);
  const blockedDishes = new Set(source.dishes);
  const dishes = [];

  for (let slotIndex = 0; slotIndex < source.dishes.length; slotIndex += 1) {
    const dish = pickReplacementDish(plan, sourceIndex, slotIndex, offset + slotIndex * 3, blockedDishes, dishes);
    blockedDishes.add(dish);
    dishes.push(dish);
  }

  return {
    ...source,
    dishes,
    combo: dishes.join(" + "),
  };
}

export function getWeekPlans(value, plan) {
  const start = new Date(`${normalizeTo2026(value)}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * MS_PER_DAY);
    return getPlanForDate(formatDate(date), plan);
  });
}

export function buildShareText(item) {
  return `${item.date} ${item.weekday} 今晚吃：${item.combo}`;
}

export function validateMenuPlan(plan) {
  const errors = [];

  if (plan.length !== 365) {
    errors.push(`expected 365 days, got ${plan.length}`);
  }

  for (const item of plan) {
    const text = `${item.combo} ${item.dishes.join(" ")}`;
    const banned = BANNED_TERMS.filter((term) => text.includes(term));
    if (banned.length) {
      errors.push(`${item.date} contains banned terms: ${banned.join(", ")}`);
    }

    const repeatedFamilies = findSameDishFamilies(item.dishes);
    if (repeatedFamilies.length) {
      const detail = repeatedFamilies.map((entry) => `${entry.family}(${entry.dishes.join("、")})`).join(", ");
      errors.push(`${item.date} contains same dish family: ${detail}`);
    }
  }

  const combos = new Set();
  for (const item of plan) {
    if (combos.has(item.combo)) {
      errors.push(`${item.date} repeats combo: ${item.combo}`);
    }
    combos.add(item.combo);
  }

  for (let index = 0; index < plan.length; index += 1) {
    const dishes = new Set(plan[index].dishes);
    for (let previous = Math.max(0, index - 10); previous < index; previous += 1) {
      const overlap = plan[previous].dishes.filter((dish) => dishes.has(dish));
      if (overlap.length) {
        errors.push(
          `${plan[index].date} repeats ${overlap.join(", ")} within 10 days of ${plan[previous].date}`,
        );
      }
    }
  }

  return errors;
}
