import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, X, Mail, Check } from "lucide-react";
import api from "../../services/api";
import "./css/NotificationBell.css";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);

  const buttonRef = useRef(null); // bell button ref
  const dropdownRef = useRef(null); // dropdown root ref (in portal)

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Position dropdown relative to bell button (clamped to viewport)
  const positionDropdown = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    // desired width (clamp to viewport)
    const maxWidth = Math.min(400, window.innerWidth - 16);
    const width = maxWidth;

    // right-align dropdown to bell's right edge by default
    let left = rect.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }

    // place slightly below the bell
    const top = rect.bottom + 8;

    setDropdownStyle({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      position: "fixed",
      zIndex: 99999,
    });
  }, []);

  useEffect(() => {
    if (open) {
      positionDropdown();
      window.addEventListener("resize", positionDropdown);
      window.addEventListener("scroll", positionDropdown, { passive: true });
    } else {
      window.removeEventListener("resize", positionDropdown);
      window.removeEventListener("scroll", positionDropdown);
    }
    return () => {
      window.removeEventListener("resize", positionDropdown);
      window.removeEventListener("scroll", positionDropdown);
    };
  }, [open, positionDropdown]);

  // click outside to close (works across portal boundaries)
  useEffect(() => {
    function handleClickOutside(e) {
      const target = e.target;
      const clickedInsideButton =
        buttonRef.current && buttonRef.current.contains(target);
      const clickedInsideDropdown =
        dropdownRef.current && dropdownRef.current.contains(target);
      if (!clickedInsideButton && !clickedInsideDropdown) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
            (res.data.notifications || []).filter((n) => !n.read).length,
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
      // ensure positioning runs after layout
      setTimeout(() => positionDropdown(), 0);
    }
  }

  async function markAsRead(notificationId) {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
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

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="notification-dropdown"
      style={
        dropdownStyle || {
          top: "8px",
          right: "8px",
          width: "360px",
          position: "fixed",
          zIndex: 99999,
        }
      }
    >
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
                  // default click simply closes dropdown; navigation handled upstream if needed
                  e.stopPropagation();
                  if (!n.read) markAsRead(n.id);
                  setOpen(false);
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
  );

  return (
    <>
      <div className="notification-wrapper">
        <button
          ref={buttonRef}
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
      </div>

      {typeof document !== "undefined" && open
        ? createPortal(dropdownContent, document.body)
        : null}
    </>
  );
}
