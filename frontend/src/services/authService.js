// authService.js
// Full, ready-to-use file for your frontend.
// - Keeps using your existing authenticated `api` instance (imported from ./api)
// - Adds a `publicApi` axios instance (no auth header) for request-password-reset and reset-password
// - Implements session monitoring, login/logout, and other helper methods
// - Exports the service as the default export

import api from "./api";
import axios from "axios";

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minute

const PUBLIC_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Public axios instance for unauthenticated endpoints (no Authorization header)
const publicApi = axios.create({
  baseURL: PUBLIC_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  // Set withCredentials only if your backend uses cookie-based sessions for public endpoints
  withCredentials: false,
});

const authService = {
  // Initialize session monitoring (returns true if a session exists)
  initializeSessionMonitoring: () => {
    if (!sessionStorage.getItem("token")) {
      return false;
    }
    authService.trackUserActivity();
    authService.startSessionTimeout();
    document.addEventListener(
      "visibilitychange",
      authService.handleVisibilityChange
    );
    return true;
  },

  // Track user activity to reset lastActivity timestamp
  trackUserActivity: () => {
    const updateLastActivity = () => {
      sessionStorage.setItem("lastActivity", Date.now().toString());
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((event) =>
      document.addEventListener(event, updateLastActivity, { passive: true })
    );

    updateLastActivity();
  },

  // Start interval to auto-logout when inactive
  startSessionTimeout: () => {
    if (window.sessionTimeoutInterval) {
      clearInterval(window.sessionTimeoutInterval);
    }

    window.sessionTimeoutInterval = setInterval(() => {
      const lastActivity = parseInt(
        sessionStorage.getItem("lastActivity") || "0",
        10
      );
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;

      if (timeSinceActivity > SESSION_TIMEOUT) {
        console.log("Session expired due to inactivity");
        authService.logout(true);
      }
    }, ACTIVITY_CHECK_INTERVAL);
  },

  // Login: uses authenticated api instance
  login: async (username, password) => {
    try {
      console.log("Attempting login for:", username);
      const response = await api.post("/auth/login", { username, password });

      if (response?.data?.success) {
        const { token, user } = response.data;
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("user", JSON.stringify(user || {}));
        sessionStorage.setItem("lastActivity", Date.now().toString());
        sessionStorage.setItem("loginTime", Date.now().toString());
        // localStorage flag for multi-tab detection
        localStorage.setItem("hasActiveSession", "true");

        // Start tracking
        authService.trackUserActivity();
        authService.startSessionTimeout();
        document.addEventListener(
          "visibilitychange",
          authService.handleVisibilityChange
        );

        return response.data;
      } else {
        throw new Error(response.data?.message || "Login failed");
      }
    } catch (error) {
      console.error("Login error details:", error.response?.data || error);
      throw error;
    }
  },

  // Register (keeps using authenticated api; if your register endpoint is public you may want to switch)
  register: async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  // Get profile (authenticated)
  getProfile: async () => {
    const response = await api.get("/auth/profile");
    return response.data;
  },

  // ========= PASSWORD RESET METHODS (use publicApi so no auth header is attached) =========

  // Request password reset (send verification code)
  requestPasswordReset: async (email) => {
    try {
      const response = await publicApi.post("/auth/request-password-reset", {
        email,
      });
      return response.data;
    } catch (error) {
      console.error(
        "Request password reset error:",
        error.response?.data || error.message || error
      );
      throw error;
    }
  },

  // Reset password with code
  resetPassword: async (email, code, newPassword) => {
    try {
      const response = await publicApi.post("/auth/reset-password", {
        email,
        code,
        newPassword,
      });
      return response.data;
    } catch (error) {
      console.error(
        "Reset password error:",
        error.response?.data || error.message || error
      );
      throw error;
    }
  },

  // ======================================================================================

  // Logout: calls backend if token present, then clears local session state
  logout: async (isSessionExpired = false) => {
    try {
      const token = sessionStorage.getItem("token");
      if (token) {
        try {
          await api.post("/auth/logout");
        } catch (error) {
          console.warn(
            "Logout API call failed (continuing to clear session):",
            error
          );
        }
      }
    } catch (err) {
      console.error("Error during logout flow:", err);
    } finally {
      authService.clearSession();

      if (window.sessionTimeoutInterval) {
        clearInterval(window.sessionTimeoutInterval);
      }

      if (isSessionExpired) {
        try {
          // avoid blocking UI; use a toast instead in production
          alert(
            "Your session has expired due to inactivity. Please log in again."
          );
        } catch (e) {
          /* ignore */
        }
      }

      window.location.href = "/login";
    }
  },

  // Clear session data & remove listeners
  clearSession: () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("lastActivity");
    sessionStorage.removeItem("loginTime");
    sessionStorage.removeItem("tabHiddenAt");
    localStorage.removeItem("hasActiveSession");

    document.removeEventListener(
      "visibilitychange",
      authService.handleVisibilityChange
    );
  },

  // Get current user from session storage (returns parsed object or null)
  getCurrentUser: () => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) return null;

    // verify session still valid
    const lastActivity = parseInt(
      sessionStorage.getItem("lastActivity") || "0",
      10
    );
    const now = Date.now();
    if (now - lastActivity > SESSION_TIMEOUT) {
      console.log("Session expired, clearing user data");
      authService.clearSession();
      return null;
    }
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  },

  // Authenticated check
  isAuthenticated: () => {
    const token = sessionStorage.getItem("token");
    const lastActivity = parseInt(
      sessionStorage.getItem("lastActivity") || "0",
      10
    );
    const now = Date.now();

    if (!token || now - lastActivity > SESSION_TIMEOUT) {
      if (token) {
        console.log("Authentication check failed - session expired");
        authService.clearSession();
      }
      return false;
    }
    return true;
  },

  // Session info helper
  getSessionInfo: () => {
    const loginTime = parseInt(sessionStorage.getItem("loginTime") || "0", 10);
    const lastActivity = parseInt(
      sessionStorage.getItem("lastActivity") || "0",
      10
    );
    const now = Date.now();

    if (!loginTime) return null;

    const sessionDuration = now - loginTime;
    const timeUntilExpiry = SESSION_TIMEOUT - (now - lastActivity);

    return {
      loggedInForMinutes: Math.floor(sessionDuration / 1000 / 60),
      expiresInMinutes: Math.max(0, Math.floor(timeUntilExpiry / 1000 / 60)),
    };
  },

  // Visibility change handler for tab hidden/visible detection
  handleVisibilityChange: () => {
    if (document.hidden) {
      sessionStorage.setItem("tabHiddenAt", Date.now().toString());
    } else {
      const hiddenAt = parseInt(
        sessionStorage.getItem("tabHiddenAt") || "0",
        10
      );
      const now = Date.now();
      if (hiddenAt && now - hiddenAt > SESSION_TIMEOUT) {
        console.log("Session expired while tab was hidden");
        authService.logout(true);
      }
    }
  },
};

export default authService;
