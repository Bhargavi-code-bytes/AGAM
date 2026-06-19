const API = "";
const TOKEN_KEY = "agam-multiuser-token";

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  user: null,
  scopes: [],
  data: {
    students: [],
    patients: [],
    classSchedule: [],
    attendance: [],
    treatmentSchedule: [],
    sessionPlans: [],
    payments: [],
    auditLog: [],
  },
  module: "dashboard",
  search: "",
  paymentTab: "all",
};

const app = document.getElementById("app");
boot();

async function boot() {
  if (!state.token) return renderLogin();
  try {
    const session = await api("/api/session");
    state.user = session.user;
    state.scopes = session.scopes || [];
    const dataResp = await api("/api/data");
    state.data = dataResp.data;
    ensureDataShape();
    renderShell();
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    state.token = "";
    renderLogin();
  }
}

function renderLogin() {
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-hero">
          <h1>AGAM Multi-User</h1>
          <p>Centralized server + shared database for all staff.</p>
          <p class="small">No VS Code needed for users. They only open the URL in browser.</p>
        </div>
        <form class="auth-form" id="login-form">
          <h3>Sign in</h3>
          <input name="username" placeholder="Username" required />
          <input type="password" name="password" placeholder="Password" required />
          <button class="primary" type="submit">Login</button>
          <div class="small">Demo: admin / Admin123!</div>
        </form>
      </div>
    </div>
  `;
  document.getElementById("login-form").addEventListener("submit", onLogin);
}

async function onLogin(e) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const username = String(fd.get("username") || "").trim();
  const password = String(fd.get("password") || "");
  try {
    const resp = await api("/api/login", { method: "POST", body: { username, password }, auth: false });
    state.token = resp.token;
    localStorage.setItem(TOKEN_KEY, state.token);
    state.user = resp.user;
    state.scopes = resp.scopes || [];
    const dataResp = await api("/api/data");
    state.data = dataResp.data;
    ensureDataShape();
    state.module = "dashboard";
    renderShell();
    toast("Logged in.");
  } catch (err) {
    toast(err.message || "Login failed");
  }
}

function renderShell() {
  const modules = visibleModules();
  const title = moduleTitle(state.module);
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <h2 style="margin:0;">AGAM</h2>
        <div class="small">${escapeHtml(state.user.name)}<br/>${escapeHtml(labelRole(state.user.role))}</div>
        ${modules.map(m => `<button class="nav-btn ${state.module === m.id ? "active" : ""}" data-module="${m.id}">${m.icon} ${m.title}${m.count !== undefined ? ` (${m.count})` : ""}</button>`).join("")}
        <button class="ghost" data-action="logout" style="margin-top:8px;">Logout</button>
      </aside>
      <main class="main">
        <div class="top">
          <div>
            <h2 style="margin:0;">${title}</h2>
            <div class="small">Central shared data for all users</div>
          </div>
          <div class="actions">
            <button class="ghost" data-action="reload">Reload</button>
            <button class="primary" data-action="save">Save</button>
          </div>
        </div>
        ${renderModule()}
      </main>
    </div>
  `;

  document.querySelectorAll("[data-module]").forEach(btn => btn.addEventListener("click", () => {
    state.module = btn.dataset.module;
    state.search = "";
    renderShell();
  }));
  document.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", onAction));
  document.getElementById("search-box")?.addEventListener("input", e => {
    state.search = e.target.value;
    renderShell();
  });
  const plannerType = document.getElementById("planner-type");
  if (plannerType) {
    plannerType.addEventListener("change", () => togglePlannerPlace(plannerType.value));
    togglePlannerPlace(plannerType.value);
  }
  document.getElementById("planner-form")?.addEventListener("submit", onPlannerSubmit);
  document.getElementById("payment-form")?.addEventListener("submit", onPaymentSubmit);
}

function renderModule() {
  switch (state.module) {
    case "students": return renderStudents();
    case "patients": return renderPatients();
    case "planner": return renderPlanner();
    case "therapeutic": return renderTherapeutic();
    case "classSchedule": return renderClassSchedule();
    case "attendance": return renderAttendance();
    case "treatmentSchedule": return renderTreatmentSchedule();
    case "payments": return renderPayments();
    case "records": return renderRecords();
    default: return renderDashboard();
  }
}

function renderDashboard() {
  const therapeuticStudents = state.data.students.filter(s => s.takingTreatment).length;
  const monthlyClassFees = state.data.students.reduce((sum, s) => sum + Number(s.monthlyClassFee || 0), 0);
  const treatmentFeesDue = state.data.treatmentSchedule.reduce((sum, t) => sum + treatmentFeeIfTaken(t), 0);
  const monthlyCollected = (state.data.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return `
    <section class="cards">
      <article class="card"><h4>Students</h4><div class="v">${state.data.students.length}</div></article>
      <article class="card"><h4>Patients</h4><div class="v">${state.data.patients.length}</div></article>
      <article class="card"><h4>Therapeutic</h4><div class="v">${therapeuticStudents + state.data.patients.length}</div></article>
      <article class="card"><h4>Class Schedule</h4><div class="v">${state.data.classSchedule.length}</div></article>
      <article class="card"><h4>Planner</h4><div class="v">${state.data.sessionPlans.length}</div></article>
      <article class="card"><h4>Attendance</h4><div class="v">${state.data.attendance.length}</div></article>
      <article class="card"><h4>Treatment Schedule</h4><div class="v">${state.data.treatmentSchedule.length}</div></article>
      <article class="card"><h4>Monthly Class Fee</h4><div class="v" style="font-size:1rem;">${formatCurrency(monthlyClassFees)}</div></article>
      <article class="card"><h4>Treatment Fee Due</h4><div class="v" style="font-size:1rem;">${formatCurrency(treatmentFeesDue)}</div></article>
      <article class="card"><h4>Payments Collected</h4><div class="v" style="font-size:1rem;">${formatCurrency(monthlyCollected)}</div></article>
      <article class="card"><h4>Records</h4><div class="v">${state.data.auditLog.length}</div></article>
      <article class="card"><h4>Last update</h4><div class="v" style="font-size:1rem;">${escapeHtml((state.data.updatedAt || "").slice(0, 19).replace("T", " ")) || "-"}</div></article>
    </section>
    <section class="panel">
      <h3 style="margin:0 0 10px;">Quick actions</h3>
      <div class="actions">
        <button class="primary" data-action="add-student">+ Add Student</button>
        <button class="ghost" data-action="add-patient">+ Add Patient</button>
        <button class="ghost" data-action="add-class-schedule">+ Add Class</button>
        <button class="ghost" data-action="open-planner">+ Plan Session</button>
        <button class="ghost" data-action="add-attendance">+ Add Attendance</button>
      </div>
    </section>
  `;
}

function renderPlanner() {
  const members = [
    ...state.data.students.map(s => ({
      key: `student:${s.id}`,
      id: s.studentId || "",
      name: s.fullName || "",
      kind: "Student",
      batch: s.assignedClass || "",
    })),
    ...state.data.patients.map(p => ({
      key: `patient:${p.id}`,
      id: p.patientId || "",
      name: p.fullName || "",
      kind: "Patient",
      batch: "Therapy",
    })),
  ].filter(m => m.name);

  const rows = filterRows(state.data.sessionPlans || []);

  return `
    <section class="panel">
      <h3 style="margin:0 0 10px;">Schedule Session</h3>
      <form id="planner-form" class="toolbar" style="align-items:end;">
        <div style="min-width:220px; flex:1;">
          <div class="small" style="margin-bottom:4px;">Member</div>
          <select name="memberKey" required>
            <option value="">- Select Member -</option>
            ${members.map(m => `<option value="${escapeHtml(m.key)}">${escapeHtml(`${m.name} (${m.id || m.kind})`)}</option>`).join("")}
          </select>
        </div>
        <div style="min-width:170px;">
          <div class="small" style="margin-bottom:4px;">Batch</div>
          <select name="batch" required>
            <option value="">- Select Batch -</option>
            <option>Batch 1</option>
            <option>Batch 2</option>
            <option>Batch 3</option>
            <option>Batch 4</option>
            <option>Batch 5</option>
          </select>
        </div>
        <div style="min-width:150px;">
          <div class="small" style="margin-bottom:4px;">Date</div>
          <input type="date" name="date" value="${escapeHtml(todayYmd())}" required />
        </div>
        <div style="min-width:130px;">
          <div class="small" style="margin-bottom:4px;">Time</div>
          <input type="time" name="time" required />
        </div>
        <div style="min-width:150px;">
          <div class="small" style="margin-bottom:4px;">Type</div>
          <select id="planner-type" name="type">
            <option>Online</option>
            <option>Offline</option>
          </select>
        </div>
        <div id="planner-place-wrap" style="min-width:180px; display:none;">
          <div class="small" style="margin-bottom:4px;">Place</div>
          <select id="planner-place" name="place">
            <option>Ground</option>
            <option>AGAM yoga center</option>
          </select>
        </div>
        <button class="primary" type="submit">Plan Session</button>
      </form>
    </section>

    <section class="panel">
      <div class="toolbar" style="margin-bottom:8px;">
        <input id="search-box" placeholder="Search by date, member, batch, status..." value="${escapeHtml(state.search)}" />
        <button class="ghost" data-action="download-planner-csv">Download Planner CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Sl. No.</th><th>Date</th><th>Member</th><th>Batch</th><th>Time</th><th>Type & Place</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${rows.map((r, ix) => `
              <tr>
                <td>${ix + 1}</td>
                <td>${escapeHtml(r.date || "")}</td>
                <td>${escapeHtml(r.memberName || "")}</td>
                <td>${escapeHtml(r.batch || "")}</td>
                <td>${escapeHtml(r.time || "")}</td>
                <td>${escapeHtml(formatPlanTypePlace(r))}</td>
                <td>${escapeHtml(r.status || "Pending")}</td>
                <td class="actions">
                  <button class="ghost" data-action="edit-plan" data-id="${r.id}">Edit</button>
                  <button class="ghost" data-action="toggle-plan-status" data-id="${r.id}">${r.status === "Done" ? "Mark Pending" : "Mark Done"}</button>
                  <button class="danger" data-action="delete-plan" data-id="${r.id}">Delete</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="8" class="small">No planned sessions yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPayments() {
  const students = state.data.students || [];
  const rows = filterPaymentRows(state.data.payments || []);
  return `
    <section class="panel">
      <h3 style="margin:0 0 10px;">Log Monthly Fee</h3>
      <form id="payment-form" class="toolbar" style="align-items:end;">
        <div style="min-width:180px; flex:1;">
          <div class="small" style="margin-bottom:4px;">Student</div>
          <select name="studentId" required>
            <option value="">- Select Student -</option>
            ${students.map(s => `<option value="${escapeHtml(s.studentId || "")}">${escapeHtml(`${s.fullName || ""} (${s.studentId || ""})`)}</option>`).join("")}
          </select>
        </div>
        <div style="min-width:150px;">
          <div class="small" style="margin-bottom:4px;">Month</div>
          <input type="month" name="month" value="${escapeHtml(currentMonth())}" required />
        </div>
        <div style="min-width:130px;">
          <div class="small" style="margin-bottom:4px;">Amount</div>
          <input type="number" min="0" step="0.01" name="amount" placeholder="Amount" required />
        </div>
        <div style="min-width:130px;">
          <div class="small" style="margin-bottom:4px;">Status</div>
          <select name="status">
            <option>Paid</option>
            <option>Pending</option>
            <option>Partial</option>
          </select>
        </div>
        <div style="min-width:130px;">
          <div class="small" style="margin-bottom:4px;">Mode</div>
          <select name="mode">
            <option>Cash</option>
            <option>GPay</option>
            <option>UPI</option>
            <option>Card</option>
            <option>Bank</option>
          </select>
        </div>
        <div style="min-width:160px; flex:1;">
          <div class="small" style="margin-bottom:4px;">Diet/Notes</div>
          <input name="notes" placeholder="Notes" />
        </div>
        <button class="primary" type="submit">Log Monthly Payment</button>
      </form>
    </section>

    <section class="panel">
      <div class="toolbar" style="margin-bottom:8px;">
        <input id="search-box" placeholder="Search records by student, month, status..." value="${escapeHtml(state.search)}" />
      </div>
      <div class="actions" style="margin-bottom:10px;">
        <button class="${state.paymentTab === "all" ? "primary" : "ghost"}" data-action="filter-payments" data-tab="all">All</button>
        <button class="${state.paymentTab === "daily" ? "primary" : "ghost"}" data-action="filter-payments" data-tab="daily">Daily Logs & Fees</button>
        <button class="${state.paymentTab === "monthly" ? "primary" : "ghost"}" data-action="filter-payments" data-tab="monthly">Monthly Fees</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Sl. No.</th><th>Date</th><th>Student</th><th>Month</th><th>Status</th><th>Amount</th><th>Mode</th><th>Diet/Notes</th><th>Action</th></tr></thead>
          <tbody>
            ${rows.map((p, ix) => `
              <tr>
                <td>${ix + 1}</td>
                <td>${escapeHtml((p.date || "").slice(0, 10))}</td>
                <td>${escapeHtml(p.studentName || "")}</td>
                <td>${escapeHtml(p.month || "")}</td>
                <td>${escapeHtml(p.status || "")}</td>
                <td>${formatCurrency(p.amount)}</td>
                <td>${escapeHtml(p.mode || "")}</td>
                <td>${escapeHtml(p.notes || "-")}</td>
                <td class="actions"><button class="danger" data-action="delete-payment" data-id="${p.id}">Delete</button></td>
              </tr>
            `).join("") || `<tr><td colspan="9" class="small">No payment records yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderClassSchedule() {
  const rows = filterRows(state.data.classSchedule);
  return `
    <section class="panel">
      <div class="toolbar">
        <input id="search-box" placeholder="Search class schedule..." value="${escapeHtml(state.search)}" />
        <button class="primary" data-action="add-class-schedule">+ Add Class</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Class</th><th>Style</th><th>Coach</th><th>Day</th><th>Time</th><th>Level</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.className || "")}</td>
                <td>${escapeHtml(r.style || "")}</td>
                <td>${escapeHtml(r.coach || "")}</td>
                <td>${escapeHtml(r.day || "")}</td>
                <td>${escapeHtml(r.time || "")}</td>
                <td>${escapeHtml(r.level || "")}</td>
                <td class="actions">
                  <button class="ghost" data-action="edit-class-schedule" data-id="${r.id}">Edit</button>
                  <button class="danger" data-action="delete-class-schedule" data-id="${r.id}">Delete</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="7" class="small">No class schedule entries yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAttendance() {
  const rows = filterRows(state.data.attendance);
  return `
    <section class="panel">
      <div class="toolbar">
        <input id="search-box" placeholder="Search attendance..." value="${escapeHtml(state.search)}" />
        <button class="primary" data-action="add-attendance">+ Add Attendance</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Class</th><th>Student</th><th>Status</th><th>Present</th><th>Total</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.date || "")}</td>
                <td>${escapeHtml(r.className || "")}</td>
                <td>${escapeHtml(r.studentName || "-")}</td>
                <td>${escapeHtml(r.status || "-")}</td>
                <td>${escapeHtml(String(r.presentCount ?? ""))}</td>
                <td>${escapeHtml(String(r.totalCount ?? ""))}</td>
                <td>${escapeHtml(r.notes || "")}</td>
                <td class="actions">
                  <button class="ghost" data-action="edit-attendance" data-id="${r.id}">Edit</button>
                  <button class="danger" data-action="delete-attendance" data-id="${r.id}">Delete</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="8" class="small">No attendance entries yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTreatmentSchedule() {
  const rows = filterRows(state.data.treatmentSchedule);
  return `
    <section class="panel">
      <div class="toolbar">
        <input id="search-box" placeholder="Search treatment schedule..." value="${escapeHtml(state.search)}" />
        <button class="primary" data-action="add-treatment-schedule">+ Add Treatment Slot</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Type</th><th>Name</th><th>ID</th><th>Therapy</th><th>Day</th><th>Time</th><th>Therapist</th><th>Status</th><th>Monthly Fee</th><th>Treatment Fee</th><th>Charged</th><th>Total Due</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.personType || "")}</td>
                <td>${escapeHtml(r.personName || "")}</td>
                <td>${escapeHtml(r.personId || "")}</td>
                <td>${escapeHtml(r.therapyType || "")}</td>
                <td>${escapeHtml(r.day || "")}</td>
                <td>${escapeHtml(r.time || "")}</td>
                <td>${escapeHtml(r.therapist || "")}</td>
                <td>${escapeHtml(r.status || "")}</td>
                <td>${formatCurrency(monthlyFeeForPerson(r))}</td>
                <td>${formatCurrency(Number(r.treatmentFee || 0))}</td>
                <td>${formatCurrency(treatmentFeeIfTaken(r))}</td>
                <td>${formatCurrency(monthlyFeeForPerson(r) + treatmentFeeIfTaken(r))}</td>
                <td class="actions">
                  <button class="ghost" data-action="edit-treatment-schedule" data-id="${r.id}">Edit</button>
                  <button class="danger" data-action="delete-treatment-schedule" data-id="${r.id}">Delete</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="13" class="small">No treatment schedule entries yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRecords() {
  const rows = [...(state.data.auditLog || [])].reverse();
  const filtered = filterRows(rows);
  return `
    <section class="panel">
      <div class="toolbar">
        <input id="search-box" placeholder="Search records..." value="${escapeHtml(state.search)}" />
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Action</th><th>Details</th><th>Actor</th></tr></thead>
          <tbody>
            ${filtered.map(r => `
              <tr>
                <td>${escapeHtml((r.at || "").slice(0, 19).replace("T", " "))}</td>
                <td>${escapeHtml(r.title || "")}</td>
                <td>${escapeHtml(r.detail || "")}</td>
                <td>${escapeHtml(r.actor || "")}</td>
              </tr>
            `).join("") || `<tr><td colspan="4" class="small">No records yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderStudents() {
  const rows = filterRows(state.data.students);
  return `
    <section class="panel">
      <div class="toolbar">
        <input id="search-box" placeholder="Search students..." value="${escapeHtml(state.search)}" />
        <button class="primary" data-action="add-student">+ Add Student</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>ID</th><th>Style</th><th>Assigned Class</th><th>Monthly Class Fee</th><th>Attendance</th><th>Treatment</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(s => `
              <tr>
                <td>${escapeHtml(s.fullName || "")}</td>
                <td>${escapeHtml(s.studentId || "")}</td>
                <td>${escapeHtml(s.martialArtsStyle || "")}</td>
                <td>${escapeHtml(s.assignedClass || "-")}</td>
                <td>${formatCurrency(Number(s.monthlyClassFee || 0))}</td>
                <td>${escapeHtml(formatStudentAttendance(s.lastAttendance))}</td>
                <td>${s.takingTreatment ? "Yes" : "No"}</td>
                <td class="actions">
                  <button class="ghost" data-action="assign-class" data-id="${s.id}">Assign Class</button>
                  <button class="ghost" data-action="mark-student-attendance" data-id="${s.id}">Mark Attendance</button>
                  <button class="ghost" data-action="edit-student" data-id="${s.id}">Edit</button>
                  <button class="danger" data-action="delete-student" data-id="${s.id}">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPatients() {
  const rows = filterRows(state.data.patients);
  return `
    <section class="panel">
      <div class="toolbar">
        <input id="search-box" placeholder="Search patients..." value="${escapeHtml(state.search)}" />
        <button class="primary" data-action="add-patient">+ Add Patient</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>ID</th><th>Treatment Plan</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(p => `
              <tr>
                <td>${escapeHtml(p.fullName || "")}</td>
                <td>${escapeHtml(p.patientId || "")}</td>
                <td>${escapeHtml((p.treatmentPlan || "").slice(0, 70))}</td>
                <td class="actions">
                  <button class="ghost" data-action="edit-patient" data-id="${p.id}">Edit</button>
                  <button class="danger" data-action="delete-patient" data-id="${p.id}">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTherapeutic() {
  const students = filterRows(state.data.students.filter(s => s.takingTreatment));
  const patients = filterRows(state.data.patients);
  return `
    <section class="panel">
      <div class="toolbar">
        <input id="search-box" placeholder="Search therapeutic records..." value="${escapeHtml(state.search)}" />
        <div class="actions">
          <button class="primary" data-action="add-student-special">+ Special Student</button>
          <button class="ghost" data-action="add-patient">+ Patient</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h4>Special Students (${students.length})</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>ID</th><th>Treatment Plan</th><th>Monthly Fee</th><th>Treatment Due</th><th>Total Due</th></tr></thead>
              <tbody>
                ${students.map(s => {
                  const monthly = Number(s.monthlyClassFee || 0);
                  const treatmentDue = treatmentDueForPerson(s.fullName, s.studentId);
                  return `<tr><td>${escapeHtml(s.fullName || "")}</td><td>${escapeHtml(s.studentId || "")}</td><td>${escapeHtml(s.treatmentPlan || "")}</td><td>${formatCurrency(monthly)}</td><td>${formatCurrency(treatmentDue)}</td><td>${formatCurrency(monthly + treatmentDue)}</td></tr>`;
                }).join("") || `<tr><td colspan="6" class="small">No special students yet.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <h4>Therapy Patients (${patients.length})</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>ID</th><th>Progress</th><th>Treatment Due</th></tr></thead>
              <tbody>
                ${patients.map(p => `<tr><td>${escapeHtml(p.fullName || "")}</td><td>${escapeHtml(p.patientId || "")}</td><td>${escapeHtml(p.progressNotes || "")}</td><td>${formatCurrency(treatmentDueForPerson(p.fullName, p.patientId))}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;
}

async function onAction(e) {
  const action = e.currentTarget.dataset.action;
  const id = e.currentTarget.dataset.id;

  if (action === "logout") return doLogout();
  if (action === "reload") return reloadData();
  if (action === "save") return saveData();
  if (action === "open-planner") {
    state.module = "planner";
    return renderShell();
  }

  if (action === "add-student" || action === "add-student-special") return await upsertStudent(null, action === "add-student-special");
  if (action === "edit-student") return await upsertStudent(id, false);
  if (action === "assign-class") return await assignClassToStudent(id);
  if (action === "mark-student-attendance") return await markStudentAttendance(id);
  if (action === "delete-student") return await deleteStudent(id);

  if (action === "add-patient") return await upsertPatient(null);
  if (action === "edit-patient") return await upsertPatient(id);
  if (action === "delete-patient") return await deletePatient(id);

  if (action === "add-class-schedule") return await upsertClassSchedule(null);
  if (action === "edit-class-schedule") return await upsertClassSchedule(id);
  if (action === "delete-class-schedule") return await deleteClassSchedule(id);

  if (action === "add-attendance") return await upsertAttendance(null);
  if (action === "edit-attendance") return await upsertAttendance(id);
  if (action === "delete-attendance") return await deleteAttendance(id);

  if (action === "add-treatment-schedule") return await upsertTreatmentSchedule(null);
  if (action === "edit-treatment-schedule") return await upsertTreatmentSchedule(id);
  if (action === "delete-treatment-schedule") return await deleteTreatmentSchedule(id);

  if (action === "edit-plan") return await editPlan(id);
  if (action === "toggle-plan-status") return await togglePlanStatus(id);
  if (action === "delete-plan") return await deletePlan(id);
  if (action === "download-planner-csv") return downloadPlannerCsv();

  if (action === "filter-payments") {
    state.paymentTab = e.currentTarget.dataset.tab || "all";
    return renderShell();
  }
  if (action === "delete-payment") return await deletePayment(id);
}

async function onPaymentSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const studentId = String(fd.get("studentId") || "").trim();
  const month = String(fd.get("month") || "").trim();
  const amount = Number(fd.get("amount") || 0);
  const status = String(fd.get("status") || "Paid");
  const mode = String(fd.get("mode") || "Cash");
  const notes = String(fd.get("notes") || "");
  if (!studentId || !month || !Number.isFinite(amount)) return;

  const student = (state.data.students || []).find(s => String(s.studentId || "") === studentId);
  const studentName = student?.fullName || studentId;
  const row = {
    id: cryptoId(),
    type: "monthly",
    date: new Date().toISOString(),
    month,
    studentId,
    studentName,
    amount,
    status,
    mode,
    notes,
  };
  state.data.payments.unshift(row);
  pushAudit("Create", `monthly payment ${studentName} ${formatCurrency(amount)} ${month}`);
  e.currentTarget.reset();
  renderShell();
}

async function onPlannerSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const memberKey = String(fd.get("memberKey") || "");
  const batch = String(fd.get("batch") || "").trim();
  const date = String(fd.get("date") || "").trim();
  const time = String(fd.get("time") || "").trim();
  const type = String(fd.get("type") || "Online");
  const place = String(fd.get("place") || "").trim();
  if (!memberKey || !batch || !date || !time) return;
  if (type === "Offline" && !place) {
    toast("Place is required for Offline sessions.");
    return;
  }

  const [kind, id] = memberKey.split(":");
  const source = kind === "patient"
    ? state.data.patients.find(p => p.id === id)
    : state.data.students.find(s => s.id === id);
  if (!source) return;

  const row = {
    id: cryptoId(),
    memberType: kind === "patient" ? "Patient" : "Student",
    memberId: kind === "patient" ? (source.patientId || "") : (source.studentId || ""),
    memberName: source.fullName || "",
    batch,
    date,
    time,
    type,
    place: type === "Offline" ? place : "",
    typePlace: type === "Offline" ? `Offline (${place})` : "Online",
    status: "Pending",
    createdAt: new Date().toISOString(),
  };

  state.data.sessionPlans.unshift(row);
  pushAudit("Create", `planned session for ${row.memberName} on ${date} ${time}`);
  e.currentTarget.reset();
  renderShell();
}

async function editPlan(id) {
  const row = (state.data.sessionPlans || []).find(p => p.id === id);
  if (!row) return;
  const form = await collectForm("Edit Planned Session", [
    { name: "batch", label: "Batch", required: true },
    { name: "date", label: "Date", required: true },
    { name: "time", label: "Time", required: true },
    { name: "type", label: "Type (Online/Offline)", required: true },
    { name: "place", label: "Place" },
    { name: "status", label: "Status", required: true },
  ], {
    batch: row.batch || "",
    date: row.date || "",
    time: row.time || "",
    type: row.type || (String(row.typePlace || "").startsWith("Offline") ? "Offline" : "Online"),
    place: row.place || "Ground",
    status: row.status || "Pending",
  });
  if (!form) return;
  const type = String(form.type || "Online");
  const place = String(form.place || "Ground");
  Object.assign(row, {
    batch: String(form.batch || ""),
    date: String(form.date || ""),
    time: String(form.time || ""),
    type,
    place,
    typePlace: type === "Offline" ? `Offline (${place})` : "Online",
    status: String(form.status || "Pending"),
  });
  pushAudit("Update", `updated planned session for ${row.memberName}`);
  renderShell();
}

async function togglePlanStatus(id) {
  const row = (state.data.sessionPlans || []).find(p => p.id === id);
  if (!row) return;
  row.status = row.status === "Done" ? "Pending" : "Done";
  pushAudit("Update", `session ${row.memberName} marked ${row.status}`);
  renderShell();
}

async function deletePlan(id) {
  const row = (state.data.sessionPlans || []).find(p => p.id === id);
  if (!row) return;
  if (!await confirmAction(`Delete planned session for ${row.memberName}?`)) return;
  state.data.sessionPlans = (state.data.sessionPlans || []).filter(p => p.id !== id);
  pushAudit("Delete", `planned session ${row.memberName}`);
  renderShell();
}

function downloadPlannerCsv() {
  const rows = state.data.sessionPlans || [];
  const header = ["SlNo", "Date", "Member", "MemberType", "MemberId", "Batch", "Time", "Type", "Place", "TypePlace", "Status"];
  const lines = [header.join(",")];
  rows.forEach((r, ix) => {
    const cols = [
      String(ix + 1),
      r.date || "",
      r.memberName || "",
      r.memberType || "",
      r.memberId || "",
      r.batch || "",
      r.time || "",
      r.type || "",
      r.place || "",
      formatPlanTypePlace(r),
      r.status || "",
    ].map(csvEscape);
    lines.push(cols.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planner-${todayYmd()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function deletePayment(id) {
  const row = (state.data.payments || []).find(p => p.id === id);
  if (!row) return;
  if (!await confirmAction(`Delete payment of ${row.studentName} (${formatCurrency(row.amount)})?`)) return;
  state.data.payments = (state.data.payments || []).filter(p => p.id !== id);
  pushAudit("Delete", `payment ${row.studentName} ${formatCurrency(row.amount)}`);
  renderShell();
}

async function upsertStudent(id, forceSpecial) {
  const item = state.data.students.find(s => s.id === id) || {};
  const form = await collectForm("Student", [
    { name: "fullName", label: "Student name", required: true },
    { name: "studentId", label: "Student ID" },
    { name: "martialArtsStyle", label: "Class style" },
    { name: "assignedClass", label: "Assigned class" },
    { name: "monthlyClassFee", label: "Monthly class fee", type: "number" },
    { name: "takingTreatment", label: "Special student taking treatment", type: "checkbox" },
    { name: "treatmentPlan", label: "Treatment plan" },
  ], {
    fullName: item.fullName || "",
    studentId: item.studentId || "",
    martialArtsStyle: item.martialArtsStyle || "",
    assignedClass: item.assignedClass || "",
    monthlyClassFee: item.monthlyClassFee ?? 0,
    takingTreatment: forceSpecial ? true : !!item.takingTreatment,
    treatmentPlan: item.treatmentPlan || "",
  });
  if (!form) return;

  const fullName = String(form.fullName || "").trim();
  if (!fullName) return;
  const takingTreatment = forceSpecial ? true : !!form.takingTreatment;
  const treatmentPlan = takingTreatment ? String(form.treatmentPlan || "") : "";

  const next = {
    id: id || cryptoId(),
    fullName,
    studentId: String(form.studentId || ""),
    martialArtsStyle: String(form.martialArtsStyle || ""),
    assignedClass: String(form.assignedClass || ""),
    monthlyClassFee: Number(form.monthlyClassFee || 0),
    takingTreatment,
    treatmentPlan,
    active: true,
  };

  if (id) {
    const ix = state.data.students.findIndex(s => s.id === id);
    state.data.students[ix] = { ...state.data.students[ix], ...next };
  } else {
    state.data.students.unshift(next);
  }
  pushAudit(id ? "Update" : "Create", `student ${fullName}`);
  renderShell();
}

async function deleteStudent(id) {
  const row = state.data.students.find(s => s.id === id);
  if (!row) return;
  if (!await confirmAction(`Delete ${row.fullName}?`)) return;
  state.data.students = state.data.students.filter(s => s.id !== id);
  pushAudit("Delete", `student ${row.fullName}`);
  renderShell();
}

async function assignClassToStudent(id) {
  const row = state.data.students.find(s => s.id === id);
  if (!row) return;

  const hints = state.data.classSchedule.map(c => c.className).filter(Boolean).slice(0, 6).join(", ");
  const form = await collectForm("Assign Class", [
    { name: "assignedClass", label: hints ? `Class name (e.g. ${hints})` : "Class name", required: true },
  ], {
    assignedClass: row.assignedClass || "",
  });
  if (!form) return;

  row.assignedClass = String(form.assignedClass || "").trim();
  if (!row.assignedClass) return;
  pushAudit("Update", `assigned class ${row.assignedClass} to ${row.fullName}`);
  renderShell();
}

async function markStudentAttendance(id) {
  const row = state.data.students.find(s => s.id === id);
  if (!row) return;

  const form = await collectForm("Student Attendance", [
    { name: "date", label: "Date (YYYY-MM-DD)", required: true },
    { name: "status", label: "Status (Present/Absent/Late)", required: true },
    { name: "className", label: "Class name" },
    { name: "notes", label: "Notes" },
  ], {
    date: todayYmd(),
    status: "Present",
    className: row.assignedClass || "",
    notes: "",
  });
  if (!form) return;

  const date = String(form.date || "").trim();
  const status = String(form.status || "").trim();
  if (!date || !status) return;

  row.lastAttendance = { date, status };
  state.data.attendance.unshift({
    id: cryptoId(),
    date,
    className: String(form.className || row.assignedClass || ""),
    studentName: row.fullName,
    studentId: row.studentId || "",
    status,
    presentCount: "",
    totalCount: "",
    notes: String(form.notes || ""),
  });
  pushAudit("Create", `attendance ${status} for ${row.fullName}`);
  renderShell();
}

async function upsertPatient(id) {
  const item = state.data.patients.find(p => p.id === id) || {};
  const form = await collectForm("Patient", [
    { name: "fullName", label: "Patient name", required: true },
    { name: "patientId", label: "Patient ID" },
    { name: "treatmentPlan", label: "Treatment plan" },
    { name: "progressNotes", label: "Progress notes" },
  ], {
    fullName: item.fullName || "",
    patientId: item.patientId || "",
    treatmentPlan: item.treatmentPlan || "",
    progressNotes: item.progressNotes || "",
  });
  if (!form) return;

  const fullName = String(form.fullName || "").trim();
  if (!fullName) return;

  const next = {
    id: id || cryptoId(),
    fullName,
    patientId: String(form.patientId || ""),
    treatmentPlan: String(form.treatmentPlan || ""),
    progressNotes: String(form.progressNotes || ""),
    active: true,
  };

  if (id) {
    const ix = state.data.patients.findIndex(p => p.id === id);
    state.data.patients[ix] = { ...state.data.patients[ix], ...next };
  } else {
    state.data.patients.unshift(next);
  }
  pushAudit(id ? "Update" : "Create", `patient ${fullName}`);
  renderShell();
}

async function deletePatient(id) {
  const row = state.data.patients.find(p => p.id === id);
  if (!row) return;
  if (!await confirmAction(`Delete ${row.fullName}?`)) return;
  state.data.patients = state.data.patients.filter(p => p.id !== id);
  pushAudit("Delete", `patient ${row.fullName}`);
  renderShell();
}

async function upsertClassSchedule(id) {
  const item = state.data.classSchedule.find(r => r.id === id) || {};
  const form = await collectForm("Class Schedule", [
    { name: "className", label: "Class name", required: true },
    { name: "style", label: "Style" },
    { name: "coach", label: "Coach name" },
    { name: "day", label: "Day" },
    { name: "time", label: "Time" },
    { name: "level", label: "Level" },
  ], {
    className: item.className || "",
    style: item.style || "",
    coach: item.coach || "",
    day: item.day || "",
    time: item.time || "",
    level: item.level || "",
  });
  if (!form) return;

  const className = String(form.className || "").trim();
  if (!className) return;

  const next = {
    id: id || cryptoId(),
    className,
    style: String(form.style || ""),
    coach: String(form.coach || ""),
    day: String(form.day || ""),
    time: String(form.time || ""),
    level: String(form.level || ""),
  };

  if (id) {
    const ix = state.data.classSchedule.findIndex(r => r.id === id);
    state.data.classSchedule[ix] = { ...state.data.classSchedule[ix], ...next };
  } else {
    state.data.classSchedule.unshift(next);
  }
  pushAudit(id ? "Update" : "Create", `class schedule ${className}`);
  renderShell();
}

async function deleteClassSchedule(id) {
  const row = state.data.classSchedule.find(r => r.id === id);
  if (!row) return;
  if (!await confirmAction(`Delete class ${row.className}?`)) return;
  state.data.classSchedule = state.data.classSchedule.filter(r => r.id !== id);
  pushAudit("Delete", `class schedule ${row.className}`);
  renderShell();
}

async function upsertAttendance(id) {
  const item = state.data.attendance.find(r => r.id === id) || {};
  const form = await collectForm("Attendance", [
    { name: "date", label: "Date (YYYY-MM-DD)" },
    { name: "className", label: "Class name" },
    { name: "studentName", label: "Student name" },
    { name: "status", label: "Status (Present/Absent/Late)" },
    { name: "presentCount", label: "Present count", type: "number" },
    { name: "totalCount", label: "Total count", type: "number" },
    { name: "notes", label: "Notes" },
  ], {
    date: item.date || "",
    className: item.className || "",
    studentName: item.studentName || "",
    status: item.status || "",
    presentCount: item.presentCount ?? 0,
    totalCount: item.totalCount ?? 0,
    notes: item.notes || "",
  });
  if (!form) return;

  const date = String(form.date || "");
  const className = String(form.className || "");
  const studentName = String(form.studentName || "");
  const status = String(form.status || "");
  const presentCount = Number(form.presentCount || 0);
  const totalCount = Number(form.totalCount || 0);
  const notes = String(form.notes || "");
  if (!date && !className && !studentName) return;

  const next = {
    id: id || cryptoId(),
    date,
    className,
    studentName,
    status,
    presentCount: Number.isFinite(presentCount) ? presentCount : 0,
    totalCount: Number.isFinite(totalCount) ? totalCount : 0,
    notes,
  };

  if (id) {
    const ix = state.data.attendance.findIndex(r => r.id === id);
    state.data.attendance[ix] = { ...state.data.attendance[ix], ...next };
  } else {
    state.data.attendance.unshift(next);
  }
  pushAudit(id ? "Update" : "Create", `attendance ${date} ${className}`.trim());
  renderShell();
}

async function deleteAttendance(id) {
  const row = state.data.attendance.find(r => r.id === id);
  if (!row) return;
  if (!await confirmAction(`Delete attendance for ${row.className || row.date || "entry"}?`)) return;
  state.data.attendance = state.data.attendance.filter(r => r.id !== id);
  pushAudit("Delete", `attendance ${row.className || row.date || "entry"}`);
  renderShell();
}

async function upsertTreatmentSchedule(id) {
  const item = state.data.treatmentSchedule.find(r => r.id === id) || {};
  const form = await collectForm("Treatment Schedule", [
    { name: "personType", label: "Type (Student/Patient)" },
    { name: "personName", label: "Name", required: true },
    { name: "personId", label: "Student/Patient ID" },
    { name: "therapyType", label: "Therapy type" },
    { name: "day", label: "Day" },
    { name: "time", label: "Time" },
    { name: "therapist", label: "Therapist" },
    { name: "status", label: "Status" },
    { name: "treatmentFee", label: "Treatment fee", type: "number" },
  ], {
    personType: item.personType || "",
    personName: item.personName || "",
    personId: item.personId || "",
    therapyType: item.therapyType || "",
    day: item.day || "",
    time: item.time || "",
    therapist: item.therapist || "",
    status: item.status || "Planned",
    treatmentFee: item.treatmentFee ?? 0,
  });
  if (!form) return;

  const personName = String(form.personName || "").trim();
  if (!personName) return;

  const next = {
    id: id || cryptoId(),
    personType: String(form.personType || ""),
    personName,
    personId: String(form.personId || ""),
    therapyType: String(form.therapyType || ""),
    day: String(form.day || ""),
    time: String(form.time || ""),
    therapist: String(form.therapist || ""),
    status: String(form.status || "Planned"),
    treatmentFee: Number(form.treatmentFee || 0),
  };

  if (id) {
    const ix = state.data.treatmentSchedule.findIndex(r => r.id === id);
    state.data.treatmentSchedule[ix] = { ...state.data.treatmentSchedule[ix], ...next };
  } else {
    state.data.treatmentSchedule.unshift(next);
  }
  pushAudit(id ? "Update" : "Create", `treatment schedule ${personName}`);
  renderShell();
}

async function deleteTreatmentSchedule(id) {
  const row = state.data.treatmentSchedule.find(r => r.id === id);
  if (!row) return;
  if (!await confirmAction(`Delete treatment slot for ${row.personName}?`)) return;
  state.data.treatmentSchedule = state.data.treatmentSchedule.filter(r => r.id !== id);
  pushAudit("Delete", `treatment schedule ${row.personName}`);
  renderShell();
}

function pushAudit(title, detail) {
  state.data.auditLog = state.data.auditLog || [];
  state.data.auditLog.push({ id: cryptoId(), title, detail, actor: state.user.name, at: new Date().toISOString() });
}

async function reloadData() {
  try {
    const d = await api("/api/data");
    state.data = d.data;
    ensureDataShape();
    renderShell();
    toast("Reloaded from server.");
  } catch (e) {
    toast(e.message || "Reload failed");
  }
}

async function saveData() {
  try {
    ensureDataShape();
    state.data.updatedAt = new Date().toISOString();
    await api("/api/data", { method: "PUT", body: { data: state.data } });
    toast("Saved to server.");
    await reloadData();
  } catch (e) {
    toast(e.message || "Save failed");
  }
}

async function doLogout() {
  try { await api("/api/logout", { method: "POST", body: {} }); } catch {}
  localStorage.removeItem(TOKEN_KEY);
  state.token = "";
  state.user = null;
  renderLogin();
}

function visibleModules() {
  const all = [
    { id: "dashboard", title: "Dashboard", icon: "🏠" },
    { id: "students", title: "Students", icon: "🥋", scope: "students", count: state.data.students.length },
    { id: "patients", title: "Patients", icon: "🏥", scope: "patients", count: state.data.patients.length },
    { id: "planner", title: "Planner", icon: "🗂", scope: "schedule", count: state.data.sessionPlans.length },
    { id: "therapeutic", title: "Therapeutic", icon: "🧘", scope: "therapeutic", count: state.data.patients.length + state.data.students.filter(s => s.takingTreatment).length },
    { id: "classSchedule", title: "Class Schedule", icon: "📘", scope: "students", count: state.data.classSchedule.length },
    { id: "attendance", title: "Attendance", icon: "🗓", scope: "students", count: state.data.attendance.length },
    { id: "treatmentSchedule", title: "Treatment Schedule", icon: "🩺", scope: "therapeutic", count: state.data.treatmentSchedule.length },
    { id: "payments", title: "Payments", icon: "💳", scope: "payments", count: state.data.payments.length },
    { id: "records", title: "Records", icon: "🧾", count: state.data.auditLog.length },
  ];
  return all.filter(m => !m.scope || state.scopes.includes(m.scope));
}

function moduleTitle(id) {
  return ({
    dashboard: "Dashboard",
    students: "Students",
    patients: "Patients",
    planner: "Planner",
    therapeutic: "Therapeutic",
    classSchedule: "Class Schedule",
    attendance: "Attendance",
    treatmentSchedule: "Treatment Schedule",
    payments: "Payments",
    records: "Records",
  })[id] || "Dashboard";
}

function labelRole(role) {
  return ({ super_admin: "Super Admin", student_admin: "Student Admin", patient_admin: "Patient Admin", finance_admin: "Finance Admin" })[role] || role;
}

function filterRows(rows) {
  const q = state.search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
}

function ensureDataShape() {
  const d = state.data || {};
  if (!Array.isArray(d.students)) d.students = [];
  if (!Array.isArray(d.patients)) d.patients = [];
  if (!Array.isArray(d.classSchedule)) d.classSchedule = [];
  if (!Array.isArray(d.attendance)) d.attendance = [];
  if (!Array.isArray(d.treatmentSchedule)) d.treatmentSchedule = [];
  if (!Array.isArray(d.sessionPlans)) d.sessionPlans = [];
  if (!Array.isArray(d.payments)) d.payments = [];
  if (!Array.isArray(d.auditLog)) d.auditLog = [];
  state.data = d;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function formatPlanTypePlace(plan) {
  if (!plan) return "";
  if (plan.typePlace) return String(plan.typePlace);
  const type = String(plan.type || "Online");
  const place = String(plan.place || "");
  return type === "Offline" ? `Offline (${place || "Ground"})` : "Online";
}

function togglePlannerPlace(typeValue) {
  const wrap = document.getElementById("planner-place-wrap");
  const select = document.getElementById("planner-place");
  if (!wrap || !select) return;
  const offline = String(typeValue || "").toLowerCase() === "offline";
  wrap.style.display = offline ? "block" : "none";
  select.required = offline;
  if (!offline) select.value = "Ground";
}

function filterPaymentRows(rows) {
  let filtered = filterRows(rows);
  if (state.paymentTab === "monthly") filtered = filtered.filter(r => r.type === "monthly");
  if (state.paymentTab === "daily") filtered = filtered.filter(r => r.type === "daily");
  return filtered;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatStudentAttendance(lastAttendance) {
  if (!lastAttendance || !lastAttendance.date) return "-";
  return `${lastAttendance.date} (${lastAttendance.status || "-"})`;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function treatmentFeeIfTaken(row) {
  const status = String(row?.status || "").toLowerCase();
  const taken = status === "completed" || status === "taken" || status === "done";
  return taken ? Number(row?.treatmentFee || 0) : 0;
}

function treatmentDueForPerson(name, id) {
  return (state.data.treatmentSchedule || [])
    .filter(r => String(r.personName || "").toLowerCase() === String(name || "").toLowerCase() || String(r.personId || "") === String(id || ""))
    .reduce((sum, r) => sum + treatmentFeeIfTaken(r), 0);
}

function monthlyFeeForPerson(row) {
  const isStudent = String(row?.personType || "").toLowerCase() === "student";
  if (!isStudent) return 0;
  const student = (state.data.students || []).find(
    s => String(s.studentId || "") === String(row?.personId || "") || String(s.fullName || "").toLowerCase() === String(row?.personName || "").toLowerCase(),
  );
  return Number(student?.monthlyClassFee || 0);
}

function formatCurrency(amount) {
  const value = Number(amount || 0);
  return `Rs ${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
}

function cryptoId() {
  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function escapeHtml(v) {
  return String(v || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toast(msg) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function collectForm(title, fields, values = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)} form">
        <h3>${escapeHtml(title)}</h3>
        <form class="modal-form">
          ${fields.map(f => {
            const type = f.type || "text";
            if (type === "checkbox") {
              return `<label class="modal-check"><input type="checkbox" name="${escapeHtml(f.name)}" ${values[f.name] ? "checked" : ""} /> ${escapeHtml(f.label)}</label>`;
            }
            return `
              <label>
                <span>${escapeHtml(f.label)}</span>
                <input type="${escapeHtml(type)}" name="${escapeHtml(f.name)}" value="${escapeHtml(values[f.name] ?? "")}" ${f.required ? "required" : ""} />
              </label>
            `;
          }).join("")}
          <div class="actions">
            <button type="button" class="ghost" data-modal="cancel">Cancel</button>
            <button type="submit" class="primary">Save</button>
          </div>
        </form>
      </div>
    `;

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.addEventListener("click", ev => {
      if (ev.target === overlay) close(null);
    });

    const formEl = overlay.querySelector(".modal-form");
    overlay.querySelector("[data-modal='cancel']").addEventListener("click", () => close(null));
    formEl.addEventListener("submit", ev => {
      ev.preventDefault();
      const fd = new FormData(formEl);
      const out = {};
      fields.forEach(f => {
        if ((f.type || "text") === "checkbox") {
          out[f.name] = formEl.elements[f.name].checked;
        } else if ((f.type || "text") === "number") {
          out[f.name] = Number(fd.get(f.name) || 0);
        } else {
          out[f.name] = String(fd.get(f.name) || "");
        }
      });
      close(out);
    });

    document.body.appendChild(overlay);
    overlay.querySelector("input")?.focus();
  });
}

function confirmAction(message) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-card modal-small" role="dialog" aria-modal="true" aria-label="Confirm action">
        <h3>Confirm</h3>
        <p>${escapeHtml(message)}</p>
        <div class="actions">
          <button type="button" class="ghost" data-confirm="no">Cancel</button>
          <button type="button" class="danger" data-confirm="yes">Delete</button>
        </div>
      </div>
    `;

    function close(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.addEventListener("click", ev => {
      if (ev.target === overlay) close(false);
    });
    overlay.querySelector("[data-confirm='no']").addEventListener("click", () => close(false));
    overlay.querySelector("[data-confirm='yes']").addEventListener("click", () => close(true));

    document.body.appendChild(overlay);
  });
}

async function api(path, opts = {}) {
  const method = opts.method || "GET";
  const headers = { "Content-Type": "application/json" };
  if (opts.auth !== false && state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(opts.body || {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
