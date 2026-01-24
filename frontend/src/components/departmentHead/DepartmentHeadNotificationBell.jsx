import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, X, Mail, Check } from "lucide-react";
import api from "../../services/api";
import "./css/DepartmentHeadNotificationBell.css";

export default function DeptHeadNotificationBell({ onNavigateToView }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);

  const buttonRef = useRef(null); // reference to the bell button
  const dropdownRef = useRef(null); // reference to the dropdown (portal)

  // Debug logs (optional)
  useEffect(() => {
    // console.log("🔔 NotificationBell mounted, prop onNavigateToView:", onNavigateToView);
  }, [onNavigateToView]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // reposition dropdown when open & on resize/scroll
  const positionDropdown = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    // desired dropdown width (can be adjusted)
    const maxWidth = Math.min(400, window.innerWidth - 16);
    const width = maxWidth;

    // Align dropdown right edge to the bell's right edge, but clamp to viewport
    let left = rect.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8)
      left = window.innerWidth - width - 8;

    const top = rect.bottom + 8; // 8px gap below button

    setDropdownStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
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
      if (open) {
        const clickedInsideButton =
          buttonRef.current && buttonRef.current.contains(target);
        const clickedInsideDropdown =
          dropdownRef.current && dropdownRef.current.contains(target);
        if (!clickedInsideButton && !clickedInsideDropdown) {
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
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
      // position after notifications are fetched so dropdown width/height CSS has applied
      setTimeout(() => {
        positionDropdown();
      }, 0);
    }
  }

  function determineTargetViewFromTitle(title = "") {
    const titleLower = title.toLowerCase();
    if (
      titleLower.includes("submitted") ||
      titleLower.includes("review") ||
      titleLower.includes("pending") ||
      titleLower.includes("new document")
    ) {
      return "approvals";
    } else if (
      titleLower.includes("approved") ||
      titleLower.includes("rejected") ||
      titleLower.includes("revision")
    ) {
      return "history";
    } else {
      return "approvals";
    }
  }

  function handleNotificationClick(notification) {
    if (!notification) return;
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setOpen(false);

    if (!onNavigateToView) {
      console.error("onNavigateToView prop is not provided");
      return;
    }

    const targetView = determineTargetViewFromTitle(notification.title || "");
    try {
      onNavigateToView(targetView);
    } catch (err) {
      console.error("Error calling onNavigateToView:", err);
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

  // Dropdown content (kept as function to reuse both in portal and fallback)
  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="notification-dropdown"
      style={
        dropdownStyle || {
          position: "fixed",
          top: "8px",
          right: "8px",
          width: "360px",
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
                  e.stopPropagation();
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

      {/* render portal only on client */}
      {typeof document !== "undefined" && open
        ? createPortal(dropdownContent, document.body)
        : null}
    </>
  );
}
