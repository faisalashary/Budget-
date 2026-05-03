class Category {
  constructor(name, budget) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.budget = budget ?? null;
    this.spent = 0;
  }
}

class Expense {
  constructor(amount, categoryId, detail) {
    this.amount = amount;
    this.categoryId = categoryId;
    this.detail = detail || "";
    this.date = new Date().toISOString().split("T")[0];
  }
}

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

  save() { localStorage.setItem("budgetData", JSON.stringify(this.data)); }
  load() { const s = localStorage.getItem("budgetData"); if (s) this.data = JSON.parse(s); }

  getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }

  getMonthBefore(m) {
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(y, mo - 2);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }

  initMonths() {
    const sel = document.getElementById("monthSelector");
    sel.innerHTML = "";
    const months = [];

    for (let i = 12; i > 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    months.push(this.currentMonth);

    for (let i = 1; i <= 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    months.forEach(m => {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      sel.appendChild(o);
    });

    sel.value = this.currentMonth;

    sel.addEventListener("change", () => {
      const newM = sel.value;
      const prev = this.getMonthBefore(newM);
      this.currentMonth = newM;
      this.loadMonth();
      this.applyRollover(prev, newM);
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
    }
  }

  get monthData() { return this.data[this.currentMonth]; }

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

  applyRollover(prev, newM) {
    const p = this.data[prev], n = this.data[newM];
    if (!p || !n) return;

    const inc = p.income.reduce((s, i) => s + i.amount, 0);
    const sav = p.savings.reduce((s, i) => s + i.amount, 0);
    const exp = p.expenses.reduce((s, e) => s + e.amount, 0);

    n.rolloverAmount = inc - (exp + sav);
    this.updateCarryoverIncome();
  }

  updateCarryoverIncome() {
    const d = this.monthData;
    d.income = d.income.filter(i => !i.locked);

    if (d.includeCarryover && d.rolloverAmount !== 0) {
      d.income.push({
        id: "ROLLOVER-" + this.currentMonth,
        name: "Rollover",
        amount: d.rolloverAmount,
        locked: true
      });
    }
  }

  recalculateCategorySpending() {
    const d = this.monthData;
    d.categories.forEach(c => c.spent = 0);
    d.expenses.forEach(e => {
      const c = d.categories.find(x => x.id === e.categoryId);
      if (c) c.spent += e.amount;
    });
  }

  addIncome() {
    const name = document.getElementById("incomeName").value.trim();
    const amt = Number(document.getElementById("incomeAmount").value);
    if (!name || amt === 0) return;

    this.monthData.income.push({ id: crypto.randomUUID(), name, amount: amt });
    document.getElementById("incomeName").value = "";
    document.getElementById("incomeAmount").value = "";
    this.render(); this.save();
  }

  deleteIncome(id) {
    this.monthData.income = this.monthData.income.filter(i => i.id !== id);
    this.render(); this.save();
  }

  getTotalIncome() {
    return this.monthData.income.reduce((s, i) => s + i.amount, 0);
  }

  addSavings() {
    const name = document.getElementById("savingsName").value.trim();
    const amt = Number(document.getElementById("savingsAmount").value);
    if (!name || amt <= 0) return;

    this.monthData.savings.push({ id: crypto.randomUUID(), name, amount: amt });
    document.getElementById("savingsName").value = "";
    document.getElementById("savingsAmount").value = "";
    this.render(); this.save();
  }

  deleteSavings(id) {
    this.monthData.savings = this.monthData.savings.filter(s => s.id !== id);
    this.render(); this.save();
  }

  getTotalSavings() {
    return this.monthData.savings.reduce((s, i) => s + i.amount, 0);
  }

  addCategory() {
    const name = document.getElementById("catName").value.trim();
    const b = document.getElementById("catBudget").value;
    const budget = b === "" ? null : Number(b);
    if (!name) return;

    this.monthData.categories.push(new Category(name, budget));
    document.getElementById("catName").value = "";
    document.getElementById("catBudget").value = "";
    this.render(); this.save();
  }

  editCategory(cat) {
    const n = prompt("Edit name:", cat.name);
    const b = prompt("Edit budget:", cat.budget ?? "");
    if (n) cat.name = n;
    if (b === "") cat.budget = null;
    else if (!isNaN(Number(b))) cat.budget = Number(b);
    this.render(); this.save();
  }

  deleteCategory(id) {
    this.monthData.categories = this.monthData.categories.filter(c => c.id !== id);
    this.monthData.expenses = this.monthData.expenses.filter(e => e.categoryId !== id);
    this.render(); this.save();
  }

  addExpense() {
    const amt = Number(document.getElementById("expAmount").value);
    const catId = document.getElementById("expCategory").value;
    const detail = document.getElementById("expDetail").value.trim();

    if (amt <= 0) return;

    const cat = this.monthData.categories.find(c => c.id === catId);
    if (cat) {
      cat.spent += amt;
      this.monthData.expenses.push(new Expense(amt, catId, detail));
    }

    document.getElementById("expAmount").value = "";
    document.getElementById("expDetail").value = "";
    this.render(); this.save();
  }

  editExpense(i) {
    const exp = this.monthData.expenses[i];
    if (!exp) return;

    const a = prompt("Edit amount:", exp.amount);
    if (a === null) return;
    const n = Number(a);
    if (isNaN(n) || n <= 0) return;

    const d = prompt("Edit date:", exp.date);
    if (d) exp.date = d;

    const newDetail = prompt("Edit detail:", exp.detail);
    if (newDetail !== null) exp.detail = newDetail;

    const cat = this.monthData.categories.find(c => c.id === exp.categoryId);
    if (cat) { cat.spent -= exp.amount; cat.spent += n; }

    exp.amount = n;
    this.render(); this.save();
  }

  deleteExpense(i) {
    const exp = this.monthData.expenses[i];
    if (!exp) return;

    const cat = this.monthData.categories.find(c => c.id === exp.categoryId);
    if (cat) cat.spent -= exp.amount;

    this.monthData.expenses.splice(i, 1);
    this.render(); this.save();
  }

  render() {
    const d = this.monthData;

    // CARRYOVER
    const c = document.getElementById("carryoverCard");
    const ca = document.getElementById("carryoverAmount");
    const t = document.getElementById("toggleCarryover");

    if (d.rolloverAmount !== 0) {
      c.style.display = "block";
      ca.textContent = d.rolloverAmount;
      t.checked = d.includeCarryover;
    } else c.style.display = "none";

    // INCOME
    const il = document.getElementById("incomeList");
    il.innerHTML = "";
    d.income.forEach(e => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <strong>${e.name}</strong><br>
        Amount: ${e.amount}
        ${e.locked ? "" : `<div class="delete-btn">Delete</div>`}
      `;
      if (!e.locked) li.querySelector(".delete-btn").addEventListener("click", () => this.deleteIncome(e.id));
      il.appendChild(li);
    });
    document.getElementById("incomeDisplay").textContent = this.getTotalIncome();

    // SAVINGS
    const sl = document.getElementById("savingsList");
    sl.innerHTML = "";
    d.savings.forEach(e => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <strong>${e.name}</strong><br>
        Amount: ${e.amount}
        <div class="delete-btn">Delete</div>
      `;
      li.querySelector(".delete-btn").addEventListener("click", () => this.deleteSavings(e.id));
      sl.appendChild(li);
    });
    document.getElementById("savingsDisplay").textContent = this.getTotalSavings();

    // CATEGORIES
    const cl = document.getElementById("categoryList");
    cl.innerHTML = "";

    const renderCategory = (cat) => {
      const rem = cat.budget !== null ? cat.budget - cat.spent : null;

      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <strong>${cat.name}</strong><br>
        ${cat.budget !== null ? `Budget: ${cat.budget}` : `No budget`}
        | Spent: ${cat.spent}
        ${rem !== null ? `| Remaining: <span style="color:${rem < 0 ? "red" : "green"}">${rem}</span>` : ""}
        <br>
        <div class="edit-btn">Edit</div>
        <div class="delete-btn">Delete</div>
        <h4 style="margin-top:12px;">Expenses:</h4>
        <ul id="cat-exp-${cat.id}"></ul>
      `;

      li.querySelector(".edit-btn").addEventListener("click", () => this.editCategory(cat));
      li.querySelector(".delete-btn").addEventListener("click", () => this.deleteCategory(cat.id));

      cl.appendChild(li);

      const expUl = document.getElementById(`cat-exp-${cat.id}`);
      const catExp = d.expenses.filter(e => e.categoryId === cat.id);

      const renderExpense = (exp, idx) => {
        const li = document.createElement("li");
        li.className = "item";
        li.style.borderLeft = "4px solid #ff9f0a";
        li.innerHTML = `
          Amount: ${exp.amount} — <small>${exp.date}</small><br>
          ${exp.detail ? `<em>${exp.detail}</em>` : ""}
          <div class="edit-btn">Edit</div>
          <div class="delete-btn">Delete</div>
        `;
        li.querySelector(".edit-btn").addEventListener("click", () => this.editExpense(idx));
        li.querySelector(".delete-btn").addEventListener("click", () => this.deleteExpense(idx));
        expUl.appendChild(li);
      };

      catExp.slice(0, 3).forEach((exp) => renderExpense(exp, d.expenses.indexOf(exp)));

      if (catExp.length > 3) {
        const btn = document.createElement("button");
        btn.className = "btn show-toggle";
        let open = false;

        const update = () => btn.textContent = open
          ? "Hide extra expenses"
          : `Show ${catExp.length - 3} more`;

        update();

        btn.addEventListener("click", () => {
          open = !open;
          expUl.innerHTML = "";
          const items = open ? catExp : catExp.slice(0, 3);
          items.forEach(exp => renderExpense(exp, d.expenses.indexOf(exp)));
          update();
          expUl.appendChild(btn);
        });

        expUl.appendChild(btn);
      }
    };

    d.categories.slice(0, 5).forEach(cat => renderCategory(cat));

    if (d.categories.length > 5) {
      const btn = document.createElement("button");
      btn.className = "btn show-toggle";
      let open = false;

      const update = () => btn.textContent = open
        ? "Hide extra categories"
        : `Show ${d.categories.length - 5} more categories`;

      update();

      btn.addEventListener("click", () => {
        open = !open;
        cl.innerHTML = "";
        const items = open ? d.categories : d.categories.slice(0, 5);
        items.forEach(cat => renderCategory(cat));
        update();
        cl.appendChild(btn);
      });

      cl.appendChild(btn);
    }

    const dd = document.getElementById("expCategory");
    dd.innerHTML = "";
    d.categories.forEach(cat => {
      const o = document.createElement("option");
      o.value = cat.id;
      o.textContent = cat.name;
      dd.appendChild(o);
    });

    const totalExp = d.expenses.reduce((s, e) => s + e.amount, 0);
    document.getElementById("totalExpenses").textContent = totalExp;
    document.getElementById("availableAfterSavings").textContent =
      this.getTotalIncome() - this.getTotalSavings();
    document.getElementById("carryover").textContent =
      this.getTotalIncome() - (this.getTotalSavings() + totalExp);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new BudgetApp();
});
