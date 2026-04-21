// ============================================================
// admin.js — Admin Dashboard Logic
// FinVest Pro
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  if (!requireAdmin()) return;

  const token = getStoredToken();
  await loadAdminStats(token);
  await loadRecentUsers(token);
  await loadRecentPayments(token);
});

// --- Load Summary Stats ---
async function loadAdminStats(token) {
  try {
    const stats = await API.admin.getStats(token);
    const el = document.getElementById("admin-stats");
    if (!el || !stats) return;

    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Users</div>
        <div class="stat-value">${formatNumber(stats.total_users || 0)}</div>
        <div class="stat-change" style="color:var(--accent-green);">+${stats.new_users_today || 0} today</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Subscriptions</div>
        <div class="stat-value">${formatNumber(stats.active_subs || 0)}</div>
        <div class="stat-change" style="color:var(--text-muted);">${stats.churn_rate || 0}% churn</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Revenue (MRR)</div>
        <div class="stat-value">${formatCurrency(stats.mrr || 0)}</div>
        <div class="stat-change" style="color:var(--accent-green);">↑ ${stats.mrr_growth || 0}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Payments Today</div>
        <div class="stat-value">${formatNumber(stats.payments_today || 0)}</div>
        <div class="stat-change" style="color:var(--gold);">${formatCurrency(stats.revenue_today || 0)}</div>
      </div>
    `;
  } catch (err) {
    console.error("Failed to load admin stats:", err);
  }
}

// --- Load Recent Users Table ---
async function loadRecentUsers(token) {
  const container = document.getElementById("users-table-body");
  if (!container) return;

  try {
    const res = await API.admin.getUsers({ limit: 10, sort: "created_at", order: "desc" }, token);
    const users = res?.users || [];

    if (!users.length) {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">No users yet</td></tr>`;
      return;
    }

    container.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="font-weight:500;">${escapeHtml(u.name || "—")}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml(u.email)}</div>
        </td>
        <td>
          <span class="badge ${getPlanBadgeClass(u.plan)}">${u.plan || "free"}</span>
        </td>
        <td>
          <span class="badge ${u.is_active ? 'badge-green' : 'badge-red'}">${u.is_active ? 'Active' : 'Inactive'}</span>
        </td>
        <td style="color:var(--text-secondary);font-size:0.85rem;">${formatDate(u.created_at)}</td>
        <td style="font-family:var(--font-mono);font-size:0.85rem;">${u.plan_expiry ? formatDate(u.plan_expiry) : '—'}</td>
        <td>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost btn-sm" onclick="viewUser('${u.uid}')">View</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteUser('${u.uid}', '${escapeHtml(u.email)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--accent-red);padding:32px;">Failed to load users</td></tr>`;
  }
}

// --- Load Recent Payments ---
async function loadRecentPayments(token) {
  const container = document.getElementById("payments-table-body");
  if (!container) return;

  try {
    const res = await API.admin.getPayments({ limit: 10, sort: "date", order: "desc" }, token);
    const payments = res?.payments || [];

    if (!payments.length) {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">No payments yet</td></tr>`;
      return;
    }

    container.innerHTML = payments.map(p => `
      <tr>
        <td style="font-family:var(--font-mono);font-size:0.82rem;color:var(--text-muted);">${p.order_id}</td>
        <td>${escapeHtml(p.user_email)}</td>
        <td><span class="badge ${getPlanBadgeClass(p.plan)}">${p.plan}</span></td>
        <td style="font-weight:600;font-family:var(--font-mono);">${formatCurrency(p.amount)}</td>
        <td>
          <span class="badge ${p.status === 'SUCCESS' ? 'badge-green' : p.status === 'FAILED' ? 'badge-red' : 'badge-blue'}">
            ${p.status}
          </span>
        </td>
        <td style="color:var(--text-secondary);font-size:0.85rem;">${formatDate(p.date)}</td>
      </tr>
    `).join("");
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--accent-red);padding:32px;">Failed to load payments</td></tr>`;
  }
}

// --- User Actions ---
async function viewUser(uid) {
  window.location.href = `/admin/users.html?uid=${uid}`;
}

function confirmDeleteUser(uid, email) {
  if (!confirm(`Delete user: ${email}?\n\nThis will cancel their subscription and remove all data.`)) return;
  deleteUser(uid);
}

async function deleteUser(uid) {
  const token = getStoredToken();
  try {
    await API.admin.deleteUser(uid, token);
    showToast("User deleted", "success");
    await loadRecentUsers(token);
  } catch (err) {
    showToast("Failed to delete user: " + err.message, "error");
  }
}

// --- Plan Management ---
async function loadPlans() {
  const token = getStoredToken();
  const container = document.getElementById("plans-container");
  if (!container) return;

  try {
    const plans = await API.admin.getPlans(token);
    // Render plan cards with edit functionality
    container.innerHTML = (plans || []).map(plan => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px;">
          <div>
            <h3>${escapeHtml(plan.name)}</h3>
            <div style="font-family:var(--font-mono);font-size:1.4rem;color:var(--gold);margin-top:4px;">
              ${formatCurrency(plan.price)}<span style="font-size:0.8rem;color:var(--text-muted);">/mo</span>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="editPlan('${plan.id}')">Edit</button>
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary);">${escapeHtml(plan.description || '')}</div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="badge badge-blue">${plan.active_subscribers || 0} active</span>
          <span class="badge badge-green">${plan.is_active ? 'Published' : 'Draft'}</span>
        </div>
      </div>
    `).join("");
  } catch (err) {
    showToast("Failed to load plans", "error");
  }
}

// --- Search Users ---
function setupUserSearch() {
  const searchInput = document.getElementById("user-search");
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const query = e.target.value.trim();
      const token = getStoredToken();
      const container = document.getElementById("users-table-body");
      if (!container) return;

      try {
        const res = await API.admin.getUsers({ search: query, limit: 20 }, token);
        const users = res?.users || [];
        if (!users.length) {
          container.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">No users found</td></tr>`;
          return;
        }
        // Re-render table with search results
        await loadRecentUsers(token);
      } catch (err) {
        showToast("Search failed", "error");
      }
    }, 400);
  });
}

