(function () {
  const BANNED_TERMS = [
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

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeTo2026(value) {
    const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${value}`);
    }

    const month = date.getMonth();
    const day = date.getDate();
    if (month === 1 && day === 29) {
      return "2026-02-28";
    }

    return formatDate(new Date(2026, month, day));
  }

  function getPlanForDate(value, plan) {
    const date = normalizeTo2026(value);
    const item = plan.find((entry) => entry.date === date);
    if (!item) {
      throw new Error(`No plan found for ${date}`);
    }
    return item;
  }

  function getAlternatePlan(value, plan, offset) {
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

  function getWeekPlans(value, plan) {
    const start = new Date(`${normalizeTo2026(value)}T00:00:00`);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start.getTime() + index * MS_PER_DAY);
      return getPlanForDate(formatDate(date), plan);
    });
  }

  function buildShareText(item) {
    return `${item.date} ${item.weekday} 今晚吃：${item.combo}`;
  }

  window.FoodCore = {
    BANNED_TERMS,
    buildShareText,
    formatDate,
    getAlternatePlan,
    getPlanForDate,
    getWeekPlans,
    normalizeTo2026,
  };
})();
