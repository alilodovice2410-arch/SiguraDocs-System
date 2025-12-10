import { createContext, useContext, useState, useEffect } from "react";
import authService from "../services/authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState(null);

  // Initialize authentication state
  useEffect(() => {
    const initAuth = () => {
      try {
        // Initialize session monitoring
        authService.initializeSessionMonitoring();

        // Check if user is authenticated
        if (authService.isAuthenticated()) {
          const currentUser = authService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          } else {
            // Session expired
            authService.clearSession();
          }
        } else {
          // Not authenticated
          authService.clearSession();
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        authService.clearSession();
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Update session info every minute
    const sessionInfoInterval = setInterval(() => {
      if (authService.isAuthenticated()) {
        const info = authService.getSessionInfo();
        setSessionInfo(info);
      }
    }, 60000);

    // Handle beforeunload event (browser closing)
    const handleBeforeUnload = (e) => {
      // This logs the user out when the browser/tab closes
      // Note: Modern browsers may ignore this for security
      const token = sessionStorage.getItem("token");
      if (token) {
        // Send logout beacon (non-blocking)
        navigator.sendBeacon(
          `${
            import.meta.env.VITE_API_URL || "http://localhost:5000/api"
          }/auth/logout`,
          JSON.stringify({ token })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup
    return () => {
      clearInterval(sessionInfoInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Login function
  const login = async (username, password) => {
    const response = await authService.login(username, password);
    setUser(response.user);

    // Get initial session info
    const info = authService.getSessionInfo();
    setSessionInfo(info);

    return response;
  };

  // Logout function
  const logout = async (isSessionExpired = false) => {
    try {
      await authService.logout(isSessionExpired);
      setUser(null);
      setSessionInfo(null);
    } catch (error) {
      console.error("Logout error:", error);
      // Force logout even on error
      authService.clearSession();
      setUser(null);
      setSessionInfo(null);
      window.location.href = "/login";
    }
  };

  // Check if authenticated
  const isAuthenticated = () => {
    return authService.isAuthenticated();
  };

  // Update user
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    sessionStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated,
    updateUser,
    loading,
    sessionInfo,
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#f9fafb",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "3rem",
              height: "3rem",
              border: "3px solid #e5e7eb",
              borderTopColor: "#2d4739",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 1rem",
            }}
          ></div>
          <p style={{ color: "#6b7280" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
