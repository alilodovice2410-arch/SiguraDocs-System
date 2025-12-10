import { useState, useEffect, useRef } from "react";
import { Bell, X, Mail, Check } from "lucide-react";
import api from "../../services/api";
import "./css/DepartmentHeadNotificationBell.css";

export default function DeptHeadNotificationBell({ onNavigateToView }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Test on mount
  useEffect(() => {
    console.log("🔔 NotificationBell component mounted!");
    console.log("🔔 onNavigateToView prop:", onNavigateToView);
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function fetchUnreadCount() {
    try {
      const res = await api.get("/notifications/unread-count");
      if (res.data && res.data.success) {
        setUnreadCount(res.data.count || 0);
      }
    } catch (err) {
      console.error("Unread count fetch error:", err);
    }
  }

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await api.get("/notifications");
      if (res.data && res.data.success) {
        setNotifications(res.data.notifications || []);
        if (typeof res.data.unreadCount !== "undefined") {
          setUnreadCount(res.data.unreadCount);
        } else {
          setUnreadCount(
            (res.data.notifications || []).filter((n) => !n.read).length
          );
        }
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error("Fetch notifications error:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleBellClick() {
    console.log("🔔 Bell clicked!");
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      await fetchNotifications();
    }
  }

  function handleNotificationClick(notification) {
    console.log("========================================");
    console.log("🔔 NOTIFICATION CLICKED!");
    console.log("Notification:", notification);
    console.log("Title:", notification.title);
    console.log("onNavigateToView exists?", !!onNavigateToView);
    console.log("onNavigateToView type:", typeof onNavigateToView);
    console.log("========================================");

    // Mark as read if unread
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Close dropdown
    setOpen(false);

    // Check if callback exists
    if (!onNavigateToView) {
      console.error("❌ ERROR: onNavigateToView prop is not defined!");
      alert("Navigation function is missing!");
      return;
    }

    // Navigate based on notification type
    const titleLower = notification.title.toLowerCase();
    console.log("Title (lowercase):", titleLower);

    let targetView = "approvals"; // default

    if (
      titleLower.includes("submitted") ||
      titleLower.includes("review") ||
      titleLower.includes("pending") ||
      titleLower.includes("new document")
    ) {
      targetView = "approvals";
      console.log("✅ Matched: Going to APPROVALS");
    } else if (
      titleLower.includes("approved") ||
      titleLower.includes("rejected") ||
      titleLower.includes("revision")
    ) {
      targetView = "history";
      console.log("✅ Matched: Going to HISTORY");
    } else {
      console.log("✅ No match: Going to default APPROVALS");
    }

    console.log("🚀 Calling onNavigateToView('" + targetView + "')");
    try {
      onNavigateToView(targetView);
      console.log("✅ Navigation function called successfully!");
    } catch (error) {
      console.error("❌ Error calling navigation function:", error);
    }
  }

  async function markAsRead(notificationId) {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Mark as read error:", err);
    }
  }

  async function markAllRead() {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  }

  const badgeClass =
    unreadCount > 0
      ? `notification-bell-badge ${unreadCount < 10 ? "single" : "multi"}`
      : "";

  return (
    <div className="notification-wrapper" ref={dropdownRef}>
      <button
        className="notification-btn"
        onClick={handleBellClick}
        aria-label="Notifications"
      >
        <Bell />
        {unreadCount > 0 && (
          <span className={badgeClass} aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <h4>Notifications</h4>
            <div className="dropdown-actions">
              <button
                className="small-btn"
                onClick={markAllRead}
                title="Mark all as read"
              >
                Mark all
              </button>
              <button
                className="small-btn"
                onClick={() => setOpen(false)}
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="dropdown-body">
            {loading ? (
              <div className="notif-loading">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">
                <Mail size={36} />
                <p>No notifications</p>
              </div>
            ) : (
              <ul className="notif-list">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`notif-item ${n.read ? "read" : "unread"}`}
                    onClick={(e) => {
                      console.log("🖱️ List item clicked!");
                      handleNotificationClick(n);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="notif-left">
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-message">{n.message}</div>
                      {n.document_title && (
                        <div className="notif-doc">
                          Document: {n.document_title}
                        </div>
                      )}
                      <div className="notif-ts">
                        {new Date(n.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="notif-actions">
                      {!n.read && (
                        <button
                          className="tiny-btn"
                          onClick={(e) => {
                            console.log("✓ Mark as read button clicked");
                            e.stopPropagation();
                            markAsRead(n.id);
                          }}
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
