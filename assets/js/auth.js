// ============================================================
// auth.js — Firebase Authentication
// FinVest Pro
// Load ORDER: api.js → Firebase SDKs → auth.js → page script
// ============================================================

// ── Replace with YOUR Firebase project config ──────────────
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
// ────────────────────────────────────────────────────────────

let _auth = null;

// ── Initialize ─────────────────────────────────────────────
function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      console.warn("Firebase SDK not loaded yet.");
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _auth = firebase.auth();
    _setupAuthListener();
  } catch (err) {
    console.error("Firebase init failed:", err);
  }
}

function _setupAuthListener() {
  _auth.onAuthStateChanged(async (user) => {
    if (user) {
      const token = await user.getIdToken();
      storeSession({
        token,
        email:  user.email,
        name:   user.displayName || user.email.split("@")[0],
        photo:  user.photoURL || ""
      });
      // Sync with backend (non-blocking)
      API.syncUser({ uid: user.uid, email: user.email, name: user.displayName, photo: user.photoURL }, token)
        .catch(() => {});
      // Redirect away from auth pages
      if (window.location.pathname.includes("/auth/")) {
        const params = new URLSearchParams(window.location.search);
        window.location.href = params.get("redirect") || "/dashboard/dashboard.html";
      }
    } else {
      // Protect dashboard/engine/admin routes
      const protect = ["/dashboard/", "/engines/", "/admin/"];
      if (protect.some(p => window.location.pathname.includes(p))) {
        sessionStorage.clear();
        window.location.href = "/auth/login.html";
      }
    }
  });
}

// ── Email Sign Up ──────────────────────────────────────────
async function signUpWithEmail(email, password, name) {
  _setBtnLoading("signup-btn", true);
  try {
    const cred = await _auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await cred.user.sendEmailVerification();
    showToast("Account created! Check your email to verify.", "success");
    return { success: true };
  } catch (err) {
    showToast(_fbError(err.code), "error");
    return { success: false };
  } finally {
    _setBtnLoading("signup-btn", false);
  }
}

// ── Email Login ────────────────────────────────────────────
async function loginWithEmail(email, password) {
  _setBtnLoading("login-btn", true);
  try {
    await _auth.signInWithEmailAndPassword(email, password);
    showToast("Welcome back!", "success");
    return { success: true };
  } catch (err) {
    showToast(_fbError(err.code), "error");
    return { success: false };
  } finally {
    _setBtnLoading("login-btn", false);
  }
}

// ── Google Sign-In ─────────────────────────────────────────
async function signInWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("email");
    await _auth.signInWithPopup(provider);
    showToast("Signed in with Google!", "success");
    return { success: true };
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      showToast(_fbError(err.code), "error");
    }
    return { success: false };
  }
}

// ── Forgot Password ────────────────────────────────────────
async function resetPassword(email) {
  try {
    await _auth.sendPasswordResetEmail(email);
    showToast("Reset link sent to " + email, "success");
  } catch (err) {
    showToast(_fbError(err.code), "error");
  }
}

// ── Sign Out ───────────────────────────────────────────────
async function signOut() {
  try {
    if (_auth) await _auth.signOut();
    sessionStorage.clear();
    localStorage.removeItem("fb_token");
    window.location.href = "/index.html";
  } catch (err) {
    showToast("Sign out failed", "error");
  }
}

// ── Error Messages ─────────────────────────────────────────
function _fbError(code) {
  const m = {
    "auth/user-not-found":        "No account found with this email.",
    "auth/wrong-password":        "Incorrect password.",
    "auth/email-already-in-use":  "This email is already registered.",
    "auth/weak-password":         "Password must be at least 6 characters.",
    "auth/invalid-email":         "Please enter a valid email address.",
    "auth/too-many-requests":     "Too many attempts. Please try again later.",
    "auth/popup-closed-by-user":  "Sign-in was cancelled.",
    "auth/network-request-failed":"Network error. Check your connection.",
    "auth/invalid-credential":    "Invalid credentials. Please try again.",
  };
  return m[code] || "Something went wrong. Please try again.";
}

// ── Button loading state ───────────────────────────────────
function _setBtnLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Please wait...';
    btn.disabled = true;
  } else {
    if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
    btn.disabled = false;
  }
}

// ── Auto-bind forms on DOM ready ──────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Init Firebase
  initFirebase();

  // Login form
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await loginWithEmail(
        document.getElementById("email").value.trim(),
        document.getElementById("password").value
      );
    });
  }

  // Signup form
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name    = document.getElementById("name").value.trim();
      const email   = document.getElementById("email").value.trim();
      const pass    = document.getElementById("password").value;
      const confirm = document.getElementById("confirm-password")?.value;
      if (confirm && pass !== confirm) {
        showToast("Passwords do not match", "error"); return;
      }
      const terms = document.getElementById("terms-check");
      if (terms && !terms.checked) {
        showToast("Please accept the Terms of Service", "error"); return;
      }
      await signUpWithEmail(email, pass, name);
    });
  }

  // Google button
  const googleBtn = document.getElementById("google-signin-btn");
  if (googleBtn) googleBtn.addEventListener("click", signInWithGoogle);

  // Forgot password
  const forgotLink = document.getElementById("forgot-password-link");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      const email = document.getElementById("email")?.value?.trim();
      if (!email) { showToast("Enter your email first", "error"); return; }
      resetPassword(email);
    });
  }

  // Logout button (any page)
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", (e) => { e.preventDefault(); signOut(); });
});
