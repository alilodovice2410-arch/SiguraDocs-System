import { useState, useEffect, useRef } from "react";
import { Bell, X, Mail, Check } from "lucide-react";
import api from "../../services/api";
import "./css/NotificationBell.css";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

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
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      await fetchNotifications();
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

  // choose class based on digits: single (0-9) or multi (10+)
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
                          onClick={() => markAsRead(n.id)}
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
