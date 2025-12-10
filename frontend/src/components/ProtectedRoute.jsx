import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      // Check if authenticated
      if (!isAuthenticated()) {
        console.log("User not authenticated, redirecting to login");
        setIsChecking(false);
        return;
      }

      // Check if user data exists
      if (!user) {
        console.log("User data not found");
        setIsChecking(false);
        return;
      }

      // If specific roles are required, check them
      if (allowedRoles.length > 0) {
        if (!allowedRoles.includes(user.role_name)) {
          console.log(
            `User role '${user.role_name}' not in allowed roles:`,
            allowedRoles
          );
          setIsChecking(false);
          return;
        }
      }

      // All checks passed
      console.log(`Access granted for role: ${user.role_name}`);
      setIsChecking(false);
    };

    checkAuth();

    // Set up periodic authentication check (every minute)
    const authCheckInterval = setInterval(() => {
      if (!isAuthenticated()) {
        console.log("Session expired during periodic check");
        logout(true); // true = session expired
      }
    }, 60000);

    // Cleanup
    return () => {
      clearInterval(authCheckInterval);
    };
  }, [isAuthenticated, user, allowedRoles, logout]);

  // Show loading while checking
  if (isChecking) {
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
          <p style={{ color: "#6b7280" }}>Verifying session...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated() || !user) {
    console.log("Redirecting to login - not authenticated");
    return <Navigate to="/login" replace />;
  }

  // Check role authorization (only if roles are specified)
  if (allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role_name)) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            background: "#f9fafb",
            padding: "2rem",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "3rem",
              borderRadius: "1rem",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              textAlign: "center",
              maxWidth: "500px",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                background: "#fee2e2",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
                fontSize: "2.5rem",
              }}
            >
              🚫
            </div>
            <h1
              style={{
                fontSize: "1.875rem",
                color: "#1f2937",
                marginBottom: "1rem",
                fontWeight: "700",
              }}
            >
              Access Denied
            </h1>
            <p
              style={{
                color: "#6b7280",
                marginBottom: "0.5rem",
                fontSize: "1rem",
              }}
            >
              You don't have permission to access this page.
            </p>
            <p
              style={{
                color: "#9ca3af",
                marginBottom: "2rem",
                fontSize: "0.875rem",
              }}
            >
              Your role: <strong>{user.role_name}</strong>
            </p>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#2d4739",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: "600",
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }
  }

  // All checks passed - render children
  return children;
}

export default ProtectedRoute;
