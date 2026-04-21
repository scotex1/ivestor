// ============================================================
// payment.js — Cashfree Payment Integration
// FinVest Pro
// ============================================================

// Cashfree SDK loaded via CDN: https://sdk.cashfree.com/js/ui/2.0.0/cashfree.sandbox.js
// For production: https://sdk.cashfree.com/js/ui/2.0.0/cashfree.prod.js

const CASHFREE_MODE = "sandbox"; // Change to "production" for live

const PLANS = {
  basic: {
    id: "basic",
    name: "Basic Plan",
    amount: 499,
    currency: "INR",
    duration: "monthly",
    description: "Access to 4 financial engines"
  },
  pro: {
    id: "pro",
    name: "Pro Plan",
    amount: 999,
    currency: "INR",
    duration: "monthly",
    description: "Full access to all 7 engines"
  },
  elite: {
    id: "elite",
    name: "Elite Plan",
    amount: 1999,
    currency: "INR",
    duration: "monthly",
    description: "Pro + priority support + custom reports"
  },
  basic_yearly: {
    id: "basic_yearly",
    name: "Basic Plan (Yearly)",
    amount: 4499,
    currency: "INR",
    duration: "yearly",
    description: "Basic Plan billed annually — save 25%"
  },
  pro_yearly: {
    id: "pro_yearly",
    name: "Pro Plan (Yearly)",
    amount: 8999,
    currency: "INR",
    duration: "yearly",
    description: "Pro Plan billed annually — save 25%"
  }
};

// --- Initiate Payment ---
async function initiatePayment(planId) {
  const plan = PLANS[planId];
  if (!plan) { showToast("Invalid plan selected", "error"); return; }

  const token = getStoredToken();
  if (!token) { window.location.href = "/auth/login.html"; return; }

  try {
    showToast("Creating order...", "info");

    // Step 1: Create order on backend
    const orderData = await API.createOrder({
      plan_id: planId,
      amount: plan.amount,
      currency: plan.currency,
      plan_name: plan.name
    }, token);

    if (!orderData || !orderData.payment_session_id) {
      throw new Error("Order creation failed");
    }

    // Step 2: Open Cashfree checkout
    const cashfree = await initCashfree();

    const checkoutOptions = {
      paymentSessionId: orderData.payment_session_id,
      redirectTarget: "_modal",  // Opens in modal on same page
    };

    cashfree.checkout(checkoutOptions).then((result) => {
      if (result.error) {
        showToast("Payment failed: " + result.error.message, "error");
        logPaymentEvent("payment_failed", planId, result.error);
      } else if (result.redirect) {
        // Redirect flow — verify on return
        console.log("Payment redirected");
      } else if (result.paymentDetails) {
        // Payment successful — verify with backend
        verifyPayment(result.paymentDetails, planId, orderData.order_id);
      }
    });

  } catch (err) {
    showToast(err.message || "Payment initialization failed", "error");
    console.error("Payment error:", err);
  }
}

// --- Verify Payment with Backend ---
async function verifyPayment(paymentDetails, planId, orderId) {
  const token = getStoredToken();
  try {
    showToast("Verifying payment...", "info");

    const result = await API.verifyPayment({
      order_id: orderId,
      plan_id: planId,
      payment_id: paymentDetails.paymentId || paymentDetails.cf_payment_id,
      signature: paymentDetails.signature
    }, token);

    if (result.success) {
      // Update session with new plan
      sessionStorage.setItem("plan", planId.replace("_yearly", ""));
      sessionStorage.setItem("plan_expiry", result.expiry_date);

      showToast("🎉 Payment successful! Plan activated.", "success", 6000);

      // Show success modal
      showPaymentSuccessModal(planId, result.expiry_date);

      // Refresh dashboard after 2 seconds
      setTimeout(() => {
        if (window.location.pathname.includes("dashboard")) {
          window.location.reload();
        } else {
          window.location.href = "/dashboard/dashboard.html";
        }
      }, 3000);
    } else {
      throw new Error(result.message || "Verification failed");
    }

  } catch (err) {
    showToast("Payment verification failed. Contact support if money was deducted.", "error", 8000);
    console.error("Verification error:", err);
  }
}

// --- Initialize Cashfree SDK ---
async function initCashfree() {
  if (typeof Cashfree === "undefined") {
    throw new Error("Cashfree SDK not loaded");
  }
  return Cashfree({ mode: CASHFREE_MODE });
}

// --- Handle Return from Redirect Payment ---
async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order_id");
  const status = params.get("order_status");

  if (!orderId) return;

  if (status === "PAID") {
    await verifyPayment({ paymentId: params.get("cf_payment_id") }, params.get("plan_id"), orderId);
  } else if (status === "FAILED") {
    showToast("Payment failed. Please try again.", "error");
  } else if (status === "PENDING") {
    showToast("Payment is pending. We'll notify you once confirmed.", "warning", 8000);
  }

  // Clean URL
  window.history.replaceState({}, document.title, window.location.pathname);
}

// --- Show Payment Success Modal ---
function showPaymentSuccessModal(planId, expiryDate) {
  const plan = PLANS[planId] || {};
  const modal = document.getElementById("payment-success-modal");
  if (!modal) return;

  const planName = document.getElementById("success-plan-name");
  const planExpiry = document.getElementById("success-expiry");

  if (planName) planName.textContent = plan.name || planId;
  if (planExpiry) planExpiry.textContent = formatDate(expiryDate);

  modal.classList.add("active");
}

// --- Log Payment Event (analytics) ---
function logPaymentEvent(event, planId, details = {}) {
  console.log(`[Payment] ${event}`, { planId, ...details });
  // TODO: send to analytics
}

// --- Render Pricing Cards ---
function renderPricingCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentPlan = sessionStorage.getItem("plan") || "free";

  const pricingData = [
    {
      id: "free",
      name: "Free",
      price: "₹0",
      period: "forever",
      tagline: "Start exploring",
      engines: ["Risk Profiler", "Market News"],
      locked: ["Goal Planner", "Retirement", "Stock Analysis", "Portfolio", "Global Events"],
      featured: false
    },
    {
      id: "basic",
      name: "Basic",
      price: "₹499",
      period: "/month",
      tagline: "For individual investors",
      engines: ["Risk Profiler", "Market News", "Goal Planner", "Retirement Planner"],
      locked: ["Stock Analysis", "Portfolio Optimizer", "Global Events"],
      featured: false
    },
    {
      id: "pro",
      name: "Pro",
      price: "₹999",
      period: "/month",
      tagline: "Full financial intelligence",
      engines: ["Risk Profiler", "Market News", "Goal Planner", "Retirement Planner", "Stock Analysis", "Portfolio Optimizer", "Global Events"],
      locked: [],
      featured: true
    }
  ];

  container.innerHTML = pricingData.map(p => `
    <div class="pricing-card ${p.featured ? 'featured' : ''}">
      ${p.featured ? '<div class="popular-badge">⭐ Most Popular</div>' : ''}
      <div class="badge ${p.id === 'free' ? 'badge-gray' : p.id === 'basic' ? 'badge-blue' : 'badge-gold'}">${p.name}</div>
      <div class="pricing-price">${p.price}<span>${p.period}</span></div>
      <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:4px;">${p.tagline}</p>

      <div class="divider" style="margin:20px 0;"></div>

      <ul class="pricing-features">
        ${p.engines.map(e => `
          <li><span class="check">✓</span> ${e}</li>
        `).join("")}
        ${p.locked.map(e => `
          <li style="opacity:0.45;"><span class="cross">✕</span> ${e}</li>
        `).join("")}
      </ul>

      ${currentPlan === p.id
        ? `<button class="btn btn-ghost btn-full" disabled>✓ Current Plan</button>`
        : p.id === "free"
          ? `<a href="/auth/signup.html" class="btn btn-outline btn-full">Get Started Free</a>`
          : `<button class="btn ${p.featured ? 'btn-primary' : 'btn-outline'} btn-full" onclick="initiatePayment('${p.id}')">
               Upgrade to ${p.name}
             </button>`
      }
    </div>
  `).join("");
}

// --- Init on page load ---
document.addEventListener("DOMContentLoaded", () => {
  // Handle payment return redirect
  handlePaymentReturn();

  // Render pricing if container exists
  if (document.getElementById("pricing-cards-container")) {
    renderPricingCards("pricing-cards-container");
  }
});
