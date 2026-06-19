const STORAGE_KEY = "agam-management-system-v1";
const SESSION_KEY = "agam-session-v1";
const THEME_KEY = "agam-theme-v1";
const LAST_EXPORT_KEY = "agam-last-export-v1";

const roleConfig = {
  super_admin: { label: "Super Admin", scopes: ["students", "patients", "therapeutic", "payments", "attendance", "schedule", "reports", "audit", "settings"] },
  student_admin: { label: "Student Admin", scopes: ["students", "therapeutic", "attendance", "schedule", "reports"] },
  patient_admin: { label: "Patient Admin", scopes: ["patients", "therapeutic", "schedule", "reports"] },
  finance_admin: { label: "Finance Admin", scopes: ["payments", "reports"] },
};

const demoData = {
  users: [
    { id: cryptoId(), username: "admin", password: "Admin123!", role: "super_admin", name: "System Owner", mustChangePassword: true },
    { id: cryptoId(), username: "students", password: "Student123!", role: "student_admin", name: "Student Desk", mustChangePassword: true },
    { id: cryptoId(), username: "patients", password: "Patient123!", role: "patient_admin", name: "Patient Desk", mustChangePassword: true },
    { id: cryptoId(), username: "finance", password: "Finance123!", role: "finance_admin", name: "Finance Desk", mustChangePassword: true },
  ],
  students: [
    sampleStudent("S-1001", "Amina Yusuf", "Female", "Yoga / Karate", "Blue", true, true, "Shoulder mobility therapy + light class routine"),
    sampleStudent("S-1002", "Daniel Okoro", "Male", "Taekwondo", "Green", true),
    sampleStudent("S-1003", "Maya Singh", "Female", "Kickboxing", "Yellow", false),
  ],
  patients: [
    samplePatient("P-2001", "Grace Mensah", "Back pain and recovery program"),
    samplePatient("P-2002", "Omar Ali", "Posture and mobility therapy"),
  ],
  classes: [
    { id: cryptoId(), name: "Morning Discipline", style: "Karate", instructor: "Coach Tunde", day: "Mon", time: "07:00", capacity: 20, studentIds: [] },
    { id: cryptoId(), name: "Strength Flow", style: "Kickboxing", instructor: "Coach Ada", day: "Wed", time: "18:00", capacity: 18, studentIds: [] },
  ],
  appointments: [
    { id: cryptoId(), patientId: null, patientName: "Grace Mensah", date: todayISO(), time: "10:30", purpose: "Follow-up therapy", notes: "Improvement noted", reminder: true },
  ],
  payments: [
    { id: cryptoId(), ownerType: "student", ownerName: "Amina Yusuf", category: "Membership Fee", amount: 120, paidOn: todayISO(), method: "Cash", reference: "R-001", notes: "Quarterly fee" },
    { id: cryptoId(), ownerType: "patient", ownerName: "Grace Mensah", category: "Therapy Fee", amount: 90, paidOn: todayISO(), method: "Card", reference: "R-002", notes: "Session 4" },
  ],
  attendance: [
    { id: cryptoId(), personType: "student", personName: "Amina Yusuf", date: todayISO(), className: "Morning Discipline", status: "Present" },
    { id: cryptoId(), personType: "student", personName: "Daniel Okoro", date: todayISO(), className: "Strength Flow", status: "Absent" },
  ],
  auditLog: [],
};

const appState = {
  data: loadData(),
  session: loadSession(),
  view: "dashboard",
  search: "",
  sortKey: "name",
  sortDir: "asc",
  selectedId: null,
  filters: {},
  selectedModule: "dashboard",
  fileHandle: null,
  fileName: null,
  filePendingReconnect: false,
};

const app = document.getElementById("app");

bootstrap();

function bootstrap() {
  applyTheme(getStoredTheme());
  render();
  tryReconnectFile();
}

function render() {
  const session = appState.session;
  if (!session) {
    app.innerHTML = renderLoginView();
    bindLogin();
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    clearSession();
    render();
    return;
  }

  app.innerHTML = renderShell(user);
  bindShell(user);
}

function renderLoginView() {
  return `
    <div class="auth-shell">
      <div class="auth-card">
        <section class="auth-art">
          <div>
            <h1>AGAM Management System</h1>
            <p>Offline management for martial arts, therapy, members, attendance, schedules, and finance. Everything runs locally in your browser.</p>
          </div>
          <div class="small-text">Demo accounts: admin / Admin123!, students / Student123!, patients / Patient123!, finance / Finance123!</div>
        </section>
        <section class="auth-form panel">
          <div class="panel-header" style="padding:0 0 10px; border:0;">
            <div>
              <h3>Admin Sign In</h3>
              <p>Use one of the built-in demo accounts or your own local admin account.</p>
            </div>
          </div>
          <form id="login-form" class="layout-grid">
            <div class="form-group">
              <label for="username">Username</label>
              <input class="form-control" id="username" name="username" autocomplete="username" required />
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input class="form-control" id="password" name="password" type="password" autocomplete="current-password" required />
            </div>
            <button class="primary-button" type="submit">Sign in</button>
            <p class="inline-note">Admin-only access. No student or patient login screens are exposed.</p>
          </form>
        </section>
      </div>
    </div>
  `;
}

function renderShell(user) {
  const activeLabel = roleConfig[user.role].label;
  const modules = getVisibleModules(user.role);
  const activeContent = renderModule(user, appState.selectedModule);
  const banner = user.mustChangePassword
    ? `<div class="change-pw-banner">⚠️ You are using a default password. Please <button class="banner-link" data-action="open-password">change your password</button> to secure your account. <button class="banner-close" data-action="dismiss-banner">✕</button></div>`
    : "";

  const quickAddLabel = moduleQuickAddLabel(appState.selectedModule);

  return `
    <div class="app-shell">
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <div class="brand-logo">🏯</div>
          <h1>AGAM</h1>
          <p>Martial arts &amp; therapy hub</p>
        </div>
        <nav>${modules.map(module => `
          <button class="nav-item ${appState.selectedModule === module.id ? "active" : ""}" data-module="${module.id}">
            <span class="nav-icon">${module.icon}</span>
            <span class="nav-label">${module.title}</span>
            ${module.count !== undefined ? `<span class="nav-count">${module.count}</span>` : ""}
          </button>
        `).join("")}</nav>
        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="user-chip-avatar">${escapeHtml(user.name[0])}</div>
            <div><strong>${escapeHtml(user.name)}</strong><br /><span class="small-text">${activeLabel}</span></div>
          </div>
          <div class="storage-info">
            ${appState.fileHandle
              ? `<span class="sync-dot sync-on"></span><strong> File sync ON</strong><br /><span class="small-text">📁 ${escapeHtml(appState.fileName || "data file")} · ${storageUsageKB()} KB</span>`
              : `<span class="sync-dot sync-off"></span> Browser only<br /><span class="small-text">${storageUsageKB()} KB · ${lastExportAgo() ? `backup ${lastExportAgo()}` : "⚠️ no backup yet"}</span>`
            }
          </div>
          ${appState.filePendingReconnect ? `<button class="reconnect-btn" data-action="reconnect-file">📢 Tap to reconnect file</button>` : ""}
          <div class="sidebar-actions">
            <button data-action="toggle-theme" title="Toggle dark/light mode">🌓 Theme</button>
            <button data-action="open-password" title="Change password">🔑 Password</button>
            <button data-action="logout" title="Sign out">🚪 Logout</button>
          </div>
        </div>
      </aside>
      <main class="main">
        ${banner}
        <header class="topbar">
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="menu-toggle" data-action="toggle-sidebar">☰</button>
            <div>
              <h2>${moduleTitle(appState.selectedModule)}</h2>
              <p>${moduleSubtitle(appState.selectedModule)}</p>
            </div>
          </div>
          <div class="topbar-actions">
            <button class="ghost-button" data-action="backup-json">⬇ Export</button>
            <button class="ghost-button" data-action="import-json">⬆ Import</button>
            ${quickAddLabel ? `<button class="primary-button" data-action="quick-add">${quickAddLabel}</button>` : ""}
          </div>
        </header>
        <section id="content-area">${activeContent}</section>
      </main>
    </div>
    <input id="file-import" type="file" accept="application/json" class="hidden" />
  `;
}

function renderModule(user, moduleId) {
  switch (moduleId) {
    case "dashboard": return renderDashboard(user);
    case "students": return renderPeopleModule("students", user);
    case "patients": return renderPeopleModule("patients", user);
    case "therapeutic": return renderTherapeuticModule(user);
    case "attendance": return renderAttendanceModule(user);
    case "schedule": return renderScheduleModule(user);
    case "appointments": return renderAppointmentsModule(user);
    case "payments": return renderPaymentsModule(user);
    case "reports": return renderReportsModule(user);
    case "audit": return renderAuditModule(user);
    case "profile": return renderProfileModule(user);
    case "settings": return renderSettingsModule(user);
    default: return renderDashboard(user);
  }
}

function renderTherapeuticModule(user) {
  const therapeuticStudents = appState.data.students.filter(student => student.takingTreatment);
  const patients = appState.data.patients;
  const search = appState.search.trim().toLowerCase();

  const visibleStudents = sortList(
    therapeuticStudents.filter(item => !search || JSON.stringify(item).toLowerCase().includes(search)),
    appState.sortKey,
    appState.sortDir,
  );
  const visiblePatients = sortList(
    patients.filter(item => !search || JSON.stringify(item).toLowerCase().includes(search)),
    appState.sortKey,
    appState.sortDir,
  );

  return `
    <div class="layout-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Therapeutic Management</h3>
            <p>Patients and special students taking treatment along with classes.</p>
          </div>
          <div class="topbar-actions">
            <button class="primary-button" data-action="new-patient">+ Add Patient</button>
            <button class="ghost-button" data-action="new-student">+ Add Special Student</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="section-toolbar">
            <input class="search-input" id="search-input" placeholder="Search therapeutic records..." value="${escapeHtml(appState.search)}" />
          </div>
          <div class="grid-2">
            <div class="card">
              <h4>Special Students Under Treatment (${visibleStudents.length})</h4>
              <div class="table-wrap" style="margin-top:10px;">
                <table>
                  <thead><tr><th>Name</th><th>Student ID</th><th>Class Style</th><th>Treatment Plan</th><th>Actions</th></tr></thead>
                  <tbody>
                    ${visibleStudents.map(item => `
                      <tr>
                        <td><strong>${escapeHtml(item.fullName)}</strong></td>
                        <td>${escapeHtml(item.studentId || "")}</td>
                        <td>${escapeHtml(item.martialArtsStyle || "")}</td>
                        <td class="small-text">${escapeHtml((item.treatmentPlan || item.notes || "").slice(0, 80))}${(item.treatmentPlan || item.notes || "").length > 80 ? "..." : ""}</td>
                        <td><div class="td-actions"><button class="table-button" data-action="view-student" data-id="${item.id}">👁 View</button><button class="table-button" data-action="edit-student" data-id="${item.id}">✏️ Edit</button></div></td>
                      </tr>
                    `).join("") || `<tr><td colspan="5">${emptyState("No special students under treatment.", "Add Student")}</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="card">
              <h4>Therapy Patients (${visiblePatients.length})</h4>
              <div class="table-wrap" style="margin-top:10px;">
                <table>
                  <thead><tr><th>Name</th><th>Patient ID</th><th>Treatment Plan</th><th>Progress</th><th>Actions</th></tr></thead>
                  <tbody>
                    ${visiblePatients.map(item => `
                      <tr>
                        <td><strong>${escapeHtml(item.fullName)}</strong></td>
                        <td>${escapeHtml(item.patientId || "")}</td>
                        <td class="small-text">${escapeHtml((item.treatmentPlan || "").slice(0, 70))}${(item.treatmentPlan || "").length > 70 ? "..." : ""}</td>
                        <td class="small-text">${escapeHtml((item.progressNotes || "").slice(0, 70))}${(item.progressNotes || "").length > 70 ? "..." : ""}</td>
                        <td><div class="td-actions"><button class="table-button" data-action="view-patient" data-id="${item.id}">👁 View</button><button class="table-button" data-action="edit-patient" data-id="${item.id}">✏️ Edit</button></div></td>
                      </tr>
                    `).join("") || `<tr><td colspan="5">${emptyState("No therapy patients found.", "Add Patient")}</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderDashboard(user) {
  const today = todayISO();
  const activeMembers = appState.data.students.filter(student => student.active !== false).length;
  const upcomingAppointments = appState.data.appointments.filter(item => item.date >= today).slice(0, 5);
  const paymentsTotal = appState.data.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const classesToday = appState.data.classes.filter(item => dayMatchesToday(item.day));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0] || user.name;

  return `
    <div class="layout-grid dashboard-sections">
      <div class="dashboard-welcome"><span>${greeting}, ${escapeHtml(firstName)} 👋</span><span class="small-text">${new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span></div>
      <section class="widgets">
        <article class="widget widget-clickable" data-module="students"><div class="widget-icon">🥋</div><div class="label">Students</div><div class="value">${appState.data.students.length}</div><div class="note">${activeMembers} active</div></article>
        <article class="widget widget-clickable" data-module="patients"><div class="widget-icon">🏥</div><div class="label">Patients</div><div class="value">${appState.data.patients.length}</div><div class="note">Therapy records</div></article>
        <article class="widget widget-clickable" data-module="schedule"><div class="widget-icon">📅</div><div class="label">Today's classes</div><div class="value">${classesToday.length}</div><div class="note">Scheduled today</div></article>
        <article class="widget widget-clickable" data-module="payments"><div class="widget-icon">💰</div><div class="label">Payments</div><div class="value">${formatCurrency(paymentsTotal)}</div><div class="note">Total income</div></article>
      </section>
      <div class="quick-actions">
        <button class="quick-action-btn" data-action="new-student">🥋 Add Student</button>
        <button class="quick-action-btn" data-action="new-patient">🏥 Add Patient</button>
        <button class="quick-action-btn" data-action="mark-attendance">✅ Mark Attendance</button>
        <button class="quick-action-btn" data-action="new-payment">💰 Record Payment</button>
        <button class="quick-action-btn" data-action="new-appointment">🗓 New Appointment</button>
        <button class="quick-action-btn" data-action="new-class">📅 Create Class</button>
      </div>
      <section class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div><h3>Today's classes and appointments</h3><p>Quick operational snapshot</p></div>
          </div>
          <div class="panel-body">
            <div class="feed-list">
              ${classesToday.map(item => feedRow(item.name, `${item.time} • ${item.instructor} • ${item.style}`, "Class")).join("") || emptyState("No classes scheduled for today.", "Create Class")}
              ${upcomingAppointments.map(item => feedRow(item.patientName, `${relativeDate(item.date)} ${item.time} • ${item.purpose}`, "Appt")).join("") || emptyState("No upcoming appointments.", "New Appointment")}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <div><h3>Recent activity</h3><p>Audit trail of admin actions</p></div>
          </div>
          <div class="panel-body">
            <div class="activity-log">
              ${appState.data.auditLog.slice(-6).reverse().map(activity => feedRow(activity.title, `${activity.detail} • ${formatDateTime(activity.at)}`, activity.level || "Action")).join("") || emptyState("No activity yet.")}
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderPeopleModule(type, user) {
  const items = type === "students" ? appState.data.students : appState.data.patients;
  const title = type === "students" ? "Student Management" : "Patient Management";
  const subtitle = type === "students" ? "Manage student records, belts, notes, and class assignments." : "Manage patient records, therapy notes, and treatment progress.";
  const allowed = hasScope(user.role, type);
  const profile = appState.selectedId ? items.find(item => item.id === appState.selectedId) : null;
  const visibleItems = sortList(filterList(items, appState.search), appState.sortKey, appState.sortDir);

  return `
    <div class="layout-grid">
      <section class="panel">
        <div class="panel-header">
          <div><h3>${title}</h3><p>${subtitle}</p></div>
          <button class="primary-button" data-action="new-${type.slice(0, -1)}">Add ${type.slice(0, -1)}</button>
        </div>
        <div class="panel-body">
          <div class="section-toolbar">
            <input class="search-input" id="search-input" placeholder="Search ${type.slice(0, -1)}s..." value="${escapeHtml(appState.search)}" />
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <select class="filter-select" id="status-filter" style="min-width:180px;">
                <option value="">All records</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
              <button class="ghost-button" data-action="reset-filters">Reset</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th data-sort="name">Name</th>
                  <th data-sort="id">ID</th>
                  <th data-sort="contact">Contact</th>
                  <th data-sort="status">Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${visibleItems.map(item => `
                  <tr>
                    <td><strong>${escapeHtml(item.fullName)}</strong><br /><span class="small-text">${escapeHtml(item.gender || item.treatmentPlan || "")}</span></td>
                    <td>${escapeHtml(item.studentId || item.patientId || item.id)}</td>
                    <td>${escapeHtml(item.phone || item.email || item.contact || "")}</td>
                    <td>${statusBadge(item.active !== false ? "Active" : "Inactive", item.active !== false ? "success" : "neutral")}</td>
                    <td class="small-text">${escapeHtml((item.notes || item.progressNotes || item.medicalNotes || "").slice(0, 60))}${(item.notes || item.progressNotes || item.medicalNotes || "").length > 60 ? "…" : ""}</td>
                    <td>
                      <div class="td-actions">
                        <button class="table-button" data-action="view-${type.slice(0, -1)}" data-id="${item.id}">👁 View</button>
                        ${allowed ? `<button class="table-button" data-action="edit-${type.slice(0, -1)}" data-id="${item.id}">✏️ Edit</button><button class="danger-button" style="padding:6px 10px;font-size:0.82rem;border-radius:8px;" data-action="delete-${type.slice(0, -1)}" data-id="${item.id}">🗑</button>` : ""}
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      ${profile ? renderProfilePanel(type, profile, user) : `<section class="panel"><div class="panel-body">${emptyState("Select a record to view the profile panel.")}</div></section>`}
    </div>
  `;
}

function renderProfilePanel(type, item, user) {
  const isStudent = type === "students";
  const allowed = hasScope(user.role, type);
  return `
    <section class="panel">
      <div class="panel-header">
        <div><h3>${escapeHtml(item.fullName)}</h3><p>${escapeHtml(item.studentId || item.patientId || item.id)}</p></div>
        <img class="avatar" src="${escapeHtml(item.photo || placeholderAvatar(item.fullName))}" alt="${escapeHtml(item.fullName)}" />
      </div>
      <div class="panel-body">
        <div class="card">
          <p><strong>Contact:</strong> ${escapeHtml(item.phone || item.contact || "")}</p>
          <p><strong>Email:</strong> ${escapeHtml(item.email || "")}</p>
          <p><strong>Address:</strong> ${escapeHtml(item.address || "")}</p>
          <p><strong>Notes:</strong> ${escapeHtml(item.notes || item.medicalNotes || item.progressNotes || "")}</p>
          ${isStudent ? `<p><strong>Style:</strong> ${escapeHtml(item.martialArtsStyle || "")}</p><p><strong>Belt rank:</strong> ${escapeHtml(item.beltRank || "")}</p><p><strong>Emergency:</strong> ${escapeHtml(item.emergencyContact || "")}</p><p><strong>Under treatment:</strong> ${item.takingTreatment ? "Yes" : "No"}</p><p><strong>Treatment plan:</strong> ${escapeHtml(item.treatmentPlan || "-")}</p>` : `<p><strong>Treatment plan:</strong> ${escapeHtml(item.treatmentPlan || "")}</p><p><strong>Medical history:</strong> ${escapeHtml(item.medicalHistory || "")}</p><p><strong>Therapy notes:</strong> ${escapeHtml(item.therapyNotes || "")}</p>`}
          ${allowed ? `<div class="form-actions"><button class="primary-button" data-action="edit-${type.slice(0, -1)}" data-id="${item.id}">Edit profile</button></div>` : ""}
        </div>
      </div>
    </section>
  `;
}

function renderAttendanceModule(user) {
  const today = todayISO();
  const rows = appState.data.attendance.slice().reverse();
  const classesToday = appState.data.classes.filter(item => dayMatchesToday(item.day));

  return `
    <div class="layout-grid">
      <section class="panel">
        <div class="panel-header">
          <div><h3>Attendance System</h3><p>Track daily presence and build monthly reports.</p></div>
          <button class="primary-button" data-action="mark-attendance">Mark attendance</button>
        </div>
        <div class="panel-body">
          <div class="grid-2">
            <div class="card">
              <h4>Today's classes</h4>
              ${classesToday.map(item => `<p>${escapeHtml(item.name)} • ${escapeHtml(item.time)} • ${escapeHtml(item.instructor)}</p>`).join("") || emptyState("No classes scheduled today.")}
            </div>
            <div class="card">
              <h4>Quick stats</h4>
              <p>Present today: ${appState.data.attendance.filter(item => item.date === today && item.status === "Present").length}</p>
              <p>Absent today: ${appState.data.attendance.filter(item => item.date === today && item.status === "Absent").length}</p>
              <p>Records stored: ${appState.data.attendance.length}</p>
            </div>
          </div>
          <div class="table-wrap" style="margin-top:14px;">
            <table>
              <thead><tr><th>Date</th><th>Person</th><th>Class</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                ${rows.map(item => `
                  <tr>
                    <td>${escapeHtml(item.date)}</td>
                    <td>${escapeHtml(item.personName)}</td>
                    <td>${escapeHtml(item.className)}</td>
                    <td>${statusBadge(item.status, item.status === "Present" ? "success" : item.status === "Late" ? "warning" : "danger")}</td>
                    <td><div class="td-actions"><button class="danger-button" style="padding:6px 10px;font-size:0.82rem;border-radius:8px;" data-action="delete-attendance" data-id="${item.id}">🗑</button></div></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><div><h3>Monthly reports</h3><p>Summary by month</p></div></div>
        <div class="panel-body">${renderMonthlyReport(appState.data.attendance, "attendance")}</div>
      </section>
    </div>
  `;
}

function renderScheduleModule(user) {
  const rows = appState.data.classes.slice();
  return `
    <div class="layout-grid">
      <section class="panel">
        <div class="panel-header">
          <div><h3>Class Scheduling</h3><p>Create classes, assign instructors, and manage student rosters.</p></div>
          <button class="primary-button" data-action="new-class">Create class</button>
        </div>
        <div class="panel-body">
          <div class="calendar">
            <div class="calendar-grid">
              ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => `
                <div class="calendar-cell">
                  <strong>${day}</strong>
                  ${rows.filter(item => item.day === day).map(item => `<div class="badge">${escapeHtml(item.name)} • ${escapeHtml(item.time)}</div>`).join("<br />") || `<span class="small-text">No classes</span>`}
                </div>
              `).join("")}
            </div>
          </div>
          <div class="table-wrap" style="margin-top:14px;">
            <table>
              <thead><tr><th>Name</th><th>Style</th><th>Instructor</th><th>Day</th><th>Time</th><th>Capacity</th><th>Actions</th></tr></thead>
              <tbody>
                ${rows.map(item => `
                  <tr>
                    <td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.style)}</td><td>${escapeHtml(item.instructor)}</td><td>${escapeHtml(item.day)}</td><td>${escapeHtml(item.time)}</td><td>${escapeHtml(String(item.capacity || 0))}</td>
                    <td><div class="td-actions"><button class="table-button" data-action="edit-class" data-id="${item.id}">✏️ Edit</button><button class="danger-button" style="padding:6px 10px;font-size:0.82rem;border-radius:8px;" data-action="delete-class" data-id="${item.id}">🗑</button></div></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderAppointmentsModule(user) {
  const rows = appState.data.appointments.slice().reverse();
  return `
    <div class="layout-grid">
      <section class="panel">
        <div class="panel-header">
          <div><h3>Appointment Scheduling</h3><p>Manage patient visits, reminders, and histories.</p></div>
          <button class="primary-button" data-action="new-appointment">Create appointment</button>
        </div>
        <div class="panel-body">
          <div class="calendar">
            <div class="calendar-grid">
              ${buildMiniCalendar(rows)}
            </div>
          </div>
          <div class="table-wrap" style="margin-top:14px;">
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Purpose</th><th>Reminder</th><th>Actions</th></tr></thead>
              <tbody>
                ${rows.map(item => `
                  <tr>
                    <td>${relativeDate(item.date)}</td><td>${escapeHtml(item.time)}</td><td>${escapeHtml(item.patientName)}</td><td>${escapeHtml(item.purpose)}</td><td>${statusBadge(item.reminder ? "On" : "Off", item.reminder ? "success" : "neutral")}</td>
                    <td><div class="td-actions"><button class="table-button" data-action="edit-appointment" data-id="${item.id}">✏️ Edit</button><button class="danger-button" style="padding:6px 10px;font-size:0.82rem;border-radius:8px;" data-action="delete-appointment" data-id="${item.id}">🗑</button></div></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderPaymentsModule(user) {
  const rows = appState.data.payments.slice().reverse();
  const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return `
    <div class="layout-grid">
      <section class="widgets">
        <article class="widget"><div class="label">Income total</div><div class="value">${formatCurrency(total)}</div><div class="note">All payment records</div></article>
        <article class="widget"><div class="label">Outstanding balances</div><div class="value">${formatCurrency(Math.max(0, 1200 - total))}</div><div class="note">Demo balance estimate</div></article>
        <article class="widget"><div class="label">Membership fees</div><div class="value">${formatCurrency(sumByCategory(rows, "Membership Fee"))}</div></article>
        <article class="widget"><div class="label">Therapy fees</div><div class="value">${formatCurrency(sumByCategory(rows, "Therapy Fee"))}</div></article>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div><h3>Payment Management</h3><p>Record fees, print receipts, and review balances.</p></div>
          <button class="primary-button" data-action="new-payment">Record payment</button>
        </div>
        <div class="panel-body">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Owner</th><th>Category</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Actions</th></tr></thead>
              <tbody>
                ${rows.map(item => `
                  <tr>
                    <td>${formatDate(item.paidOn)}</td><td>${escapeHtml(item.ownerName)}</td><td>${escapeHtml(item.category)}</td><td><strong>${formatCurrency(item.amount)}</strong></td><td>${escapeHtml(item.method)}</td><td class="small-text">${escapeHtml(item.reference)}</td>
                    <td><div class="td-actions"><button class="table-button" data-action="print-receipt" data-id="${item.id}">🧾 Receipt</button><button class="danger-button" style="padding:6px 10px;font-size:0.82rem;border-radius:8px;" data-action="delete-payment" data-id="${item.id}">🗑</button></div></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderReportsModule(user) {
  return `
    <div class="layout-grid">
      <section class="panel">
        <div class="panel-header">
          <div><h3>Reports</h3><p>Export CSV, print summaries, and review system totals.</p></div>
          <div class="topbar-actions">
            <button class="ghost-button" data-action="export-csv">Export CSV</button>
            <button class="ghost-button" data-action="print-report">Print report</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="grid-2">
            <div class="card"><h4>Student reports</h4>${reportBlock(appState.data.students.length, appState.data.students.filter(item => item.active !== false).length)}</div>
            <div class="card"><h4>Patient reports</h4>${reportBlock(appState.data.patients.length, appState.data.patients.filter(item => item.active !== false).length)}</div>
            <div class="card"><h4>Attendance reports</h4>${reportBlock(appState.data.attendance.length, appState.data.attendance.filter(item => item.status === "Present").length)}</div>
            <div class="card"><h4>Payment reports</h4>${reportBlock(appState.data.payments.length, formatCurrency(appState.data.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)))}</div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderAuditModule() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div><h3>Audit Log</h3><p>Admin actions captured locally in this browser.</p></div>
      </div>
      <div class="panel-body">
        <div class="activity-log">
          ${appState.data.auditLog.slice().reverse().map(activity => feedRow(activity.title, `${activity.detail} • ${activity.actor} • ${formatDateTime(activity.at)}`, activity.level || "Action")).join("") || emptyState("No audit entries yet.")}
        </div>
      </div>
    </section>
  `;
}

function renderProfileModule(user) {
  return `
    <section class="panel">
      <div class="panel-header"><div><h3>Profile and Security</h3><p>Manage your password and session.</p></div></div>
      <div class="panel-body">
        <div class="grid-2">
          <div class="card">
            <h4>Current session</h4>
            <p>Name: ${escapeHtml(user.name)}</p>
            <p>Username: ${escapeHtml(user.username)}</p>
            <p>Role: ${escapeHtml(roleConfig[user.role].label)}</p>
            <p>Must change password: ${user.mustChangePassword ? "Yes" : "No"}</p>
          </div>
          <div class="card">
            <h4>Change password</h4>
            <form id="password-form" class="layout-grid">
              <div class="form-group"><label>Current password</label><input class="form-control" type="password" name="currentPassword" required /></div>
              <div class="form-group"><label>New password</label><input class="form-control" type="password" name="newPassword" required /></div>
              <div class="form-group"><label>Confirm new password</label><input class="form-control" type="password" name="confirmPassword" required /></div>
              <button class="primary-button" type="submit">Update password</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSettingsModule() {
  const usedKB = storageUsageKB();
  const records = appState.data.students.length + appState.data.patients.length +
    appState.data.payments.length + appState.data.attendance.length +
    appState.data.classes.length + appState.data.appointments.length;
  const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
  const lastExportText = lastExport
    ? `Last JSON backup: <strong>${formatDateTime(lastExport)}</strong>`
    : `<span class="warn-text">⚠️ No JSON backup exported yet from this browser.</span>`;
  const hasFileSync = fileSyncSupported();
  const isConnected = !!appState.fileHandle;

  return `
    <div class="layout-grid">

      <!-- ── ANY-DEVICE FILE SYNC ── -->
      <section class="panel file-sync-panel">
        <div class="panel-header">
          <div>
            <h3>🌐 Use on any device — File Sync</h3>
            <p>Connect the app to a file on your computer. Save that file in a synced folder and your data follows you everywhere.</p>
          </div>
          <div class="sync-status-badge ${isConnected ? "sync-status-on" : "sync-status-off"}">
            ${isConnected ? "● Sync ON" : "○ Sync OFF"}
          </div>
        </div>
        <div class="panel-body layout-grid">

          ${!hasFileSync ? `
            <div class="info-box warn">
              <strong>⚠️ Your browser does not support File Sync.</strong>
              <p>File Sync requires Chrome or Edge (desktop). Firefox and Safari do not support this feature. Use the JSON backup method below instead.</p>
            </div>
          ` : isConnected ? `
            <div class="info-box success-box">
              <strong>✅ File sync is active</strong>
              <p>Every save you make is written directly to <code>${escapeHtml(appState.fileName)}</code>. Open that same file on any other device to get all your data instantly.</p>
              <div class="form-actions" style="margin-top:12px;">
                <button class="danger-button" data-action="disconnect-file">⏏ Disconnect file</button>
              </div>
            </div>
          ` : `
            <div class="anydevice-steps">
              <div class="anydevice-step">
                <span class="step-num">1</span>
                <div>
                  <strong>Put the app in a shared folder</strong>
                  <p>Copy the three app files (<code>index.html</code>, <code>styles.css</code>, <code>app.js</code>) into a folder that syncs across your devices — Dropbox, Google Drive, OneDrive, or iCloud Drive all work.</p>
                </div>
              </div>
              <div class="anydevice-step">
                <span class="step-num">2</span>
                <div>
                  <strong>Create a data file in that same folder</strong>
                  <p>Click the button below. A save dialog will open — navigate to your shared folder and save <code>agam-data.json</code> there.</p>
                  <button class="primary-button" data-action="connect-file-new" style="margin-top:8px;">📁 Create data file here</button>
                </div>
              </div>
              <div class="anydevice-step">
                <span class="step-num">3</span>
                <div>
                  <strong>On any other device — open the same file</strong>
                  <p>Open <code>index.html</code> on the other device, go to <em>Backup / Storage</em>, and click the button below to connect to the same <code>agam-data.json</code> from the shared folder.</p>
                  <button class="ghost-button" data-action="connect-file-open" style="margin-top:8px;">📂 Open existing data file</button>
                </div>
              </div>
              <div class="anydevice-step">
                <span class="step-num">4</span>
                <div>
                  <strong>Done — all saves go to the file automatically</strong>
                  <p>From now on every add, edit, and delete writes directly to the file. Your cloud storage app syncs it to all connected devices in seconds.</p>
                </div>
              </div>
            </div>
          `}

        </div>
      </section>

      <!-- ── JSON BACKUP (offline fallback) ── -->
      <section class="panel">
        <div class="panel-header"><div><h3>💾 JSON Backup — manual transfer</h3><p>Use this if you can't use File Sync (Firefox, Safari, mobile).</p></div></div>
        <div class="panel-body layout-grid">
          <ol class="transfer-steps">
            <li><span class="step-num">1</span><div><strong>Export here</strong><p>Downloads <code>agam-backup-YYYY-MM-DD.json</code> to this device.</p><button class="primary-button" data-action="backup-json" style="margin-top:8px;">⬇ Export JSON backup</button></div></li>
            <li><span class="step-num">2</span><div><strong>Copy to other device</strong><p>USB drive, email, WhatsApp, Google Drive — any method works.</p></div></li>
            <li><span class="step-num">3</span><div><strong>Open app on that device and import</strong><p>Go to <em>Backup / Storage → Import</em> and choose the file.</p><button class="ghost-button" data-action="import-json" style="margin-top:8px;">⬆ Import JSON backup</button></div></li>
          </ol>
        </div>
      </section>

      <!-- ── STORAGE FACTS ── -->
      <section class="panel">
        <div class="panel-header"><div><h3>📊 Storage details</h3><p>This browser · this device</p></div></div>
        <div class="panel-body">
          <div class="storage-detail-card">
            <div class="storage-icon">💾</div>
            <div>
              <ul class="storage-facts">
                <li>Browser cache: <strong>${usedKB} KB</strong> used</li>
                <li>Total records: <strong>${records}</strong></li>
                <li>Storage key: <code>agam-management-system-v1</code></li>
                <li>File sync: <strong>${isConnected ? "Connected — " + escapeHtml(appState.fileName) : "Not connected"}</strong></li>
                <li>${lastExportText}</li>
              </ul>
              <p class="small-text" style="margin-top:10px;">⚠️ Clearing browser history or using Incognito mode erases localStorage data. File Sync or a JSON backup keeps your data safe.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── DANGER ZONE ── -->
      <section class="panel">
        <div class="panel-header"><div><h3>🗑 Danger zone</h3><p>Irreversible — use with care.</p></div></div>
        <div class="panel-body">
          <div class="card">
            <p>Restore demo data — <strong>overwrites all current records</strong> with the built-in sample dataset.</p>
            <button class="danger-button" data-action="reset-demo">↺ Restore demo data</button>
          </div>
        </div>
      </section>

    </div>
  `;
}

function bindLogin() {
  const form = document.getElementById("login-form");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    const formData = new FormData(form);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "").trim();
    const user = appState.data.users.find(item => item.username === username && item.password === password);
    if (!user) {
      toast("Invalid username or password.");
      return;
    }
    appState.session = { userId: user.id, issuedAt: new Date().toISOString() };
    appState.selectedModule = "dashboard";
    saveSession(appState.session);
    recordAudit("Login", `${user.name} signed in`, user.role, "success");
    render();
  });
}

function bindShell(user) {
  document.querySelectorAll("[data-module]").forEach(el => {
    el.addEventListener("click", () => {
      appState.selectedModule = el.dataset.module;
      appState.selectedId = null;
      appState.search = "";
      appState.filters = {};
      render();
    });
  });

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", handleAction);
  });

  document.getElementById("sidebar-overlay")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("sidebar-overlay")?.classList.remove("visible");
  });

  document.getElementById("search-input")?.addEventListener("input", event => {
    appState.search = event.target.value;
    render();
  });

  document.getElementById("status-filter")?.addEventListener("change", event => {
    appState.filters.status = event.target.value;
    render();
  });

  document.getElementById("password-form")?.addEventListener("submit", changePassword);

  document.getElementById("file-import")?.addEventListener("change", importDataFromFile);

  document.querySelectorAll("th[data-sort]").forEach(header => {
    header.addEventListener("click", () => {
      const key = header.dataset.sort;
      appState.sortDir = appState.sortKey === key && appState.sortDir === "asc" ? "desc" : "asc";
      appState.sortKey = key;
      render();
    });
  });
}

function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  const user = getCurrentUser();

  switch (action) {
    case "toggle-sidebar": {
      const sb = document.getElementById("sidebar");
      const ov = document.getElementById("sidebar-overlay");
      if (sb) sb.classList.toggle("open");
      if (ov) ov.classList.toggle("visible");
      break;
    }
    case "logout":
      clearSession();
      toast("Logged out.");
      render();
      break;
    case "toggle-theme":
      setTheme(getStoredTheme() === "dark" ? "light" : "dark");
      render();
      break;
    case "dismiss-banner": {
      const fullUser = appState.data.users.find(u => u.id === getCurrentUser()?.id);
      if (fullUser) { fullUser.mustChangePassword = false; persistData(); }
      render();
      break;
    }
    case "open-password":
      appState.selectedModule = "profile";
      render();
      break;
    case "quick-add": {
      const targetMap = { students: "students", patients: "patients", therapeutic: "students", attendance: "attendance", schedule: "classes", appointments: "appointments", payments: "payments" };
      const target = targetMap[appState.selectedModule];
      if (target) openRecordForm(target);
      else if (hasScope(user.role, "students")) openRecordForm("students");
      else if (hasScope(user.role, "patients")) openRecordForm("patients");
      else if (hasScope(user.role, "payments")) openRecordForm("payments");
      else toast("No quick-add available here.");
      break;
    }
    case "new-student": openRecordForm("students"); break;
    case "new-patient": openRecordForm("patients"); break;
    case "new-class": openRecordForm("classes"); break;
    case "new-appointment": openRecordForm("appointments"); break;
    case "new-payment": openRecordForm("payments"); break;
    case "mark-attendance": openRecordForm("attendance"); break;
    case "import-json": document.getElementById("file-import")?.click(); break;
    case "backup-json": exportJson(); break;
    case "connect-file-open": connectToFileOpen(); break;
    case "connect-file-new": connectToFileNew(); break;
    case "disconnect-file": disconnectFile(); break;
    case "reconnect-file": reconnectFile(); break;
    case "export-csv": exportCsv(); break;
    case "print-report": window.print(); break;
    case "reset-demo": resetDemoData(); break;
    case "reset-filters": appState.search = ""; appState.filters = {}; render(); break;
    case "print-receipt": printReceipt(event.currentTarget.dataset.id); break;
    default:
      if (action?.startsWith("view-") || action?.startsWith("edit-") || action?.startsWith("delete-") || action?.startsWith("new-")) {
        handleRecordAction(action, event.currentTarget.dataset.id);
      }
      break;
  }
}

function handleRecordAction(action, id) {
  const type = action.replace(/^(view|edit|delete)-/, "");
  const collectionType = normalizeCollectionType(type);

  if (action.startsWith("view-")) {
    appState.selectedId = id;
    render();
    return;
  }

  if (action.startsWith("delete-")) {
    if (!confirm("Delete this record?")) return;
    deleteRecord(collectionType, id);
    return;
  }

  if (action.startsWith("edit-")) {
    openRecordForm(collectionType, id);
    return;
  }
}

function openRecordForm(type, id = null) {
  const item = id ? getCollection(type).find(record => record.id === id) : null;
  const fields = getFormFields(type, item);
  const title = item ? `Edit ${singular(type)}` : `Add ${singular(type)}`;

  showModal(`
    <div class="modal-backdrop">
      <div class="modal">
        <div class="panel-header">
          <div><h3>${title}</h3><p>All data is stored locally in this browser.</p></div>
          <button class="ghost-button" data-close-modal>Close</button>
        </div>
        <div class="panel-body">
          <form id="record-form" class="layout-grid">
            <input type="hidden" name="type" value="${type}" />
            <input type="hidden" name="id" value="${item?.id || ""}" />
            <div class="form-grid">${fields.map(field => formControl(field, item?.[field.name] || "")).join("")}</div>
            <div class="form-actions">
              <button class="primary-button" type="submit">Save</button>
              <button class="ghost-button" type="button" data-close-modal>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);

  const form = document.getElementById("record-form");
  if (form) {
    const dateFields = form.querySelectorAll('input[type="date"]');
    dateFields.forEach(f => { if (!f.value) f.value = todayISO(); });
  }
  document.getElementById("record-form")?.addEventListener("submit", saveRecord);
  document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeModal));
}

function saveRecord(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const type = data.type;
  const id = data.id || cryptoId();
  const collection = getCollection(type);
  const next = buildRecord(type, data, id);
  const index = collection.findIndex(record => record.id === id);
  if (index >= 0) collection[index] = { ...collection[index], ...next };
  else collection.unshift(next);
  persistData();
  const label = next.fullName || next.name || next.patientName || id;
  recordAudit(index >= 0 ? "Update" : "Create", `${singular(type)} ${label}`, type, "success");
  closeModal();
  toast(index >= 0 ? `✅ ${label} updated successfully.` : `✅ ${label} added successfully.`);
  render();
}

function deleteRecord(type, id) {
  const collection = getCollection(type);
  const index = collection.findIndex(item => item.id === id);
  if (index === -1) return;
  const deleted = collection.splice(index, 1)[0];
  persistData();
  const deletedLabel = deleted.fullName || deleted.name || id;
  recordAudit("Delete", `${singular(type)} ${deletedLabel}`, type, "danger");
  toast(`🗑 ${deletedLabel} deleted.`);
  render();
}

function buildRecord(type, data, id) {
  const base = { id, active: data.active !== "false" };
  switch (type) {
    case "students":
      return {
        ...base,
        fullName: data.fullName,
        studentId: data.studentId,
        photo: data.photo,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        address: data.address,
        emergencyContact: data.emergencyContact,
        martialArtsStyle: data.martialArtsStyle,
        beltRank: data.beltRank,
        joinDate: data.joinDate,
        notes: data.notes,
        takingTreatment: data.takingTreatment === "on",
        treatmentPlan: data.treatmentPlan,
        therapyNotes: data.therapyNotes,
        active: data.active !== "false",
      };
    case "patients":
      return {
        ...base,
        fullName: data.fullName,
        patientId: data.patientId,
        contact: data.contact,
        treatmentPlan: data.treatmentPlan,
        medicalHistory: data.medicalHistory,
        medicalNotes: data.medicalNotes,
        progressNotes: data.progressNotes,
        visitHistory: data.visitHistory,
        active: data.active !== "false",
      };
    case "classes":
      return {
        ...base,
        name: data.name,
        style: data.style,
        instructor: data.instructor,
        day: data.day,
        time: data.time,
        capacity: Number(data.capacity || 0),
        studentIds: data.studentIds ? data.studentIds.split(",").map(value => value.trim()).filter(Boolean) : [],
      };
    case "appointments":
      return {
        ...base,
        patientName: data.patientName,
        date: data.date,
        time: data.time,
        purpose: data.purpose,
        notes: data.notes,
        reminder: data.reminder === "on",
      };
    case "payments":
      return {
        ...base,
        ownerType: data.ownerType,
        ownerName: data.ownerName,
        category: data.category,
        amount: Number(data.amount || 0),
        paidOn: data.paidOn,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
      };
    case "attendance":
      return {
        ...base,
        personType: data.personType,
        personName: data.personName,
        date: data.date,
        className: data.className,
        status: data.status,
      };
    default:
      return base;
  }
}

function getFormFields(type) {
  const common = [
    { name: "active", label: "Status", type: "select", options: ["true", "false"], optionLabels: ["Active", "Inactive"] },
  ];
  const fields = {
    students: [
      { name: "fullName", label: "Full name", required: true },
      { name: "studentId", label: "Student ID" },
      { name: "dateOfBirth", label: "Date of birth", type: "date" },
      { name: "gender", label: "Gender", type: "select", options: ["", "Male", "Female", "Other"], optionLabels: ["Select…", "Male", "Female", "Other"] },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Address" },
      { name: "emergencyContact", label: "Emergency contact" },
      { name: "martialArtsStyle", label: "Martial arts style", type: "select", options: ["", "Karate", "Taekwondo", "Kickboxing", "Judo", "BJJ", "Yoga", "Mixed"], optionLabels: ["Select…", "Karate", "Taekwondo", "Kickboxing", "Judo", "BJJ", "Yoga", "Mixed"] },
      { name: "beltRank", label: "Belt rank", type: "select", options: ["", "White", "Yellow", "Orange", "Green", "Blue", "Purple", "Brown", "Red", "Black"], optionLabels: ["Select…", "White", "Yellow", "Orange", "Green", "Blue", "Purple", "Brown", "Red", "Black"] },
      { name: "takingTreatment", label: "Special student under treatment", type: "checkbox" },
      { name: "treatmentPlan", label: "Treatment plan", type: "textarea" },
      { name: "therapyNotes", label: "Therapy notes", type: "textarea" },
      { name: "joinDate", label: "Join date", type: "date" },
      { name: "photo", label: "Photo URL" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    patients: [
      { name: "fullName", label: "Full name", required: true },
      { name: "patientId", label: "Patient ID" },
      { name: "contact", label: "Contact information", type: "tel" },
      { name: "treatmentPlan", label: "Treatment plan" },
      { name: "medicalHistory", label: "Medical history", type: "textarea" },
      { name: "medicalNotes", label: "Medical notes", type: "textarea" },
      { name: "progressNotes", label: "Progress notes", type: "textarea" },
      { name: "visitHistory", label: "Visit history", type: "textarea" },
    ],
    classes: [
      { name: "name", label: "Class name", required: true },
      { name: "style", label: "Style", type: "select", options: ["", "Karate", "Taekwondo", "Kickboxing", "Judo", "BJJ", "Yoga", "Mixed"], optionLabels: ["Select…", "Karate", "Taekwondo", "Kickboxing", "Judo", "BJJ", "Yoga", "Mixed"] },
      { name: "instructor", label: "Instructor" },
      { name: "day", label: "Day", type: "select", options: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], optionLabels: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
      { name: "time", label: "Time", type: "time" },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "studentIds", label: "Student IDs (comma-separated)" },
    ],
    appointments: [
      { name: "patientName", label: "Patient name", required: true },
      { name: "date", label: "Date", type: "date" },
      { name: "time", label: "Time", type: "time" },
      { name: "purpose", label: "Purpose" },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "reminder", label: "Enable reminder", type: "checkbox" },
    ],
    payments: [
      { name: "ownerName", label: "Person name", required: true },
      { name: "ownerType", label: "Person type", type: "select", options: ["student", "patient"], optionLabels: ["Student", "Patient"] },
      { name: "category", label: "Fee category", type: "select", options: ["", "Membership Fee", "Therapy Fee", "Registration Fee", "Grading Fee", "Other"], optionLabels: ["Select…", "Membership Fee", "Therapy Fee", "Registration Fee", "Grading Fee", "Other"] },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "paidOn", label: "Payment date", type: "date" },
      { name: "method", label: "Payment method", type: "select", options: ["Cash", "Card", "Bank Transfer", "Cheque", "Other"], optionLabels: ["Cash", "Card", "Bank Transfer", "Cheque", "Other"] },
      { name: "reference", label: "Receipt reference" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    attendance: [
      { name: "personName", label: "Person name", required: true },
      { name: "personType", label: "Person type", type: "select", options: ["student", "patient"], optionLabels: ["Student", "Patient"] },
      { name: "className", label: "Class name" },
      { name: "date", label: "Date", type: "date" },
      { name: "status", label: "Attendance status", type: "select", options: ["Present", "Absent", "Late", "Excused"], optionLabels: ["Present", "Absent", "Late", "Excused"] },
    ],
  };
  return [...(fields[type] || []), ...common];
}

function formControl(field, value) {
  const req = field.required ? " <span class='req'>*</span>" : "";
  if (field.type === "textarea") {
    return `<div class="form-group"><label>${field.label}${req}</label><textarea class="form-control" name="${field.name}" rows="3">${escapeHtml(value)}</textarea></div>`;
  }
  if (field.type === "select") {
    const labels = field.optionLabels || field.options;
    return `<div class="form-group"><label>${field.label}${req}</label><select class="form-control" name="${field.name}">${field.options.map((option, i) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(labels[i] || option)}</option>`).join("")}</select></div>`;
  }
  if (field.type === "checkbox") {
    return `<div class="form-group form-group-check"><label><input type="checkbox" name="${field.name}" ${value ? "checked" : ""} /> ${field.label}</label></div>`;
  }
  return `<div class="form-group"><label>${field.label}${req}</label><input class="form-control" name="${field.name}" type="${field.type || "text"}" value="${escapeHtml(value)}" ${field.required ? "required" : ""} /></div>`;
}

function changePassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const user = getCurrentUser();
  const fullUser = appState.data.users.find(item => item.id === user.id);

  if (fullUser.password !== currentPassword) return toast("Current password is incorrect.");
  if (newPassword.length < 8) return toast("Password must be at least 8 characters.");
  if (newPassword !== confirmPassword) return toast("Passwords do not match.");

  fullUser.password = newPassword;
  fullUser.mustChangePassword = false;
  persistData();
  recordAudit("Password changed", `${fullUser.name} updated their password`, fullUser.role, "success");
  toast("Password updated.");
  render();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(appState.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agam-backup-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
  recordAudit("Export", "Full JSON backup exported", "settings", "success");
  toast("✅ Backup downloaded. Copy this file to transfer data to another device.");
}

function exportCsv() {
  const rows = [
    ["Type", "Name", "Amount/Status", "Date"],
    ...appState.data.students.map(item => ["Student", item.fullName, item.beltRank, item.joinDate]),
    ...appState.data.patients.map(item => ["Patient", item.fullName, item.treatmentPlan, item.patientId]),
    ...appState.data.payments.map(item => ["Payment", item.ownerName, String(item.amount), item.paidOn]),
  ];
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agam-report-${todayISO()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  recordAudit("Export", "CSV report exported", "reports", "success");
  toast("CSV exported.");
}

function printReceipt(id) {
  const payment = appState.data.payments.find(item => item.id === id);
  if (!payment) return;
  const receipt = window.open("", "_blank", "width=800,height=700");
  receipt.document.write(`
    <html><head><title>Receipt</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{margin:0 0 8px}.box{border:1px solid #ddd;padding:18px;border-radius:12px}</style></head>
    <body><h1>Payment Receipt</h1><div class="box"><p><strong>Receipt:</strong> ${escapeHtml(payment.reference)}</p><p><strong>Name:</strong> ${escapeHtml(payment.ownerName)}</p><p><strong>Category:</strong> ${escapeHtml(payment.category)}</p><p><strong>Amount:</strong> ${formatCurrency(payment.amount)}</p><p><strong>Date:</strong> ${escapeHtml(payment.paidOn)}</p></div></body></html>
  `);
  receipt.document.close();
  receipt.focus();
  receipt.print();
  recordAudit("Print", `Receipt ${payment.reference} printed`, "payments", "success");
}

function importDataFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = JSON.parse(String(reader.result || "{}"));
      appState.data = sanitizeImport(next);
      persistData();
      recordAudit("Import", "Backup imported", "settings", "success");
      toast("✅ Backup restored successfully. All records are now loaded.");
      render();
    } catch (error) {
      toast("❌ Import failed. The file is not a valid AGAM backup.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function resetDemoData() {
  if (!confirm("Restore demo data? This will overwrite current local data.")) return;
  appState.data = structuredClone(demoData);
  persistData();
  toast("Demo data restored.");
  render();
}

function sanitizeImport(next) {
  const clean = structuredClone(demoData);
  Object.keys(clean).forEach(key => {
    if (Array.isArray(clean[key]) && Array.isArray(next[key])) clean[key] = next[key];
  });
  return clean;
}

function renderMonthlyReport(items) {
  const months = new Map();
  items.forEach(item => {
    const date = item.date || item.paidOn || item.joinDate || item.at;
    if (!date) return;
    const month = date.slice(0, 7);
    months.set(month, (months.get(month) || 0) + 1);
  });
  return Array.from(months.entries()).sort().map(([month, count]) => `<p>${escapeHtml(month)}: ${count} records</p>`).join("") || emptyState("No monthly activity yet.");
}

function recordAudit(title, detail, level = "general", badge = "neutral") {
  const user = getCurrentUser();
  appState.data.auditLog.push({ id: cryptoId(), title, detail, actor: user?.name || "System", level, at: new Date().toISOString(), badge });
  persistData();
}

function getVisibleModules(role) {
  const d = appState.data;
  const modules = [
    { id: "dashboard", title: "Dashboard", icon: "🏠" },
    { id: "students", title: "Students", icon: "🥋", count: d.students.length },
    { id: "patients", title: "Patients", icon: "🏥", count: d.patients.length },
    { id: "therapeutic", title: "Therapeutic", icon: "🧘", count: d.patients.length + d.students.filter(s => s.takingTreatment).length },
    { id: "attendance", title: "Attendance", icon: "✅", count: d.attendance.filter(a => a.date === todayISO()).length },
    { id: "schedule", title: "Classes", icon: "📅", count: d.classes.length },
    { id: "appointments", title: "Appointments", icon: "🗓", count: d.appointments.filter(a => a.date >= todayISO()).length },
    { id: "payments", title: "Payments", icon: "💰", count: d.payments.length },
    { id: "reports", title: "Reports", icon: "📊" },
    { id: "audit", title: "Audit log", icon: "🔍", count: d.auditLog.length },
    { id: "profile", title: "Profile", icon: "👤" },
    { id: "settings", title: "Backup / Storage", icon: "💾" },
  ];
  const scopes = roleConfig[role].scopes;
  return modules.filter(module => module.id === "dashboard" || module.id === "profile" || module.id === "settings" || module.id === "audit" || hasScope(role, module.id) || scopes.includes(module.id));
}

function hasScope(role, scope) {
  return roleConfig[role].scopes.includes(scope);
}

function getCollection(type) {
  return appState.data[type] || [];
}

function normalizeCollectionType(type) {
  if (type === "student") return "students";
  if (type === "patient") return "patients";
  if (type === "class") return "classes";
  if (type === "appointment") return "appointments";
  if (type === "payment") return "payments";
  if (type === "attendance") return "attendance";
  return type.endsWith("s") ? type : `${type}s`;
}

function filterList(items, search) {
  const query = search.trim().toLowerCase();
  return items.filter(item => {
    const text = JSON.stringify(item).toLowerCase();
    const matchesSearch = !query || text.includes(query);
    const matchesStatus = !appState.filters.status || (appState.filters.status === "active" ? item.active !== false : item.active === false);
    return matchesSearch && matchesStatus;
  });
}

function sortList(items, key, dir) {
  const factor = dir === "asc" ? 1 : -1;
  return items.slice().sort((a, b) => String(a?.[key] ?? "").localeCompare(String(b?.[key] ?? "")) * factor);
}

function moduleTitle(moduleId) {
  return ({ dashboard: "Dashboard", students: "Students", patients: "Patients", therapeutic: "Therapeutic", attendance: "Attendance", schedule: "Classes", appointments: "Appointments", payments: "Payments", reports: "Reports", audit: "Audit Log", profile: "Profile", settings: "Data Backup" })[moduleId] || "Dashboard";
}

function moduleSubtitle(moduleId) {
  return ({ dashboard: "Overview of operations and activity.", students: "Manage student lifecycle, records, and progress.", patients: "Track therapy clients, notes, and care plans.", therapeutic: "Patients and special students taking treatment along with classes.", attendance: "Daily attendance tracking and monthly reports.", schedule: "Create, edit, and inspect class schedules.", appointments: "Patient appointment calendar and history.", payments: "Payments, fees, balances, and receipts.", reports: "Print and export operational summaries.", audit: "Administrative actions and change history.", profile: "Password changes and current session details.", settings: "Export, import, and restore local data." })[moduleId] || "Overview.";
}

function showModal(content) {
  closeModal();
  const holder = document.createElement("div");
  holder.id = "modal-root";
  holder.innerHTML = content;
  document.body.appendChild(holder);
  holder.addEventListener("click", event => {
    if (event.target.classList.contains("modal-backdrop")) closeModal();
  });
  // Escape key closes modal
  const onKey = e => { if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);
}

function closeModal() {
  document.getElementById("modal-root")?.remove();
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  appState.session = null;
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = structuredClone(demoData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    return sanitizeImport(parsed);
  } catch {
    const initial = structuredClone(demoData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function persistData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.data));
  if (appState.fileHandle) writeToFileHandle(appState.fileHandle, appState.data);
}

function getCurrentUser() {
  return appState.data.users.find(user => user.id === appState.session?.userId) || null;
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function toast(message) {
  const existing = document.querySelector(".toast");
  existing?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function emptyState(message, actionLabel = "") {
  if (actionLabel) {
    const actionMap = {
      "Add Student": "new-student", "Add Patient": "new-patient",
      "Create Class": "new-class", "New Appointment": "new-appointment",
      "Record Payment": "new-payment", "Mark Attendance": "mark-attendance",
    };
    const action = actionMap[actionLabel];
    return `<div class="empty-state"><div class="empty-icon">📭</div><p>${escapeHtml(message)}</p>${action ? `<button class="quick-action-btn" data-action="${action}" style="margin:8px auto 0;">+ ${escapeHtml(actionLabel)}</button>` : `<p class="small-text">${escapeHtml(actionLabel)}</p>`}</div>`;
  }
  return `<div class="empty-state"><div class="empty-icon">📭</div><p>${escapeHtml(message)}</p></div>`;
}

function feedRow(title, detail, label) {
  return `<div class="feed-item"><div><p><strong>${escapeHtml(title)}</strong></p><span>${escapeHtml(detail)}</span></div><div class="badge neutral">${escapeHtml(label)}</div></div>`;
}

function statusBadge(text, tone = "neutral") {
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

function reportBlock(total, active) {
  return `<p>Total: ${escapeHtml(String(total))}</p><p>Secondary metric: ${escapeHtml(String(active))}</p><p class="small-text">Export or print from the Reports tab.</p>`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso + "T00:00:00"));
}

function relativeDate(iso) {
  if (!iso) return "";
  const today = todayISO();
  const tomorrow = new Date(new Date().getTime() + 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  return formatDate(iso);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function dayMatchesToday(day) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] === day;
}

function buildMiniCalendar(rows) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => `<div class="calendar-cell"><strong>${day}</strong>${rows.filter(item => item.date?.includes(day.toLowerCase())).map(item => `<div class="small-text">${escapeHtml(item.patientName || item.name || "Item")}</div>`).join("") || `<span class="small-text">No items</span>`}</div>`).join("");
}

function sumByCategory(items, category) {
  return items.filter(item => item.category === category).reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function singular(type) {
  return type.endsWith("s") ? type.slice(0, -1) : type;
}

function placeholderAvatar(name) {
  const initials = name.split(" ").map(part => part[0]).slice(0, 2).join("");
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" rx="60" fill="#c84000"/><text x="50%" y="54%" text-anchor="middle" font-family="Arial" font-size="40" fill="#fff4e8" font-weight="700">${initials}</text></svg>`)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cryptoId() {
  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function moduleQuickAddLabel(moduleId) {
  return ({ students: "+ Add Student", patients: "+ Add Patient", therapeutic: "+ Add Special Student", attendance: "+ Mark Attendance", schedule: "+ Create Class", appointments: "+ New Appointment", payments: "+ Record Payment" })[moduleId] || "";
}

function storageUsageKB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "";
    return (new Blob([raw]).size / 1024).toFixed(1);
  } catch { return "?"; }
}

function lastExportAgo() {
  const ts = localStorage.getItem(LAST_EXPORT_KEY);
  if (!ts) return null;
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── File System Access API ────────────────────────────────────────────────────

const FILE_PICKER_OPTS = {
  types: [{ description: "AGAM Data File", accept: { "application/json": [".json"] } }],
  excludeAcceptAllOption: false,
};

function fileSyncSupported() {
  return typeof window.showOpenFilePicker === "function";
}

async function writeToFileHandle(handle, data) {
  try {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch (err) {
    if (err.name !== "AbortError") console.warn("File write failed:", err);
  }
}

async function activateFileHandle(handle, readFromFile) {
  appState.fileHandle = handle;
  appState.fileName = handle.name;
  appState.filePendingReconnect = false;
  await idbStoreHandle(handle);
  if (readFromFile) {
    try {
      const file = await handle.getFile();
      const text = await file.text();
      const imported = JSON.parse(text);
      if (imported && typeof imported === "object") {
        appState.data = sanitizeImport(imported);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.data));
      }
    } catch { /* file may be new/empty, keep current data */ }
  } else {
    // Write current data into the new file
    await writeToFileHandle(handle, appState.data);
  }
  render();
  toast(`📁 Connected to "${handle.name}" — every save now writes to this file.`);
}

async function connectToFileOpen() {
  if (!fileSyncSupported()) { toast("❌ File sync needs Chrome or Edge browser."); return; }
  try {
    const [handle] = await window.showOpenFilePicker({ ...FILE_PICKER_OPTS, multiple: false });
    await activateFileHandle(handle, true);
  } catch (e) {
    if (e.name !== "AbortError") toast("❌ Could not open file: " + e.message);
  }
}

async function connectToFileNew() {
  if (!fileSyncSupported()) { toast("❌ File sync needs Chrome or Edge browser."); return; }
  try {
    const handle = await window.showSaveFilePicker({ ...FILE_PICKER_OPTS, suggestedName: "agam-data.json" });
    await activateFileHandle(handle, false);
  } catch (e) {
    if (e.name !== "AbortError") toast("❌ Could not create file: " + e.message);
  }
}

async function disconnectFile() {
  if (!confirm("Disconnect the data file? The app will go back to browser-only storage.")) return;
  appState.fileHandle = null;
  appState.fileName = null;
  appState.filePendingReconnect = false;
  await idbClearHandle();
  render();
  toast("📂 File disconnected. Data is still saved in this browser.");
}

async function reconnectFile() {
  const handle = await idbLoadHandle();
  if (!handle) return;
  try {
    const perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm === "granted") {
      await activateFileHandle(handle, true);
    } else {
      toast("❌ Permission denied. Grant access when the browser asks.");
    }
  } catch { toast("❌ Could not reconnect to the file."); }
}

async function tryReconnectFile() {
  if (!fileSyncSupported()) return;
  const handle = await idbLoadHandle();
  if (!handle) return;
  try {
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") {
      await activateFileHandle(handle, true);
    } else {
      appState.filePendingReconnect = true;
      appState.fileName = handle.name;
      render();
    }
  } catch {
    await idbClearHandle();
  }
}

// ─── IndexedDB handle persistence ─────────────────────────────────────────────

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("agam-handles-v1", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbStoreHandle(handle) {
  try {
    const db = await openHandleDB();
    await new Promise((res, rej) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "main");
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* IndexedDB unavailable */ }
}

async function idbLoadHandle() {
  try {
    const db = await openHandleDB();
    return new Promise((res, rej) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("main");
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch { return null; }
}

async function idbClearHandle() {
  try {
    const db = await openHandleDB();
    await new Promise(res => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").delete("main");
      tx.oncomplete = res;
    });
  } catch { /* ignore */ }
}

function sampleStudent(studentId, fullName, gender, style, beltRank, active, takingTreatment = false, treatmentPlan = "") {
  return {
    id: cryptoId(),
    fullName,
    studentId,
    photo: "",
    dateOfBirth: "2000-01-01",
    gender,
    phone: "+1 555 000 1000",
    email: `${fullName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    address: "Demo address",
    emergencyContact: "Parent / Guardian",
    martialArtsStyle: style,
    beltRank,
    joinDate: todayISO(),
    notes: "Demo student record",
    takingTreatment,
    treatmentPlan,
    therapyNotes: takingTreatment ? "Therapy-integrated class plan started." : "",
    active,
  };
}

function samplePatient(patientId, fullName, treatmentPlan) {
  return {
    id: cryptoId(),
    fullName,
    patientId,
    contact: "+1 555 000 2000",
    treatmentPlan,
    medicalHistory: "Demo medical history",
    medicalNotes: "Demo medical notes",
    progressNotes: "Improving steadily",
    visitHistory: "Initial assessment completed",
    active: true,
  };
}
