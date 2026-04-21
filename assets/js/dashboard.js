// ============================================================
// dashboard.js — Dashboard Logic & Plan-Based UI Control
// FinVest Pro
// Requires: api.js loaded first
// ============================================================

// ── Engine definitions ─────────────────────────────────────
const ENGINES = [
  { id:"risk-profile",   name:"Risk Profiler",       icon:"📊", color:"#C9A84C", bg:"rgba(201,168,76,0.1)",  desc:"Discover your investment risk tolerance with our science-backed questionnaire.",     url:"../engines/risk-profile.html",   plans:["free","basic","pro","elite"] },
  { id:"news",           name:"Market News",          icon:"📰", color:"#06B6D4", bg:"rgba(6,182,212,0.1)",   desc:"AI-curated financial news from 50+ Indian and global sources. Signal, no noise.",  url:"../engines/news.html",           plans:["free","basic","pro","elite"] },
  { id:"goal-planner",   name:"Goal Planner",         icon:"🎯", color:"#22C55E", bg:"rgba(34,197,94,0.1)",   desc:"Map out financial goals with precise SIP calculations and timelines.",              url:"../engines/goal-planner.html",   plans:["basic","pro","elite"] },
  { id:"retirement",     name:"Retirement Planner",   icon:"🏖️", color:"#A78BFA", bg:"rgba(167,139,250,0.1)",desc:"Calculate your corpus and monthly SIP needed to retire on your terms.",            url:"../engines/retirement.html",     plans:["basic","pro","elite"] },
  { id:"stock-analysis", name:"Stock Analysis",       icon:"📈", color:"#F59E0B", bg:"rgba(245,158,11,0.1)",  desc:"Deep fundamental + technical analysis for all NSE/BSE listed stocks.",              url:"../engines/stock-analysis.html", plans:["pro","elite"] },
  { id:"portfolio",      name:"Portfolio Optimizer",  icon:"💼", color:"#EC4899", bg:"rgba(236,72,153,0.1)",  desc:"Build a diversified portfolio using Modern Portfolio Theory.",                     url:"../engines/portfolio.html",      plans:["pro","elite"] },
  { id:"global-events",  name:"Global Events Tracker",icon:"🌐", color:"#3B82F6", bg:"rgba(59,130,246,0.1)",  desc:"Track macro events and understand their direct impact on your investments.",       url:"../engines/global-events.html",  plans:["pro","elite"] }
];

// ── On page load ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;     // from api.js — safe, no Firebase needed
  renderUserInfo();
  renderPlanBanner();
  renderEngineCards();
  setupSidebarLinks();
  await loadDashboardData();      // loads from backend, then refreshes UI
  loadDashboardStats();
});

// ── Load plan data from backend ────────────────────────────
async function loadDashboardData() {
  const token = getStoredToken();
  try {
    const [profile, planData] = await Promise.allSettled([
      API.getProfile(token),
      API.getPlan(token)
    ]);
    if (profile.status === "fulfilled" && profile.value) {
      const p = profile.value;
      sessionStorage.setItem("user_name",  p.name  || p.email || "");
      sessionStorage.setItem("user_email", p.email || "");
      sessionStorage.setItem("user_photo", p.photo || "");
      sessionStorage.setItem("is_admin",   p.is_admin ? "true" : "false");
    }
    if (planData.status === "fulfilled" && planData.value) {
      const d = planData.value;
      sessionStorage.setItem("plan",        d.plan_id    || "free");
      sessionStorage.setItem("plan_expiry", d.expiry_date || "");
      sessionStorage.setItem("plan_name",   d.plan_name  || "Free");
    }
    // Re-render with fresh data
    renderUserInfo();
    renderPlanBanner();
    renderEngineCards();
  } catch (err) {
    console.warn("Backend unavailable, using session data:", err.message);
  }
}

// ── Render user name/email/photo everywhere ────────────────
function renderUserInfo() {
  const { name, email, photo, plan } = getUserInfo();  // from api.js

  document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = name);
  document.querySelectorAll("[data-user-email]").forEach(el => el.textContent = email);
  document.querySelectorAll("[data-user-plan]").forEach(el => {
    el.textContent = (plan || "free").charAt(0).toUpperCase() + (plan || "free").slice(1);
  });
  document.querySelectorAll("[data-user-photo]").forEach(el => {
    if (photo) {
      el.src = photo;
      el.style.display = "block";
    } else {
      el.style.display = "none";
      // Insert initials avatar if not already there
      const parent = el.parentElement;
      if (parent && !parent.querySelector(".avatar-initials")) {
        const div = document.createElement("div");
        div.className = "avatar-initials";
        div.textContent = (name || "U")[0].toUpperCase();
        div.style.cssText = "width:36px;height:36px;border-radius:50%;background:var(--gold-dim);border:1px solid var(--border-gold);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--gold);font-size:0.9rem;";
        parent.appendChild(div);
      }
    }
  });
}

// ── Render engine cards ────────────────────────────────────
function renderEngineCards() {
  const container = document.getElementById("engine-cards");
  if (!container) return;

  const plan      = sessionStorage.getItem("plan") || "free";
  const isExpired = checkPlanExpiry();   // from api.js

  container.innerHTML = ENGINES.map(e => {
    const access   = !isExpired && e.plans.includes(plan);
    const minPlan  = e.plans[0];
    const minLabel = minPlan.charAt(0).toUpperCase() + minPlan.slice(1);
    return `
      <a href="${access ? e.url : '#'}"
         class="engine-card ${access ? 'active' : 'locked'}"
         ${!access ? `onclick="handleLockedEngine('${e.id}','${minLabel}');return false;"` : ""}
         title="${e.name}">
        <div class="engine-icon" style="background:${e.bg};border-color:${e.color}33;">${e.icon}</div>
        <div class="engine-name">${e.name}</div>
        <div class="engine-desc">${e.desc}</div>
        <div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;">
          <span class="badge ${access ? 'badge-green' : 'badge-lock'}">
            ${access ? '● Active' : '🔒 ' + minLabel + '+'}
          </span>
          ${access ? '<span style="color:var(--text-muted);font-size:0.8rem;">Open →</span>' : ""}
        </div>
      </a>`;
  }).join("");
}

// ── Handle locked engine click ─────────────────────────────
function handleLockedEngine(engineId, requiredPlan) {
  const modal = document.getElementById("upgrade-modal");
  if (modal) {
    const el = document.getElementById("required-plan-name");
    if (el) el.textContent = requiredPlan;
    modal.classList.add("active");
  } else {
    window.location.href = "/pricing.html?engine=" + engineId;
  }
  showToast(`Upgrade to ${requiredPlan}+ to unlock this engine`, "warning");
}

// ── Plan expiry banner ─────────────────────────────────────
function renderPlanBanner() {
  const banner = document.getElementById("plan-banner");
  if (!banner) return;

  const plan      = sessionStorage.getItem("plan") || "free";
  const planName  = sessionStorage.getItem("plan_name") || "Free";
  const isExpired = checkPlanExpiry();
  const daysLeft  = getDaysRemaining();

  if (plan === "free") {
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.2rem;">✨</span>
        <div>
          <div style="font-weight:600;font-size:0.9rem;">You're on the Free Plan</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">Upgrade to unlock all 7 financial engines</div>
        </div>
      </div>
      <a href="/pricing.html" class="btn btn-primary btn-sm">Upgrade Now</a>`;
    banner.style.display = "flex";
    return;
  }
  if (isExpired) {
    banner.className = "plan-banner expired";
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.2rem;">⚠️</span>
        <div>
          <div style="font-weight:600;font-size:0.9rem;color:var(--accent-red);">${planName} has expired</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">Renew to continue using premium engines</div>
        </div>
      </div>
      <a href="/pricing.html" class="btn btn-danger btn-sm">Renew Plan</a>`;
    banner.style.display = "flex";
    return;
  }
  if (daysLeft <= 7) {
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.2rem;">⏳</span>
        <div>
          <div style="font-weight:600;font-size:0.9rem;">${planName} — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">Renew early to avoid interruption</div>
        </div>
      </div>
      <a href="/pricing.html" class="btn btn-outline btn-sm">Renew</a>`;
    banner.style.display = "flex";
    return;
  }
  // Active with time remaining
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="font-size:1.2rem;">⚡</span>
      <div>
        <div style="font-weight:600;font-size:0.9rem;">${planName} — Active</div>
        <div style="font-size:0.82rem;color:var(--text-secondary);">${daysLeft} days remaining</div>
      </div>
    </div>
    <a href="/dashboard/subscription.html" class="btn btn-ghost btn-sm">Manage</a>`;
  banner.style.display = "flex";
}

// ── Sidebar active + lock ──────────────────────────────────
function setupSidebarLinks() {
  const path = window.location.pathname;
  document.querySelectorAll(".sidebar-link").forEach(link => {
    const href = link.getAttribute("href") || "";
    if (href && path.includes(href.replace(/^\.\.\//, "").replace(/^\//, ""))) {
      link.classList.add("active");
    }
    const engineId = link.dataset.engine;
    if (engineId && !hasAccess(engineId)) {   // hasAccess from api.js
      if (!link.querySelector(".lock")) {
        const lock = document.createElement("span");
        lock.className = "lock";
        lock.textContent = "🔒";
        link.appendChild(lock);
      }
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const label = engineId.charAt(0).toUpperCase() + engineId.slice(1);
        handleLockedEngine(engineId, label);
      });
    }
  });
}

// ── Dashboard stats widgets ────────────────────────────────
async function loadDashboardStats() {
  const statsEl = document.getElementById("dashboard-stats");
  if (!statsEl) return;

  const plan     = sessionStorage.getItem("plan") || "free";
  const daysLeft = getDaysRemaining();

  // Placeholder stats — replace with real API call
  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Portfolio Value</div>
      <div class="stat-value">₹—</div>
      <div class="stat-change" style="color:var(--text-muted);">Add stocks to track</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active Goals</div>
      <div class="stat-value">—</div>
      <div class="stat-change" style="color:var(--text-muted);">Use Goal Planner</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Risk Profile</div>
      <div class="stat-value" style="font-size:1rem;">—</div>
      <div class="stat-change" style="color:var(--text-muted);">Take the quiz</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Plan Status</div>
      <div class="stat-value" style="font-size:1.2rem;text-transform:capitalize;">${plan}</div>
      <div class="stat-change" style="color:var(--gold);">${plan === "free" ? "Free forever" : daysLeft + " days left"}</div>
    </div>`;
}
