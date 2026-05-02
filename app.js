window.addEventListener("DOMContentLoaded", () => {

/* ===========================
   MODELS
   =========================== */

class Category {
  constructor(name, budget) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.budget = budget ?? null;
    this.spent = 0;
  }
}

class Expense {
  constructor(amount, categoryId) {
    this.amount = amount;
    this.categoryId = categoryId;
  }
}

/* ===========================
   MAIN APP
   =========================== */

class BudgetApp {
  constructor() {
    this.data = {};
    this.currentMonth = this.getCurrentMonth();

    this.load();
    this.initMonths();
    this.loadMonth();
    this.bindEvents();
    this.recalculateCategorySpending();
    this.render();
  }

  save() {
    localStorage.setItem("budgetData", JSON.stringify(this.data));
  }

  load() {
    const saved = localStorage.getItem("budgetData");
    if (saved) this.data = JSON.parse(saved);
  }

  getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  getMonthBefore(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 2);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  initMonths() {
    const selector = document.getElementById("monthSelector");
    selector.innerHTML = "";

    const months = [];

    for (let i = 12; i > 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }

    months.push(this.currentMonth);

    for (let i = 1; i <= 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }

    months.forEach(m => {
      const option = document.createElement("option");
      option.value = m;
      option.textContent = m;
      selector.appendChild(option);
    });

    selector.value = this.currentMonth;

    selector.addEventListener("change", () => {
      const newMonth = selector.value;
      const prev = this.getMonthBefore(newMonth);

      this.currentMonth = newMonth;
      this.loadMonth();
      this.applyRollover(prev, newMonth);

      this.recalculateCategorySpending();
      this.render();
      this.save();
    });
  }

  loadMonth() {
    if (!this.data[this.currentMonth]) {
      this.data[this.currentMonth] = {
        income: [],
        savings: [],
        categories: [],
        expenses: [],
        includeCarryover: true,
        rolloverAmount: 0
      };
    } else {
      const m = this.data[this.currentMonth];
      if (m.includeCarryover === undefined) m.includeCarryover = true;
      if (m.rolloverAmount === undefined) m.rolloverAmount = 0;
    }
  }

  get monthData() {
    return this.data[this.currentMonth];
  }

  bindEvents() {
    document.getElementById("addIncomeBtn").addEventListener("click", () => this.addIncome());
    document.getElementById("addSavingsBtn").addEventListener("click", () => this.addSavings());
    document.getElementById("addCategoryBtn").addEventListener("click", () => this.addCategory());
    document.getElementById("addExpenseBtn").addEventListener("click", () => this.addExpense());

    document.getElementById("toggleCarryover").addEventListener("change", (e) => {
      this.monthData.includeCarryover = e.target.checked;
      this.updateCarryoverIncome();
      this.render();
      this.save();
    });
  }

  /* ===========================
     ROLLOVER
     =========================== */

  applyRollover(prevMonth, newMonth) {
    const prev = this.data[prevMonth];
    const next = this.data[newMonth];

    if (!prev || !next) return;

    const totalIncome = prev.income.reduce((s, i) => s + i.amount, 0);
    const totalSavings = prev.savings.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = prev.expenses.reduce((s, e) => s + e.amount, 0);

    const carryover = totalIncome - (totalExpenses + totalSavings);

    next.rolloverAmount = carryover;

    this.updateCarryoverIncome();
  }

  updateCarryoverIncome() {
    const data = this.monthData;

    data.income = data.income.filter(i => !i.locked);

    if (data.includeCarryover && data.rolloverAmount !== 0) {
      data.income.push({
        id: "ROLLOVER-" + this.currentMonth,
        name: "Rollover",
        amount: data.rolloverAmount,
        locked: true
      });
    }
  }

  /* ===========================
     CATEGORY SPENDING
     =========================== */

  recalculateCategorySpending() {
    const data = this.monthData;

    data.categories.forEach(cat => cat.spent = 0);

    data.expenses.forEach(exp => {
      const cat = data.categories.find(c => c.id === exp.categoryId);
      if (cat) cat.spent += exp.amount;
    });
  }

  /* ===========================
     INCOME
     =========================== */

  addIncome() {
    const name = document.getElementById("incomeName").value.trim();
    const amount = Number(document.getElementById("incomeAmount").value);

    if (!name || amount === 0) return;

    this.monthData.income.push({
      id: crypto.randomUUID(),
      name,
      amount
    });

    document.getElementById("incomeName").value = "";
    document.getElementById("incomeAmount").value = "";

    this.render();
    this.save();
  }

  deleteIncome(id) {
    const entry = this.monthData.income.find(i => i.id === id);

    if (entry?.locked) {
      alert("Rollover income cannot be deleted. Toggle it off instead.");
      return;
    }

    this.monthData.income = this.monthData.income.filter(i => i.id !== id);
    this.render();
    this.save();
  }

  getTotalIncome() {
    return this.monthData.income.reduce((sum, i) => sum + i.amount, 0);
  }

  /* ===========================
     SAVINGS
     =========================== */

  addSavings() {
    const name = document.getElementById("savingsName").value.trim();
    const amount = Number(document.getElementById("savingsAmount").value);

    if (!name || amount <= 0) return;

    this.monthData.savings.push({
      id: crypto.randomUUID(),
      name,
      amount
    });

    document.getElementById("savingsName").value = "";
    document.getElementById("savingsAmount").value = "";

    this.render();
    this.save();
  }

  deleteSavings(id) {
    this.monthData.savings = this.monthData.savings.filter(s => s.id !== id);
    this.render();
    this.save();
  }

  getTotalSavings() {
    return this.monthData.savings.reduce((sum, s) => sum + s.amount, 0);
  }

  /* ===========================
     CATEGORIES
     =========================== */

  addCategory() {
    const name = document.getElementById("catName").value.trim();
    const budgetInput = document.getElementById("catBudget").value;
    const budget = budgetInput === "" ? null : Number(budgetInput);

    if (!name) return;

    this.monthData.categories.push(new Category(name, budget));

    document.getElementById("catName").value = "";
    document.getElementById("catBudget").value = "";

    this.render();
    this.save();
  }

  editCategory(cat) {
    const newName = prompt("Edit category name:", cat.name);
    const newBudgetInput = prompt("Edit category budget (leave blank for none):", cat.budget ?? "");

    if (newName) cat.name = newName;

    if (newBudgetInput === "") {
      cat.budget = null;
    } else if (!isNaN(Number(newBudgetInput))) {
      cat.budget = Number(newBudgetInput);
    }

    this.render();
    this.save();
  }

  deleteCategory(id) {
    this.monthData.categories = this.monthData.categories.filter(c => c.id !== id);
    this.monthData.expenses = this.monthData.expenses.filter(e => e.categoryId !== id);
    this.render();
    this.save();
  }

  /* ===========================
     EXPENSES
     =========================== */

  addExpense() {
    const amount = Number(document.getElementById("expAmount").value);
    const categoryId = document.getElementById("expCategory").value;

    if (amount <= 0) return;

    const cat = this.monthData.categories.find(c => c.id === categoryId);
    if (cat) {
      cat.spent += amount;
      this.monthData.expenses.push(new Expense(amount, categoryId));
    }

    document.getElementById("expAmount").value = "";

    this.render();
    this.save();
  }

  getTotalExpenses() {
    return this.monthData.expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  editExpense(index) {
    const exp = this.monthData.expenses[index];
    if (!exp) return;

    const newAmount = prompt("Edit expense amount:", exp.amount);
    if (newAmount === null) return;

    const amountNum = Number(newAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const cat = this.monthData.categories.find(c => c.id === exp.categoryId);
    if (cat) {
      cat.spent -= exp.amount;
      cat.spent += amountNum;
    }

    exp.amount = amountNum;

    this.render();
    this.save();
  }

  deleteExpense(index) {
    const exp = this.monthData.expenses[index];
    if (!exp) return;

    const cat = this.monthData.categories.find(c => c.id === exp.categoryId);
    if (cat) {
      cat.spent -= exp.amount;
    }

    this.monthData.expenses.splice(index, 1);

    this.render();
    this.save();
  }

  /* ===========================
     RENDER UI
     =========================== */

  render() {
    const data = this.monthData;

    /* CARRYOVER CARD */
    const carryoverCard = document.getElementById("carryoverCard");
    const carryoverAmount = document.getElementById("carryoverAmount");
    const toggleCarryover = document.getElementById("toggleCarryover");

    if (data.rolloverAmount !== 0) {
      carryoverCard.style.display = "block";
      carryoverAmount.textContent = data.rolloverAmount;
      carryoverAmount.style.color = data.rolloverAmount < 0 ? "red" : "#0a84ff";
      toggleCarryover.checked = data.includeCarryover;
    } else {
      carryoverCard.style.display = "none";
    }

    /* INCOME */
    const incomeList = document.getElementById("incomeList");
    incomeList.innerHTML = "";
    data.income.forEach(entry => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <strong>${entry.name}</strong><br>
        Amount: ${entry.amount}
        ${entry.locked ? "" : `<div class="delete-btn">Delete</div>`}
      `;
      if (!entry.locked) {
        li.querySelector(".delete-btn").addEventListener("click", () => this.deleteIncome(entry.id));
      }
      incomeList.appendChild(li);
    });
    document.getElementById("incomeDisplay").textContent = this.getTotalIncome();

    /* SAVINGS */
    const savingsList = document.getElementById("savingsList");
    savingsList.innerHTML = "";
    data.savings.forEach(entry => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <strong>${entry.name}</strong><br>
        Amount: ${entry.amount}
        <div class="delete-btn">Delete</div>
      `;
      li.querySelector(".delete-btn").addEventListener("click", () => this.deleteSavings(entry.id));
      savingsList.appendChild(li);
    });
    document.getElementById("savingsDisplay").textContent = this.getTotalSavings();

    /* CATEGORIES */
    const list = document.getElementById("categoryList");
    list.innerHTML = "";
    data.categories.forEach(cat => {
      const remaining = cat.budget !== null ? cat.budget - cat.spent : null;

      const li = document.createElement("li");
      li.className = "item";

      li.innerHTML = `
        <strong>${cat.name}</strong><br>
        ${cat.budget !== null ? `Budget: ${cat.budget}` : `No budget set`}
        | Spent: ${cat.spent}
        ${remaining !== null ? `| Remaining: <span style="color:${remaining < 0 ? 'red' : 'green'}">${remaining}</span>` : ""}
        <br>
        <div class="edit-btn">Edit</div>
        <div class="delete-btn">Delete</div>

        <h4 style="margin-top:12px;">Expenses:</h4>
        <ul id="cat-exp-${cat.id}"></ul>
      `;

      li.querySelector(".edit-btn").addEventListener("click", () => this.editCategory(cat));
      li.querySelector(".delete-btn").addEventListener("click", () => this.deleteCategory(cat.id));

      list.appendChild(li);

      /* RENDER EXPENSES INSIDE CATEGORY */
      const expUl = document.getElementById(`cat-exp-${cat.id}`);
      data.expenses
        .filter(e => e.categoryId === cat.id)
        .forEach((exp, index) => {
          const expLi = document.createElement("li");
          expLi.className = "item";
          expLi.style.borderLeft = "4px solid #ff9f0a";

          expLi.innerHTML = `
            Amount: ${exp.amount}
            <div class="edit-btn">Edit</div>
            <div class="delete-btn">Delete</div>
          `;

          expLi.querySelector(".edit-btn").addEventListener("click", () => this.editExpense(index));
          expLi.querySelector(".delete-btn").addEventListener("click", () => this.deleteExpense(index));

          expUl.appendChild(expLi);
        });
    });

    /* EXPENSE CATEGORY DROPDOWN */
    const dropdown = document.getElementById("expCategory");
    dropdown.innerHTML = "";
    data.categories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.name;
      dropdown.appendChild(option);
    });

    /* SUMMARY */
    document.getElementById("totalExpenses").textContent = this.getTotalExpenses();
    document.getElementById("availableAfterSavings").textContent =
      this.getTotalIncome() - this.getTotalSavings();
    document.getElementById("carryover").textContent =
      this.getTotalIncome() - (this.getTotalExpenses() + this.getTotalSavings());
  }
}

new BudgetApp();

});
