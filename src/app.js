(function () {
  const {
    buildShareText,
    formatDate,
    getPlanForDate,
    getReassignedPlan,
    getWeekPlans,
  } = window.FoodCore;
  const MENU_PLAN = window.MENU_PLAN;

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

  ruleButton.addEventListener("click", () => {
    if (typeof ruleDialog.showModal === "function") {
      ruleDialog.showModal();
    }
  });

  showSelectedDate(state.selectedDate);
})();
