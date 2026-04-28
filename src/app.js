(function () {
  const {
    addCustomDish,
    applyMealRecordsToPlan,
    applyMenuOverridesToPlan,
    BANNED_TERMS,
    buildShareText,
    comboToDishes,
    findSameDishFamilies,
    findTenDayDuplicateDishes,
    formatDate,
    getMealInsight,
    getPlanForDate,
    getSmartReassignedPlan,
    getWeekPlans,
    groupPlansByMonth,
    isSelectedDish,
    mergeDishPool,
    removeDishFromPoolState,
    replaceDishInPlanItem,
    searchDishPool,
    searchMenuPlan,
    updateMealRecord,
    upsertMealRecord,
    upsertMenuOverride,
  } = window.FoodCore;
  const MENU_PLAN = window.MENU_PLAN;
  const DISH_POOL = window.DISH_POOL;
  const RECORDS_STORAGE_KEY = "jiangmen-food-records";
  const OVERRIDES_STORAGE_KEY = "jiangmen-food-overrides";
  const CATALOG_STORAGE_KEY = "jiangmen-food-catalog";

  const dockButtons = document.querySelectorAll(".dock-button[data-view]");
  const sheetPanels = document.querySelectorAll("[data-sheet-panel]");
  const sheetOverlay = document.querySelector("#sheetOverlay");
  const appSheet = document.querySelector("#appSheet");
  const sheetCloseButton = document.querySelector("#sheetCloseButton");
  const sheetTitle = document.querySelector("#sheetTitle");
  const sheetEyebrow = document.querySelector("#sheetEyebrow");
  const dateLabel = document.querySelector("#dateLabel");
  const styleLabel = document.querySelector("#styleLabel");
  const recommendation = document.querySelector(".recommendation");
  const comboTitle = document.querySelector("#comboTitle");
  const recommendReason = document.querySelector("#recommendReason");
  const insightGrid = document.querySelector("#insightGrid");
  const duplicateNote = document.querySelector("#duplicateNote");
  const dishList = document.querySelector("#dishList");
  const weekList = document.querySelector("#weekList");
  const toast = document.querySelector("#toast");
  const datePicker = document.querySelector("#datePicker");
  const copyButton = document.querySelector("#copyButton");
  const shuffleButtons = document.querySelectorAll("[data-shuffle]");
  const recordButton = document.querySelector("#recordButton");
  const todayButton = document.querySelector("#todayButton");
  const ruleDialog = document.querySelector("#ruleDialog");
  const yearDatePicker = document.querySelector("#yearDatePicker");
  const yearSearchInput = document.querySelector("#yearSearchInput");
  const yearSelected = document.querySelector("#yearSelected");
  const yearCalendar = document.querySelector("#yearCalendar");
  const yearCount = document.querySelector("#yearCount");
  const catalogSearchInput = document.querySelector("#catalogSearchInput");
  const catalogEditor = document.querySelector("#catalogEditor");
  const catalogEditButton = document.querySelector("#catalogEditButton");
  const customDishInput = document.querySelector("#customDishInput");
  const addDishButton = document.querySelector("#addDishButton");
  const catalogHint = document.querySelector("#catalogHint");
  const catalogList = document.querySelector("#catalogList");
  const catalogCount = document.querySelector("#catalogCount");
  const recordList = document.querySelector("#recordList");
  const recordCount = document.querySelector("#recordCount");

  const SHEET_TITLES = {
    year: { eyebrow: "全年菜单", title: "日历和搜索" },
    records: { eyebrow: "已吃记录", title: "日期记录表" },
    catalog: { eyebrow: "菜谱库", title: "总菜谱" },
    more: { eyebrow: "更多操作", title: "控制中心" },
  };

  const catalogState = loadCatalogState();
  const mealData = loadMealData();
  const state = {
    activeView: "today",
    selectedDate: formatDate(new Date()),
    reassignOffset: 1,
    currentPlan: null,
    selectedDish: "",
    replacementTarget: null,
    catalogFeedback: "",
    catalogEditing: false,
    mealRecords: mealData.mealRecords,
    menuOverrides: mealData.menuOverrides,
    customDishes: catalogState.customDishes,
    deletedDishes: catalogState.deletedDishes,
  };

  function preventPageZoom() {
    let lastTouchEnd = 0;
    const preventDefault = (event) => event.preventDefault();
    const zoomKeys = new Set(["+", "-", "=", "0", "_"]);

    for (const eventName of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(eventName, preventDefault, { passive: false });
    }

    document.addEventListener(
      "touchend",
      (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          event.preventDefault();
        }
        lastTouchEnd = now;
      },
      { passive: false },
    );

    document.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey) {
          event.preventDefault();
        }
      },
      { passive: false },
    );

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && zoomKeys.has(event.key)) {
        event.preventDefault();
      }
    });
  }

  preventPageZoom();

  function getEffectivePlan() {
    return applyMealRecordsToPlan(applyMenuOverridesToPlan(MENU_PLAN, state.menuOverrides), state.mealRecords);
  }

  function getCatalogPool() {
    return mergeDishPool(DISH_POOL, state.customDishes, state.deletedDishes);
  }

  function getPreviewPlan(plan) {
    return getEffectivePlan().map((item) => (item.date === plan.date ? { ...item, ...plan } : item));
  }

  function getDuplicateMap(plan = getEffectivePlan()) {
    return findTenDayDuplicateDishes(plan);
  }

  function getDuplicateDishes(date, duplicateMap) {
    return duplicateMap[date] ?? [];
  }

  function dishesToDisplay(dishes) {
    return dishes.join("、");
  }

  function render(plan) {
    const duplicateMap = getDuplicateMap(getPreviewPlan(plan));
    const repeatedDishes = getDuplicateDishes(plan.date, duplicateMap);
    const insight = getMealInsight(plan, getPreviewPlan(plan), state.mealRecords);
    state.currentPlan = plan;
    dateLabel.textContent = `${plan.date} ${plan.weekday}`;
    if (styleLabel) {
      styleLabel.textContent = plan.recorded ? `${plan.style} · 已记录` : plan.style;
    }
    comboTitle.textContent = dishesToDisplay(plan.dishes);
    if (recommendReason) {
      recommendReason.textContent = insight.reason;
    }
    recommendation.classList.toggle("has-risk", repeatedDishes.length > 0);
    renderInsightTags(insight);
    duplicateNote.hidden = repeatedDishes.length === 0;
    duplicateNote.textContent = repeatedDishes.length ? `已重复：${repeatedDishes.join("、")}` : "";
    dishList.replaceChildren(
      ...plan.dishes.map((dish, dishIndex) => {
        const chip = createDishButton(dish, "dish-chip", plan.date, dishIndex);
        chip.classList.toggle("repeated", repeatedDishes.includes(dish));
        return chip;
      }),
    );

    datePicker.value = plan.date;
    renderWeek(plan.date, getPreviewPlan(plan));
    renderYearSelected(plan.date);
  }

  function renderInsightTags(insight) {
    if (!insightGrid) {
      return;
    }
    insightGrid.replaceChildren(
      ...insight.tags.slice(0, 6).map((tag) => {
        const item = createTextElement("span", "insight-pill", tag);
        item.classList.toggle("warning", tag === "重复风险");
        item.classList.toggle("good", tag === "10天避重" || tag === "已记录");
        return item;
      }),
    );
  }

  function renderWeek(date, plan = getEffectivePlan()) {
    const effectivePlan = plan;
    const duplicateMap = getDuplicateMap(effectivePlan);
    const items = getWeekPlans(date, effectivePlan);
    weekList.replaceChildren(
      ...items.map((item) => {
        const insight = getMealInsight(item, effectivePlan, state.mealRecords);
        const row = document.createElement("article");
        row.className = "week-item";
        row.classList.toggle("selected", item.date === state.selectedDate);
        row.classList.toggle("recorded", insight.recorded);

        const label = document.createElement("div");
        label.className = "week-date";
        label.replaceChildren(
          createTextElement("span", "week-day", item.weekday),
          createTextElement("span", "week-date-number", item.date.slice(5)),
        );

        const content = document.createElement("div");
        content.className = "week-content";
        const combo = document.createElement("div");
        combo.className = "week-dishes";
        const repeatedDishes = getDuplicateDishes(item.date, duplicateMap);
        combo.replaceChildren(
          ...item.dishes.map((dish, dishIndex) => {
            const chip = createDishButton(dish, "week-dish-button", item.date, dishIndex);
            chip.classList.toggle("repeated", repeatedDishes.includes(dish));
            return chip;
          }),
        );
        const metaTags = [];
        if (insight.recorded) {
          metaTags.push("已记录");
        }
        if (repeatedDishes.length) {
          metaTags.push(`已重复：${repeatedDishes.join("、")}`);
        }

        content.append(combo);
        if (metaTags.length) {
          const meta = document.createElement("div");
          meta.className = "week-meta";
          meta.replaceChildren(
            ...metaTags.map((tag) => {
              const pill = createTextElement("span", "week-meta-pill", tag);
              pill.classList.toggle("warning", tag.startsWith("已重复"));
              return pill;
            }),
          );
          content.append(meta);
        }
        row.append(label, content);
        return row;
      }),
    );
  }

  function showToast(message) {
    toast.textContent = message;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.textContent = "";
    }, 1500);
  }

  function readStoredList(storageKey) {
    try {
      const value = window.localStorage.getItem(storageKey);
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  }

  function normalizePlanEntries(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item) => item && typeof item.date === "string" && typeof item.combo === "string")
      .map((item) => ({
        ...item,
        date: item.date,
        weekday: item.weekday ?? "",
        combo: item.combo,
        note: item.note ?? "",
      }));
  }

  function loadMealData() {
    const today = formatDate(new Date());
    const storedRecords = normalizePlanEntries(readStoredList(RECORDS_STORAGE_KEY));
    let menuOverrides = normalizePlanEntries(readStoredList(OVERRIDES_STORAGE_KEY));
    const mealRecords = [];
    let migratedFutureRecord = false;

    for (const record of storedRecords) {
      if (record.date > today) {
        menuOverrides = upsertMenuOverride(menuOverrides, record);
        migratedFutureRecord = true;
      } else {
        mealRecords.push(record);
      }
    }

    if (migratedFutureRecord) {
      window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(mealRecords));
      window.localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(menuOverrides));
    }

    return { mealRecords, menuOverrides };
  }

  function saveMealRecords() {
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(state.mealRecords));
  }

  function saveMenuOverrides() {
    window.localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(state.menuOverrides));
  }

  function pruneFutureMealRecords() {
    const today = formatDate(new Date());
    const futureRecords = state.mealRecords.filter((record) => record.date > today);
    if (!futureRecords.length) {
      return;
    }

    for (const record of futureRecords) {
      state.menuOverrides = upsertMenuOverride(state.menuOverrides, record);
    }
    state.mealRecords = state.mealRecords.filter((record) => record.date <= today);
    saveMenuOverrides();
    saveMealRecords();
  }

  function loadCatalogState() {
    try {
      const value = window.localStorage.getItem(CATALOG_STORAGE_KEY);
      const parsed = value ? JSON.parse(value) : {};
      return {
        customDishes: normalizeDishList(parsed.customDishes),
        deletedDishes: normalizeDishList(parsed.deletedDishes),
      };
    } catch {
      return {
        customDishes: [],
        deletedDishes: [],
      };
    }
  }

  function normalizeDishList(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  function saveCatalogState() {
    window.localStorage.setItem(
      CATALOG_STORAGE_KEY,
      JSON.stringify({
        customDishes: state.customDishes,
        deletedDishes: state.deletedDishes,
      }),
    );
  }

  async function copyCurrentPlan() {
    const text = buildShareText(state.currentPlan);
    try {
      await navigator.clipboard.writeText(text);
      showToast("已复制");
    } catch {
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      showToast("已复制");
    }
  }

  function showSelectedDate(date) {
    state.selectedDate = date;
    state.reassignOffset = 1;
    render(getPlanForDate(date, getEffectivePlan()));
  }

  function updateDockState(viewName) {
    const dockView = viewName === "today" ? "today" : "more";
    dockButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === dockView);
    });
  }

  function renderSheetContent(viewName) {
    if (viewName === "year") {
      renderYearCalendar();
    }
    if (viewName === "catalog") {
      renderCatalog();
    }
    if (viewName === "records") {
      renderRecords();
    }
  }

  function openSheet(viewName) {
    const sheetCopy = SHEET_TITLES[viewName] ?? SHEET_TITLES.more;
    state.activeView = viewName;
    window.clearTimeout(closeSheet.timer);
    sheetEyebrow.textContent = sheetCopy.eyebrow;
    sheetTitle.textContent = sheetCopy.title;
    sheetPanels.forEach((panel) => {
      const isActive = panel.dataset.sheetPanel === viewName;
      panel.hidden = !isActive;
      panel.classList.toggle("active", isActive);
    });
    renderSheetContent(viewName);
    appSheet.hidden = false;
    sheetOverlay.hidden = false;
    document.body.classList.add("sheet-open");
    window.requestAnimationFrame(() => {
      appSheet.classList.add("is-open");
      sheetOverlay.classList.add("is-open");
    });
    updateDockState(viewName);
  }

  function closeSheet() {
    state.activeView = "today";
    appSheet.classList.remove("is-open");
    sheetOverlay.classList.remove("is-open");
    document.body.classList.remove("sheet-open");
    updateDockState("today");
    window.clearTimeout(closeSheet.timer);
    closeSheet.timer = window.setTimeout(() => {
      if (!appSheet.classList.contains("is-open")) {
        appSheet.hidden = true;
        sheetOverlay.hidden = true;
        sheetPanels.forEach((panel) => {
          panel.hidden = true;
          panel.classList.remove("active");
        });
      }
    }, 240);
  }

  function setView(viewName) {
    if (viewName === "today") {
      state.replacementTarget = null;
      state.catalogFeedback = "";
      closeSheet();
      return;
    }

    if (viewName !== "catalog") {
      state.replacementTarget = null;
      state.catalogFeedback = "";
    }
    openSheet(viewName);
  }

  function openDishInCatalog(dish, date = state.selectedDate, sourceView = state.activeView, dishIndex) {
    state.selectedDish = dish;
    state.catalogEditing = false;
    state.catalogFeedback = "";
    state.replacementTarget = {
      date,
      dish,
      dishIndex: Number.isInteger(Number(dishIndex)) ? Number(dishIndex) : undefined,
      plan: getReplacementSourcePlan(date, sourceView),
      returnDate: state.selectedDate,
      sourceView,
    };
    catalogSearchInput.value = "";
    setView("catalog");
  }

  function getReplacementSourcePlan(date, sourceView) {
    if (sourceView === "today" && state.currentPlan?.date === date) {
      return state.currentPlan;
    }
    return getPlanForDate(date, getEffectivePlan());
  }

  function renderYearSelected(date) {
    if (!yearSelected) {
      return;
    }
    const effectivePlan = getEffectivePlan();
    const duplicateMap = getDuplicateMap(effectivePlan);
    const plan = getPlanForDate(date, effectivePlan);
    const repeatedDishes = getDuplicateDishes(plan.date, duplicateMap);
    yearDatePicker.value = plan.date;

    const dishButtons = document.createElement("div");
    dishButtons.className = "selected-dish-list";
    dishButtons.replaceChildren(
      ...plan.dishes.map((dish, dishIndex) => {
        const chip = createDishButton(dish, "selected-dish-button", plan.date, dishIndex);
        chip.classList.toggle("repeated", repeatedDishes.includes(dish));
        return chip;
      }),
    );

    const children = [
      createTextElement("div", "selected-date", `${plan.date} ${plan.weekday}`),
      dishButtons,
      createTextElement("span", "selected-style", plan.style),
    ];
    if (repeatedDishes.length) {
      children.splice(3, 0, createTextElement("span", "duplicate-note inline", `已重复：${repeatedDishes.join("、")}`));
    }
    yearSelected.replaceChildren(...children);
  }

  function renderYearCalendar() {
    const effectivePlan = getEffectivePlan();
    const duplicateMap = getDuplicateMap(effectivePlan);
    const items = searchMenuPlan(effectivePlan, yearSearchInput.value);
    const months = groupPlansByMonth(items);
    yearCount.textContent = `${items.length} 天`;
    yearCalendar.replaceChildren(
      ...months.map((month) => {
        const section = document.createElement("section");
        section.className = "month-block";
        section.append(
          createTextElement("h3", "", month.month),
          createMonthDays(month.items, duplicateMap),
        );
        return section;
      }),
    );

    if (!items.length) {
      yearCalendar.append(createTextElement("p", "empty-state", "没有匹配菜单"));
    }
  }

  function createMonthDays(items, duplicateMap) {
    const list = document.createElement("div");
    list.className = "month-days";
    list.replaceChildren(...items.map((item) => createYearDayButton(item, duplicateMap)));
    return list;
  }

  function createYearDayButton(item, duplicateMap) {
    const repeatedDishes = getDuplicateDishes(item.date, duplicateMap);
    const row = document.createElement("article");
    row.className = "year-day";
    row.dataset.date = item.date;
    row.classList.toggle("selected", item.date === state.selectedDate);
    row.classList.toggle("repeated", repeatedDishes.length > 0);

    const dateButton = document.createElement("button");
    dateButton.className = "year-day-date-button";
    dateButton.type = "button";
    dateButton.dataset.date = item.date;
    dateButton.textContent = `${item.date.slice(5)} ${item.weekday}`;

    const dishes = document.createElement("div");
    dishes.className = "year-day-dishes";
    dishes.replaceChildren(
      ...item.dishes.map((dish, dishIndex) => {
        const chip = createDishButton(dish, "year-dish-button", item.date, dishIndex);
        chip.classList.toggle("repeated", repeatedDishes.includes(dish));
        return chip;
      }),
    );

    row.append(
      dateButton,
      dishes,
      repeatedDishes.length ? createTextElement("span", "repeat-tag", `已重复：${repeatedDishes.join("、")}`) : createTextElement("span", "year-day-style", item.style),
    );
    return row;
  }

  function renderCatalog() {
    const categories = searchDishPool(getCatalogPool(), catalogSearchInput.value);
    const total = categories.reduce((sum, category) => sum + category.dishes.length, 0);
    catalogCount.textContent = `${total} 道`;
    catalogEditButton.textContent = state.catalogEditing ? "完成" : "编辑";
    catalogEditButton.setAttribute("aria-pressed", String(state.catalogEditing));
    catalogEditor.hidden = !state.catalogEditing;
    if (state.replacementTarget) {
      catalogHint.hidden = false;
      catalogHint.classList.toggle("has-feedback", state.catalogFeedback !== "");
      const dishPosition =
        Number.isInteger(state.replacementTarget.dishIndex) ? `第 ${state.replacementTarget.dishIndex + 1} 个` : "";
      const baseHint = `正在替换${dishPosition}：${state.replacementTarget.dish}。点一个菜名即可更新。`;
      catalogHint.textContent = state.catalogFeedback ? `${baseHint} ${state.catalogFeedback}` : baseHint;
    } else {
      catalogHint.hidden = true;
      catalogHint.classList.remove("has-feedback");
      catalogHint.textContent = "";
    }
    catalogList.replaceChildren(
      ...categories.map((category) => {
        const section = document.createElement("section");
        section.className = "catalog-category";
        section.append(
          createTextElement("h3", "", `${category.name} · ${category.dishes.length}`),
          createDishGrid(category.dishes),
        );
        return section;
      }),
    );

    if (!categories.length) {
      catalogList.append(createTextElement("p", "empty-state", "没有匹配菜品"));
    }
  }

  function createDishGrid(dishes) {
    const grid = document.createElement("div");
    grid.className = "catalog-dishes";
    grid.replaceChildren(
      ...dishes.map((dish) => {
        const item = document.createElement("span");
        item.className = "catalog-dish-item";
        item.classList.toggle("editing", state.catalogEditing);

        const chip = createTextElement("button", "catalog-dish", dish);
        chip.type = "button";
        chip.dataset.dish = dish;
        chip.classList.toggle("selected", isSelectedDish(dish, state.selectedDish));

        item.append(chip);
        if (state.catalogEditing) {
          const deleteButton = createTextElement("button", "delete-dish-button", "×");
          deleteButton.type = "button";
          deleteButton.dataset.dish = dish;
          deleteButton.setAttribute("aria-label", `删除 ${dish}`);
          item.append(deleteButton);
        }
        return item;
      }),
    );
    return grid;
  }

  function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    element.textContent = text;
    return element;
  }

  function createDishButton(dish, className, date, dishIndex) {
    const button = document.createElement("button");
    button.className = `dish-button ${className}`;
    button.type = "button";
    button.dataset.dish = dish;
    if (date) {
      button.dataset.date = date;
    }
    if (Number.isInteger(dishIndex)) {
      button.dataset.dishIndex = String(dishIndex);
    }
    button.textContent = dish;
    return button;
  }

  function refreshFromRecords() {
    render(getPlanForDate(state.selectedDate, getEffectivePlan()));
    renderYearCalendar();
    renderRecords();
    renderCatalog();
  }

  function recordCurrentPlan() {
    if (state.currentPlan.date > formatDate(new Date())) {
      showToast("未来日期不能记录");
      return;
    }

    state.mealRecords = upsertMealRecord(state.mealRecords, state.currentPlan);
    saveMealRecords();
    refreshFromRecords();
    showToast("已记录");
  }

  function renderRecords() {
    pruneFutureMealRecords();
    recordCount.textContent = `${state.mealRecords.length} 条`;
    recordList.replaceChildren(
      ...state.mealRecords.map((record) => {
        const row = document.createElement("article");
        row.className = "record-item";
        row.dataset.date = record.date;

        const meta = document.createElement("div");
        meta.className = "record-meta";
        meta.textContent = `${record.date} ${record.weekday}`;

        const dishes = document.createElement("div");
        dishes.className = "record-dishes";
        dishes.replaceChildren(
          ...comboToDishes(record.combo).map((dish, dishIndex) =>
            createDishButton(dish, "record-dish-button", record.date, dishIndex),
          ),
        );

        const note = document.createElement("textarea");
        note.className = "record-note";
        note.rows = 2;
        note.placeholder = "备注";
        note.value = record.note;
        note.setAttribute("aria-label", `${record.date} 备注`);

        row.append(meta, dishes, note);
        return row;
      }),
    );

    if (!state.mealRecords.length) {
      recordList.append(createTextElement("p", "empty-state", "还没有记录"));
    }
  }

  function updateRecordField(date, field, value) {
    state.mealRecords = updateMealRecord(state.mealRecords, date, { [field]: value });
    saveMealRecords();
    refreshFromRecords();
  }

  function replaceTargetDish(newDish) {
    const target = state.replacementTarget;
    if (!target) {
      state.selectedDish = newDish;
      renderCatalog();
      return;
    }

    const plan = target.plan ?? getPlanForDate(target.date, getEffectivePlan());
    const replaced = replaceDishInPlanItem(plan, target.dish, newDish, target.dishIndex);
    if (replaced === plan) {
      showCatalogFeedback("没有找到要替换的菜");
      return;
    }
    const sameFamilies = findSameDishFamilies(replaced.dishes);
    if (sameFamilies.length) {
      showCatalogFeedback(`同类了：${sameFamilies[0].dishes.join("、")}`);
      return;
    }

    if (target.sourceView === "records") {
      state.mealRecords = upsertMealRecord(state.mealRecords, replaced);
      saveMealRecords();
    } else {
      state.menuOverrides = upsertMenuOverride(state.menuOverrides, replaced);
      saveMenuOverrides();
    }
    state.selectedDate = target.returnDate ?? replaced.date;
    state.selectedDish = newDish;
    const returnView = target.sourceView === "catalog" ? "today" : target.sourceView;
    state.replacementTarget = null;
    state.catalogFeedback = "";
    refreshFromRecords();
    setView(returnView || "today");
    showToast("已替换");
  }

  function addCustomDishFromInput() {
    const dish = customDishInput.value.trim();
    if (!dish) {
      showToast("菜名不能为空");
      return;
    }
    const bannedTerm = BANNED_TERMS.find((term) => dish.includes(term));
    if (bannedTerm) {
      showToast(`忌口：${bannedTerm}`);
      return;
    }

    const wasDeleted = state.deletedDishes.includes(dish);
    const builtInExists = DISH_POOL.some((category) => category.dishes.includes(dish));
    const customExists = state.customDishes.includes(dish);
    if ((builtInExists && !wasDeleted) || customExists) {
      showToast("菜谱里已有");
      return;
    }
    state.deletedDishes = state.deletedDishes.filter((item) => item !== dish);
    state.customDishes = builtInExists ? state.customDishes : addCustomDish(state.customDishes, dish);
    saveCatalogState();
    customDishInput.value = "";
    renderCatalog();
    showToast(wasDeleted ? "已恢复" : "已添加");
  }

  function removeCatalogDish(dish) {
    const next = removeDishFromPoolState(
      {
        customDishes: state.customDishes,
        deletedDishes: state.deletedDishes,
      },
      dish,
    );
    state.customDishes = next.customDishes;
    state.deletedDishes = next.deletedDishes;
    if (state.selectedDish === dish) {
      state.selectedDish = "";
    }
    if (state.replacementTarget?.dish === dish) {
      state.replacementTarget = null;
      state.catalogFeedback = "";
    }
    saveCatalogState();
    renderCatalog();
    showToast("已删除");
  }

  function showCatalogFeedback(message) {
    state.catalogFeedback = message;
    renderCatalog();
    showToast(message);
  }

  function animateRecommendationChange() {
    recommendation.classList.remove("is-changing");
    void recommendation.offsetWidth;
    recommendation.classList.add("is-changing");
  }

  function shuffleCurrentPlan(triggerButton) {
    closeSheet();
    const plan = getSmartReassignedPlan(state.selectedDate, getEffectivePlan(), state.reassignOffset, state.mealRecords);
    state.reassignOffset += 1;
    render(plan);
    animateRecommendationChange();
    triggerButton.classList.remove("is-pulsing");
    void triggerButton.offsetWidth;
    triggerButton.classList.add("is-pulsing");
  }

  dockButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  sheetOverlay.addEventListener("click", closeSheet);
  sheetCloseButton.addEventListener("click", closeSheet);

  appSheet.addEventListener("click", (event) => {
    const ruleButton = event.target.closest("[data-open-rules]");
    if (ruleButton) {
      if (typeof ruleDialog.showModal === "function") {
        ruleDialog.showModal();
      }
      return;
    }

    const target = event.target.closest("[data-sheet-target]");
    if (!target) {
      return;
    }
    setView(target.dataset.sheetTarget);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !appSheet.hidden) {
      closeSheet();
    }
  });

  copyButton.addEventListener("click", copyCurrentPlan);

  recordButton.addEventListener("click", recordCurrentPlan);

  dishList.addEventListener("click", (event) => {
    const button = event.target.closest(".dish-chip");
    if (!button) {
      return;
    }
    openDishInCatalog(button.dataset.dish, button.dataset.date, "today", button.dataset.dishIndex);
  });

  shuffleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      shuffleCurrentPlan(button);
    });
  });

  todayButton.addEventListener("click", () => {
    showSelectedDate(formatDate(new Date()));
  });

  datePicker.addEventListener("change", () => {
    showSelectedDate(datePicker.value);
  });

  yearDatePicker.addEventListener("change", () => {
    showSelectedDate(yearDatePicker.value);
    renderYearCalendar();
  });

  yearSearchInput.addEventListener("input", renderYearCalendar);

  yearCalendar.addEventListener("click", (event) => {
    const dishButton = event.target.closest(".year-dish-button");
    const row = event.target.closest(".year-day");
    if (!row) {
      return;
    }
    showSelectedDate(row.dataset.date);
    renderYearCalendar();
    if (dishButton) {
      openDishInCatalog(dishButton.dataset.dish, row.dataset.date, "year", dishButton.dataset.dishIndex);
    }
  });

  yearSelected.addEventListener("click", (event) => {
    const dishButton = event.target.closest(".selected-dish-button");
    if (dishButton) {
      openDishInCatalog(dishButton.dataset.dish, dishButton.dataset.date, "year", dishButton.dataset.dishIndex);
    }
  });

  weekList.addEventListener("click", (event) => {
    const dishButton = event.target.closest(".week-dish-button");
    if (!dishButton) {
      return;
    }
    openDishInCatalog(dishButton.dataset.dish, dishButton.dataset.date, "today", dishButton.dataset.dishIndex);
  });

  catalogSearchInput.addEventListener("input", () => {
    if (!state.replacementTarget) {
      state.selectedDish = "";
    }
    state.catalogFeedback = "";
    renderCatalog();
  });

  catalogList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest(".delete-dish-button");
    if (deleteButton) {
      removeCatalogDish(deleteButton.dataset.dish);
      return;
    }

    const dishButton = event.target.closest(".catalog-dish");
    if (dishButton) {
      replaceTargetDish(dishButton.dataset.dish);
    }
  });

  catalogEditButton.addEventListener("click", () => {
    state.catalogEditing = !state.catalogEditing;
    state.replacementTarget = null;
    state.catalogFeedback = "";
    state.selectedDish = "";
    renderCatalog();
  });

  addDishButton.addEventListener("click", addCustomDishFromInput);

  customDishInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCustomDishFromInput();
    }
  });

  recordList.addEventListener("change", (event) => {
    const row = event.target.closest(".record-item");
    if (!row) {
      return;
    }

    if (event.target.classList.contains("record-note")) {
      updateRecordField(row.dataset.date, "note", event.target.value);
    }
  });

  recordList.addEventListener("click", (event) => {
    const dishButton = event.target.closest(".record-dish-button");
    if (!dishButton) {
      return;
    }
    openDishInCatalog(dishButton.dataset.dish, dishButton.dataset.date, "records", dishButton.dataset.dishIndex);
  });

  showSelectedDate(state.selectedDate);
  renderYearCalendar();
  renderCatalog();
  renderRecords();
})();
