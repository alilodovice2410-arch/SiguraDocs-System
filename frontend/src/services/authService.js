import api from "./api";
import axios from "axios";

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minute

// Get the correct base URL based on environment
const getPublicBaseURL = () => {
  // Always use VITE_API_URL if available
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

// Public axios instance for unauthenticated endpoints
const publicApi = axios.create({
  baseURL: getPublicBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
  withCredentials: false,
});

// Add response interceptor for better error logging
publicApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error("Public API Error:", {
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config?.url,
        data: error.response.data,
      });
    } else if (error.request) {
      console.error("Public API No Response:", {
        url: error.config?.url,
        message: "No response received from server",
      });
    }
    return Promise.reject(error);
  }
);

const authService = {
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

  login: async (username, password) => {
    try {
      console.log("Attempting login for:", username);
      console.log("API Base URL:", api.defaults.baseURL);

      const response = await api.post("/auth/login", {
        username,
        password,
      });

      console.log("Login response:", response.data);

      if (response?.data?.success) {
        const { token, user } = response.data;

        sessionStorage.setItem("token", token);
        sessionStorage.setItem("user", JSON.stringify(user || {}));
        sessionStorage.setItem("lastActivity", Date.now().toString());
        sessionStorage.setItem("loginTime", Date.now().toString());
        localStorage.setItem("hasActiveSession", "true");

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
      console.error("Login error:", error);

      // Better error messages
      let errorMessage = "Login failed. Please try again.";

      if (error.response) {
        // Server responded with error
        if (error.response.status === 405) {
          errorMessage = "Server configuration error. Please contact support.";
        } else if (error.response.status === 401) {
          errorMessage = "Invalid username or password.";
        } else if (error.response.status === 404) {
          errorMessage = "Login endpoint not found. Please contact support.";
        } else {
          errorMessage =
            error.response.data?.message ||
            `Error ${error.response.status}: ${error.response.statusText}`;
        }
      } else if (error.request) {
        // No response from server
        errorMessage = "Cannot reach server. Please check your connection.";
      }

      // Create a new error with the friendly message
      const friendlyError = new Error(errorMessage);
      friendlyError.originalError = error;
      throw friendlyError;
    }
  },

  register: async (userData) => {
    try {
      const response = await api.post("/auth/register", userData);
      return response.data;
    } catch (error) {
      console.error("Register error:", error.response?.data || error);
      throw error;
    }
  },

  getProfile: async () => {
    const response = await api.get("/auth/profile");
    return response.data;
  },

  requestPasswordReset: async (email) => {
    try {
      console.log("Requesting password reset for:", email);
      const response = await publicApi.post("/auth/request-password-reset", {
        email,
      });
      return response.data;
    } catch (error) {
      console.error("Request password reset error:", error);
      throw error;
    }
  },

  resetPassword: async (email, code, newPassword) => {
    try {
      console.log("Resetting password for:", email);
      const response = await publicApi.post("/auth/reset-password", {
        email,
        code,
        newPassword,
      });
      return response.data;
    } catch (error) {
      console.error("Reset password error:", error);
      throw error;
    }
  },

  logout: async (isSessionExpired = false) => {
    try {
      // Get user's role before clearing session
      const userRole = localStorage.getItem("userRole");

      const token = sessionStorage.getItem("token");
      if (token) {
        try {
          await api.post("/auth/logout");
        } catch (error) {
          console.warn("Logout API call failed:", error);
        }
      }
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      // Get role before clearing
      const userRole = localStorage.getItem("userRole");

      // Clear session
      authService.clearSession();

      if (window.sessionTimeoutInterval) {
        clearInterval(window.sessionTimeoutInterval);
      }

      if (isSessionExpired) {
        alert(
          "Your session has expired due to inactivity. Please log in again."
        );
      }

      // Redirect to role-specific login page or role selection
      if (userRole) {
        window.location.href = `/login?role=${userRole}`;
      } else {
        window.location.href = "/"; // Redirect to role selection
      }
    }
  },

  clearSession: () => {
    // Don't remove userRole here - we need it for logout redirect
    const userRole = localStorage.getItem("userRole");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("lastActivity");
    sessionStorage.removeItem("loginTime");
    sessionStorage.removeItem("tabHiddenAt");
    localStorage.removeItem("hasActiveSession");

    // Clear userRole AFTER we've used it for redirect
    // This will be called again after redirect in the new page load
    if (!window.location.pathname.includes("/login")) {
      localStorage.removeItem("userRole");
    }

    document.removeEventListener(
      "visibilitychange",
      authService.handleVisibilityChange
    );
  },

  getCurrentUser: () => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) return null;

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
      expiresIn: Math.max(0, Math.floor(timeUntilExpiry / 1000 / 60)), // Add this for SessionIndicator
    };
  },

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
