import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  X,
} from "lucide-react";
import api from "../../services/api";
import "./css/NotificationService.css";

function NotificationService({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  // Fetch unread count on mount / interval
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when opened
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Click outside the panel closes it (works across portal)
  useEffect(() => {
    function onDocClick(e) {
      if (!isOpen) return;
      const el = panelRef.current;
      if (el && !el.contains(e.target)) {
        // If click target is not inside the panel, close only if click is on the overlay or outside
        onClose?.();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen, onClose]);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      if (res.data && res.data.success) {
        setUnreadCount(res.data.count || 0);
      }
    } catch (err) {
      // silent fallback
      console.error("Unread count fetch error:", err);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get("/notifications");
      if (response.data && response.data.success) {
        setNotifications(response.data.notifications || []);
        if (typeof response.data.unreadCount !== "undefined") {
          setUnreadCount(response.data.unreadCount || 0);
        } else {
          setUnreadCount(
            (response.data.notifications || []).filter((n) => !n.read).length,
          );
        }
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      // keep graceful fallback: empty list
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const clearAll = async () => {
    try {
      await api.post("/notifications/clear-all");
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing notifications:", error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle className="notification-icon success" />;
      case "pending":
        return <Clock className="notification-icon pending" />;
      case "error":
        return <XCircle className="notification-icon error" />;
      default:
        return <AlertCircle className="notification-icon info" />;
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return time.toLocaleDateString();
  };

  if (!isOpen) return null;

  const panel = (
    <>
      <div
        className="notification-overlay"
        // clicking overlay closes the panel
        onClick={(e) => {
          // Only close if overlay itself was clicked (not panel)
          if (e.target === e.currentTarget) onClose?.();
        }}
      />
      <div
        className="notification-panel faculty-style"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        ref={panelRef}
        // stop propagation so overlay click handler doesn't trigger when clicking inside panel
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="notification-header">
          <div className="notification-title">
            <Bell size={18} />
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <span className="unread-count">{unreadCount}</span>
            )}
          </div>
          <div className="notification-header-actions">
            <button
              className="clear-all-btn small"
              onClick={clearAll}
              title="Clear all notifications"
            >
              Clear
            </button>
            <button onClick={onClose} className="close-btn" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="notification-list">
          {loading ? (
            <div className="no-notifications">
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="no-notifications">
              <Bell size={48} />
              <p>No notifications</p>
              <span>You're all caught up!</span>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${
                  !notification.read ? "unread" : ""
                }`}
                onClick={() =>
                  !notification.read && markAsRead(notification.id)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    !notification.read && markAsRead(notification.id);
                  }
                }}
              >
                <div className="notification-content">
                  {getIcon(notification.type)}
                  <div className="notification-text">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {formatTime(notification.timestamp)}
                    </span>
                  </div>
                </div>
                {!notification.read && (
                  <span className="unread-indicator" aria-hidden="true" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="notification-footer">
          <small>
            <Bell size={12} />
            Notifications are updated in real-time
          </small>
        </div>
      </div>
    </>
  );

  // Render into document.body so it's outside header/sidebar stacking contexts
  return typeof document !== "undefined"
    ? createPortal(panel, document.body)
    : null;
}

export default NotificationService;
