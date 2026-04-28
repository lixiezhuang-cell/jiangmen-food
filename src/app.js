(function () {
  const {
    buildShareText,
    formatDate,
    getPlanForDate,
    getReassignedPlan,
    getWeekPlans,
    groupPlansByMonth,
    searchDishPool,
    searchMenuPlan,
  } = window.FoodCore;
  const MENU_PLAN = window.MENU_PLAN;
  const DISH_POOL = window.DISH_POOL;

  const viewButtons = document.querySelectorAll(".view-tab");
  const viewPanels = document.querySelectorAll("[data-view-panel]");
  const dateLabel = document.querySelector("#dateLabel");
  const styleLabel = document.querySelector("#styleLabel");
  const comboTitle = document.querySelector("#comboTitle");
  const dishList = document.querySelector("#dishList");
  const weekList = document.querySelector("#weekList");
  const toast = document.querySelector("#toast");
  const datePicker = document.querySelector("#datePicker");
  const copyButton = document.querySelector("#copyButton");
  const shuffleButton = document.querySelector("#shuffleButton");
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

  const state = {
    selectedDate: formatDate(new Date()),
    reassignOffset: 1,
    currentPlan: null,
  };

  function render(plan) {
    state.currentPlan = plan;
    dateLabel.textContent = `${plan.date} ${plan.weekday}`;
    styleLabel.textContent = plan.style;
    comboTitle.textContent = plan.combo;
    dishList.replaceChildren(
      ...plan.dishes.map((dish) => {
        const chip = document.createElement("span");
        chip.className = "dish-chip";
        chip.textContent = dish;
        return chip;
      }),
    );

    datePicker.value = plan.date;
    renderWeek(plan.date);
    renderYearSelected(plan.date);
  }

  function renderWeek(date) {
    const items = getWeekPlans(date, MENU_PLAN);
    weekList.replaceChildren(
      ...items.map((item) => {
        const row = document.createElement("article");
        row.className = "week-item";

        const label = document.createElement("div");
        label.className = "week-date";
        label.textContent = `${item.date.slice(5)} ${item.weekday}`;

        const combo = document.createElement("div");
        combo.className = "week-combo";
        combo.textContent = item.combo;

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
    render(getPlanForDate(date, MENU_PLAN));
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

  function renderYearSelected(date) {
    if (!yearSelected) {
      return;
    }
    const plan = getPlanForDate(date, MENU_PLAN);
    yearDatePicker.value = plan.date;
    yearSelected.replaceChildren(
      createTextElement("div", "selected-date", `${plan.date} ${plan.weekday}`),
      createTextElement("strong", "selected-combo", plan.combo),
      createTextElement("span", "selected-style", plan.style),
    );
  }

  function renderYearCalendar() {
    const items = searchMenuPlan(MENU_PLAN, yearSearchInput.value);
    const months = groupPlansByMonth(items);
    yearCount.textContent = `${items.length} 天`;
    yearCalendar.replaceChildren(
      ...months.map((month) => {
        const section = document.createElement("section");
        section.className = "month-block";
        section.append(
          createTextElement("h3", "", month.month),
          createMonthDays(month.items),
        );
        return section;
      }),
    );

    if (!items.length) {
      yearCalendar.append(createTextElement("p", "empty-state", "没有匹配菜单"));
    }
  }

  function createMonthDays(items) {
    const list = document.createElement("div");
    list.className = "month-days";
    list.replaceChildren(...items.map(createYearDayButton));
    return list;
  }

  function createYearDayButton(item) {
    const button = document.createElement("button");
    button.className = "year-day";
    button.type = "button";
    button.dataset.date = item.date;
    button.classList.toggle("selected", item.date === state.selectedDate);
    button.append(
      createTextElement("span", "year-day-date", `${item.date.slice(5)} ${item.weekday}`),
      createTextElement("strong", "year-day-combo", item.combo),
      createTextElement("span", "year-day-style", item.style),
    );
    return button;
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
    grid.replaceChildren(...dishes.map((dish) => createTextElement("span", "catalog-dish", dish)));
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

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  copyButton.addEventListener("click", copyCurrentPlan);

  shuffleButton.addEventListener("click", () => {
    const plan = getReassignedPlan(state.selectedDate, MENU_PLAN, state.reassignOffset);
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
    const button = event.target.closest(".year-day");
    if (!button) {
      return;
    }
    showSelectedDate(button.dataset.date);
    renderYearCalendar();
  });

  catalogSearchInput.addEventListener("input", renderCatalog);

  ruleButton.addEventListener("click", () => {
    if (typeof ruleDialog.showModal === "function") {
      ruleDialog.showModal();
    }
  });

  showSelectedDate(state.selectedDate);
  renderYearCalendar();
  renderCatalog();
})();
