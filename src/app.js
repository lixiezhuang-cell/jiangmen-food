(function () {
  const {
    addCustomDish,
    applyMealRecordsToPlan,
    BANNED_TERMS,
    buildShareText,
    comboToDishes,
    findSameDishFamilies,
    findTenDayDuplicateDishes,
    formatDate,
    getPlanForDate,
    getReassignedPlan,
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
  } = window.FoodCore;
  const MENU_PLAN = window.MENU_PLAN;
  const DISH_POOL = window.DISH_POOL;
  const RECORDS_STORAGE_KEY = "jiangmen-food-records";
  const CATALOG_STORAGE_KEY = "jiangmen-food-catalog";

  const viewButtons = document.querySelectorAll(".view-tab");
  const viewPanels = document.querySelectorAll("[data-view-panel]");
  const dateLabel = document.querySelector("#dateLabel");
  const styleLabel = document.querySelector("#styleLabel");
  const comboTitle = document.querySelector("#comboTitle");
  const duplicateNote = document.querySelector("#duplicateNote");
  const dishList = document.querySelector("#dishList");
  const weekList = document.querySelector("#weekList");
  const toast = document.querySelector("#toast");
  const datePicker = document.querySelector("#datePicker");
  const copyButton = document.querySelector("#copyButton");
  const shuffleButton = document.querySelector("#shuffleButton");
  const recordButton = document.querySelector("#recordButton");
  const todayButton = document.querySelector("#todayButton");
  const ruleButton = document.querySelector("#ruleButton");
  const ruleDialog = document.querySelector("#ruleDialog");
  const yearDatePicker = document.querySelector("#yearDatePicker");
  const yearSearchInput = document.querySelector("#yearSearchInput");
  const yearSelected = document.querySelector("#yearSelected");
  const yearCalendar = document.querySelector("#yearCalendar");
  const yearCount = document.querySelector("#yearCount");
  const catalogSearchInput = document.querySelector("#catalogSearchInput");
  const customDishInput = document.querySelector("#customDishInput");
  const addDishButton = document.querySelector("#addDishButton");
  const catalogHint = document.querySelector("#catalogHint");
  const catalogList = document.querySelector("#catalogList");
  const catalogCount = document.querySelector("#catalogCount");
  const recordList = document.querySelector("#recordList");
  const recordCount = document.querySelector("#recordCount");

  const catalogState = loadCatalogState();
  const state = {
    activeView: "today",
    selectedDate: formatDate(new Date()),
    reassignOffset: 1,
    currentPlan: null,
    selectedDish: "",
    replacementTarget: null,
    mealRecords: loadMealRecords(),
    customDishes: catalogState.customDishes,
    deletedDishes: catalogState.deletedDishes,
  };

  function getEffectivePlan() {
    return applyMealRecordsToPlan(MENU_PLAN, state.mealRecords);
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
    state.currentPlan = plan;
    dateLabel.textContent = `${plan.date} ${plan.weekday}`;
    styleLabel.textContent = plan.recorded ? `${plan.style} · 已记录` : plan.style;
    comboTitle.textContent = dishesToDisplay(plan.dishes);
    duplicateNote.hidden = repeatedDishes.length === 0;
    duplicateNote.textContent = repeatedDishes.length ? `已重复：${repeatedDishes.join("、")}` : "";
    dishList.replaceChildren(
      ...plan.dishes.map((dish) => {
        const chip = createDishButton(dish, "dish-chip", plan.date);
        chip.classList.toggle("repeated", repeatedDishes.includes(dish));
        return chip;
      }),
    );

    datePicker.value = plan.date;
    renderWeek(plan.date);
    renderYearSelected(plan.date);
  }

  function renderWeek(date) {
    const effectivePlan = getEffectivePlan();
    const duplicateMap = getDuplicateMap(effectivePlan);
    const items = getWeekPlans(date, effectivePlan);
    weekList.replaceChildren(
      ...items.map((item) => {
        const row = document.createElement("article");
        row.className = "week-item";

        const label = document.createElement("div");
        label.className = "week-date";
        label.textContent = `${item.date.slice(5)} ${item.weekday}`;

        const combo = document.createElement("div");
        combo.className = "week-dishes";
        const repeatedDishes = getDuplicateDishes(item.date, duplicateMap);
        combo.replaceChildren(
          ...item.dishes.map((dish) => {
            const chip = createDishButton(dish, "week-dish-button", item.date);
            chip.classList.toggle("repeated", repeatedDishes.includes(dish));
            return chip;
          }),
        );

        row.append(label, combo);
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

  function loadMealRecords() {
    try {
      const value = window.localStorage.getItem(RECORDS_STORAGE_KEY);
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  }

  function saveMealRecords() {
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(state.mealRecords));
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

  function setView(viewName) {
    state.activeView = viewName;
    if (viewName !== "catalog") {
      state.replacementTarget = null;
    }

    viewButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === viewName);
    });
    viewPanels.forEach((panel) => {
      const isActive = panel.dataset.viewPanel === viewName;
      panel.classList.toggle("active", isActive);
      panel.hidden = !isActive;
    });

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

  function openDishInCatalog(dish, date = state.selectedDate, sourceView = state.activeView) {
    state.selectedDish = dish;
    state.replacementTarget = {
      date,
      dish,
      plan: getReplacementSourcePlan(date, sourceView),
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
      ...plan.dishes.map((dish) => {
        const chip = createDishButton(dish, "selected-dish-button", plan.date);
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
      ...item.dishes.map((dish) => {
        const chip = createDishButton(dish, "year-dish-button", item.date);
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
    if (state.replacementTarget) {
      catalogHint.hidden = false;
      catalogHint.textContent = `正在替换：${state.replacementTarget.dish}。点一个菜名即可更新。`;
    } else {
      catalogHint.hidden = true;
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

        const chip = createTextElement("button", "catalog-dish", dish);
        chip.type = "button";
        chip.dataset.dish = dish;
        chip.classList.toggle("selected", isSelectedDish(dish, state.selectedDish));

        const deleteButton = createTextElement("button", "delete-dish-button", "×");
        deleteButton.type = "button";
        deleteButton.dataset.dish = dish;
        deleteButton.setAttribute("aria-label", `删除 ${dish}`);

        item.append(chip, deleteButton);
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

  function createDishButton(dish, className, date) {
    const button = document.createElement("button");
    button.className = `dish-button ${className}`;
    button.type = "button";
    button.dataset.dish = dish;
    if (date) {
      button.dataset.date = date;
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
    state.mealRecords = upsertMealRecord(state.mealRecords, state.currentPlan);
    saveMealRecords();
    refreshFromRecords();
    showToast("已记录");
  }

  function renderRecords() {
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
          ...comboToDishes(record.combo).map((dish) => createDishButton(dish, "record-dish-button", record.date)),
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
    const replaced = replaceDishInPlanItem(plan, target.dish, newDish);
    if (replaced === plan) {
      showToast("没有找到要替换的菜");
      return;
    }
    const sameFamilies = findSameDishFamilies(replaced.dishes);
    if (sameFamilies.length) {
      showToast(`同类了：${sameFamilies[0].dishes.join("、")}`);
      return;
    }

    state.mealRecords = upsertMealRecord(state.mealRecords, replaced);
    state.selectedDate = replaced.date;
    state.selectedDish = newDish;
    const returnView = target.sourceView === "catalog" ? "today" : target.sourceView;
    state.replacementTarget = null;
    saveMealRecords();
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
    }
    saveCatalogState();
    renderCatalog();
    showToast("已删除");
  }

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  copyButton.addEventListener("click", copyCurrentPlan);

  recordButton.addEventListener("click", recordCurrentPlan);

  dishList.addEventListener("click", (event) => {
    const button = event.target.closest(".dish-chip");
    if (!button) {
      return;
    }
    openDishInCatalog(button.dataset.dish, button.dataset.date, "today");
  });

  shuffleButton.addEventListener("click", () => {
    const plan = getReassignedPlan(state.selectedDate, getEffectivePlan(), state.reassignOffset);
    state.reassignOffset += 1;
    render(plan);
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
      openDishInCatalog(dishButton.dataset.dish, row.dataset.date, "year");
    }
  });

  yearSelected.addEventListener("click", (event) => {
    const dishButton = event.target.closest(".selected-dish-button");
    if (dishButton) {
      openDishInCatalog(dishButton.dataset.dish, dishButton.dataset.date, "year");
    }
  });

  weekList.addEventListener("click", (event) => {
    const dishButton = event.target.closest(".week-dish-button");
    if (!dishButton) {
      return;
    }
    showSelectedDate(dishButton.dataset.date);
    openDishInCatalog(dishButton.dataset.dish, dishButton.dataset.date, "today");
  });

  catalogSearchInput.addEventListener("input", () => {
    if (!state.replacementTarget) {
      state.selectedDish = "";
    }
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
    openDishInCatalog(dishButton.dataset.dish, dishButton.dataset.date, "records");
  });

  ruleButton.addEventListener("click", () => {
    if (typeof ruleDialog.showModal === "function") {
      ruleDialog.showModal();
    }
  });

  showSelectedDate(state.selectedDate);
  renderYearCalendar();
  renderCatalog();
  renderRecords();
})();
