(function () {
  const {
    applyMealRecordsToPlan,
    buildShareText,
    comboToDishes,
    findTenDayDuplicateDishes,
    formatDate,
    getPlanForDate,
    getReassignedPlan,
    getWeekPlans,
    groupPlansByMonth,
    isSelectedDish,
    searchDishPool,
    searchMenuPlan,
    updateMealRecord,
    upsertMealRecord,
  } = window.FoodCore;
  const MENU_PLAN = window.MENU_PLAN;
  const DISH_POOL = window.DISH_POOL;
  const RECORDS_STORAGE_KEY = "jiangmen-food-records";

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
  const catalogList = document.querySelector("#catalogList");
  const catalogCount = document.querySelector("#catalogCount");
  const recordList = document.querySelector("#recordList");
  const recordCount = document.querySelector("#recordCount");

  const state = {
    selectedDate: formatDate(new Date()),
    reassignOffset: 1,
    currentPlan: null,
    selectedDish: "",
    mealRecords: loadMealRecords(),
  };

  function getEffectivePlan() {
    return applyMealRecordsToPlan(MENU_PLAN, state.mealRecords);
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

  function dishesToEditorValue(dishes) {
    return dishes.join("\n");
  }

  function editorValueToCombo(value) {
    return comboToDishes(value).join(" + ");
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
  }

  function openDishInCatalog(dish) {
    state.selectedDish = dish;
    catalogSearchInput.value = dish;
    setView("catalog");
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

    const editor = document.createElement("textarea");
    editor.id = "yearSelectedCombo";
    editor.className = "year-combo-editor";
    editor.rows = Math.max(2, plan.dishes.length);
    editor.value = dishesToEditorValue(plan.dishes);
    editor.setAttribute("aria-label", `${plan.date} 菜名`);

    const updateButton = document.createElement("button");
    updateButton.className = "secondary-button year-update-button";
    updateButton.id = "yearUpdateButton";
    updateButton.type = "button";
    updateButton.textContent = "更新";

    const editBox = document.createElement("div");
    editBox.className = "year-edit";
    editBox.append(editor, updateButton);

    const children = [
      createTextElement("div", "selected-date", `${plan.date} ${plan.weekday}`),
      dishButtons,
      createTextElement("span", "selected-style", plan.style),
      editBox,
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
    const categories = searchDishPool(DISH_POOL, catalogSearchInput.value);
    const total = categories.reduce((sum, category) => sum + category.dishes.length, 0);
    catalogCount.textContent = `${total} 道`;
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
        const chip = createTextElement("span", "catalog-dish", dish);
        chip.classList.toggle("selected", isSelectedDish(dish, state.selectedDish));
        return chip;
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

        const combo = document.createElement("textarea");
        combo.className = "record-combo";
        combo.rows = 2;
        combo.value = dishesToEditorValue(comboToDishes(record.combo));
        combo.setAttribute("aria-label", `${record.date} 菜名`);

        const note = document.createElement("textarea");
        note.className = "record-note";
        note.rows = 2;
        note.placeholder = "备注";
        note.value = record.note;
        note.setAttribute("aria-label", `${record.date} 备注`);

        row.append(meta, combo, note);
        return row;
      }),
    );

    if (!state.mealRecords.length) {
      recordList.append(createTextElement("p", "empty-state", "还没有记录"));
    }
  }

  function updateRecordField(date, field, value) {
    const nextValue = field === "combo" ? editorValueToCombo(value) : value;
    state.mealRecords = updateMealRecord(state.mealRecords, date, { [field]: nextValue });
    saveMealRecords();
    refreshFromRecords();
  }

  function updateYearSelectedPlan() {
    const editor = yearSelected.querySelector("#yearSelectedCombo");
    if (!editor) {
      return;
    }
    const combo = editorValueToCombo(editor.value);
    if (!combo) {
      showToast("菜名不能为空");
      return;
    }

    const plan = getPlanForDate(yearDatePicker.value, getEffectivePlan());
    state.mealRecords = upsertMealRecord(state.mealRecords, { ...plan, combo, dishes: comboToDishes(combo) });
    saveMealRecords();
    state.selectedDate = plan.date;
    refreshFromRecords();
    showToast("已更新");
  }

  function focusYearEditor(dish) {
    window.requestAnimationFrame(() => {
      const editor = yearSelected.querySelector("#yearSelectedCombo");
      if (!editor) {
        return;
      }
      editor.focus();
      const start = editor.value.indexOf(dish);
      if (start >= 0) {
        editor.setSelectionRange(start, start + dish.length);
      }
    });
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
    openDishInCatalog(button.dataset.dish);
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
      focusYearEditor(dishButton.dataset.dish);
    }
  });

  yearSelected.addEventListener("click", (event) => {
    const updateButton = event.target.closest("#yearUpdateButton");
    if (updateButton) {
      updateYearSelectedPlan();
      return;
    }

    const dishButton = event.target.closest(".selected-dish-button");
    if (dishButton) {
      focusYearEditor(dishButton.dataset.dish);
    }
  });

  weekList.addEventListener("click", (event) => {
    const dishButton = event.target.closest(".week-dish-button");
    if (!dishButton) {
      return;
    }
    showSelectedDate(dishButton.dataset.date);
    setView("catalog");
    openDishInCatalog(dishButton.dataset.dish);
  });

  catalogSearchInput.addEventListener("input", () => {
    state.selectedDish = "";
    renderCatalog();
  });

  recordList.addEventListener("change", (event) => {
    const row = event.target.closest(".record-item");
    if (!row) {
      return;
    }

    if (event.target.classList.contains("record-combo")) {
      updateRecordField(row.dataset.date, "combo", event.target.value);
    }
    if (event.target.classList.contains("record-note")) {
      updateRecordField(row.dataset.date, "note", event.target.value);
    }
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
