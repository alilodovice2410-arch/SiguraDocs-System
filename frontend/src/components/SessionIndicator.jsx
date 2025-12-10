import { useState, useEffect } from "react";
import { Clock, AlertCircle } from "lucide-react";
import authService from "../services/authService";
import "./SessionIndicator.css";

function SessionIndicator() {
  const [sessionInfo, setSessionInfo] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Update session info every minute
    const updateInfo = () => {
      const info = authService.getSessionInfo();
      setSessionInfo(info);

      // Show warning if less than 5 minutes remaining
      if (info && info.expiresIn <= 5 && info.expiresIn > 0) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    updateInfo();
    const interval = setInterval(updateInfo, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  if (!sessionInfo) return null;

  return (
    <>
      {/* Session Status Badge */}
      <div className={`session-indicator ${showWarning ? "warning" : ""}`}>
        <Clock size={14} />
        <span className="session-time">{sessionInfo.expiresIn} min</span>
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div className="session-warning-overlay">
          <div className="session-warning-modal">
            <div className="warning-icon">
              <AlertCircle size={48} />
            </div>
            <h3>Session Expiring Soon</h3>
            <p>
              Your session will expire in{" "}
              <strong>{sessionInfo.expiresIn} minutes</strong> due to
              inactivity.
            </p>
            <p className="warning-subtitle">
              Click anywhere or move your mouse to stay logged in.
            </p>
            <button
              className="extend-session-btn"
              onClick={() => {
                // User activity will automatically extend the session
                sessionStorage.setItem("lastActivity", Date.now().toString());
                setShowWarning(false);
              }}
            >
              Stay Logged In
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default SessionIndicator;
