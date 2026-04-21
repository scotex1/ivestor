// ============================================================
// api.js — Backend API + Auth Guards + Helpers
// FinVest Pro
// IMPORTANT: This file must load BEFORE auth.js and page scripts
// ============================================================

const API_BASE = "https://your-backend.com/api/v1"; // ← Change this

// ============================================================
// SESSION HELPERS (no Firebase dependency)
// ============================================================
function getStoredToken() {
  return sessionStorage.getItem("fb_token") || localStorage.getItem("fb_token");
}

function storeSession(data) {
  const s = sessionStorage;
  if (data.token)       s.setItem("fb_token",      data.token);
  if (data.email)       s.setItem("user_email",     data.email);
  if (data.name)        s.setItem("user_name",       data.name);
  if (data.photo)       s.setItem("user_photo",      data.photo);
  if (data.plan)        s.setItem("plan",            data.plan);
  if (data.planExpiry)  s.setItem("plan_expiry",     data.planExpiry);
  if (data.planName)    s.setItem("plan_name",       data.planName);
  if (data.isAdmin !== undefined) s.setItem("is_admin", data.isAdmin ? "true" : "false");
}

function getUserInfo() {
  return {
    email:      sessionStorage.getItem("user_email")  || "",
    name:       sessionStorage.getItem("user_name")   || "User",
    photo:      sessionStorage.getItem("user_photo")  || "",
    plan:       sessionStorage.getItem("plan")        || "free",
    planName:   sessionStorage.getItem("plan_name")   || "Free",
    planExpiry: sessionStorage.getItem("plan_expiry") || "",
    isAdmin:    sessionStorage.getItem("is_admin")    === "true"
  };
}

// ============================================================
// AUTH GUARDS (safe to call before Firebase loads)
// ============================================================
function requireAuth() {
  const token = getStoredToken();
  if (!token) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = "/auth/login.html?redirect=" + redirect;
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!requireAuth()) return false;
  if (sessionStorage.getItem("is_admin") !== "true") {
    window.location.href = "/dashboard/dashboard.html";
    return false;
  }
  return true;
}

// ============================================================
// PLAN ACCESS CONTROL
// ============================================================
const PLAN_ENGINES = {
  free:   ["risk-profile", "news"],
  basic:  ["risk-profile", "news", "goal-planner", "retirement"],
  pro:    ["risk-profile", "news", "goal-planner", "retirement", "stock-analysis", "portfolio", "global-events"],
  elite:  ["risk-profile", "news", "goal-planner", "retirement", "stock-analysis", "portfolio", "global-events"]
};

function hasAccess(engineId) {
  const plan = sessionStorage.getItem("plan") || "free";
  const isExpired = checkPlanExpiry();
  if (isExpired && plan !== "free") return PLAN_ENGINES["free"].includes(engineId);
  return (PLAN_ENGINES[plan] || PLAN_ENGINES.free).includes(engineId);
}

function checkPlanExpiry() {
  const expiry = sessionStorage.getItem("plan_expiry");
  if (!expiry) return false;
  return new Date() > new Date(expiry);
}

function getDaysRemaining() {
  const expiry = sessionStorage.getItem("plan_expiry");
  if (!expiry) return 0;
  const diff = new Date(expiry) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ============================================================
// BACKEND API
// ============================================================
const API = {
  async request(method, endpoint, body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    try {
      const res = await fetch(API_BASE + endpoint, options);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.clear();
          window.location.href = "/auth/login.html";
          return;
        }
        throw new Error(data.message || `Error ${res.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API [${method}] ${endpoint}:`, err.message);
      throw err;
    }
  },

  get:    (ep, tok)       => API.request("GET",    ep, null, tok),
  post:   (ep, body, tok) => API.request("POST",   ep, body, tok),
  put:    (ep, body, tok) => API.request("PUT",    ep, body, tok),
  delete: (ep, tok)       => API.request("DELETE", ep, null, tok),

  // Auth
  syncUser: (data, tok) => API.post("/auth/sync", data, tok),

  // User
  getProfile:    (tok)       => API.get("/user/profile", tok),
  updateProfile: (data, tok) => API.put("/user/profile", data, tok),
  getPlan:       (tok)       => API.get("/user/plan", tok),

  // Engines
  getRiskProfile: (data, tok) => API.post("/engines/risk-profile",   data, tok),
  getGoalPlan:    (data, tok) => API.post("/engines/goal-planner",    data, tok),
  getRetirement:  (data, tok) => API.post("/engines/retirement",      data, tok),
  analyzeStock:   (data, tok) => API.post("/engines/stock-analysis",  data, tok),
  getPortfolio:   (tok)       => API.get("/engines/portfolio",        tok),
  getNews:        (tok)       => API.get("/engines/news",             tok),
  getGlobalEvents:(tok)       => API.get("/engines/global-events",    tok),

  // Payments
  createOrder:       (data, tok) => API.post("/payment/create-order", data, tok),
  verifyPayment:     (data, tok) => API.post("/payment/verify",        data, tok),
  getPaymentHistory: (tok)       => API.get("/payment/history",        tok),

  // Admin
  admin: {
    getStats:    (tok)            => API.get("/admin/stats", tok),
    getUsers:    (params, tok)    => API.get(`/admin/users?${new URLSearchParams(params)}`, tok),
    updateUser:  (uid, data, tok) => API.put(`/admin/users/${uid}`, data, tok),
    deleteUser:  (uid, tok)       => API.delete(`/admin/users/${uid}`, tok),
    getPayments: (params, tok)    => API.get(`/admin/payments?${new URLSearchParams(params)}`, tok),
    getPlans:    (tok)            => API.get("/admin/plans", tok),
    updatePlan:  (id, data, tok)  => API.put(`/admin/plans/${id}`, data, tok),
  }
};

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
function showToast(message, type = "info", duration = 4000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const icons  = { success:"✓", error:"✕", warning:"⚠", info:"ℹ", gold:"★" };
  const colors = { success:"var(--accent-green)", error:"var(--accent-red)", warning:"var(--gold)", info:"var(--accent-blue)", gold:"var(--gold)" };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="color:${colors[type]||colors.info};font-size:1rem;font-weight:700;">${icons[type]||"ℹ"}</span>
    <span style="flex:1;font-size:0.88rem;">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0;font-size:1rem;">✕</button>
  `;
  container.appendChild(toast);
  if (duration > 0) {
    setTimeout(() => {
      toast.style.transition = "opacity 0.3s, transform 0.3s";
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// ============================================================
// FORMAT HELPERS
// ============================================================
function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function formatNumber(n) {
  if (n >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000)   return (n / 100000).toFixed(2)   + " L";
  if (n >= 1000)     return (n / 1000).toFixed(1)      + "K";
  return n.toLocaleString("en-IN");
}

function setLoading(elementId, isLoading, text = "Loading...") {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (isLoading) {
    el.dataset.originalContent = el.innerHTML;
    el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);justify-content:center;padding:40px 0;"><span class="spinner"></span> ${text}</div>`;
  } else {
    if (el.dataset.originalContent) el.innerHTML = el.dataset.originalContent;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Plan badge CSS class helper
function getPlanBadgeClass(plan) {
  const map = { free:"badge-gray", basic:"badge-blue", pro:"badge-gold", elite:"badge-gold" };
  return map[plan] || "badge-gray";
}
