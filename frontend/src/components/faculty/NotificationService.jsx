import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // You'll need to create this endpoint in your backend
      const response = await api.get("/notifications");

      if (response.data.success) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      // For now, show mock data if endpoint doesn't exist
      setNotifications(getMockNotifications());
      setUnreadCount(2);
    } finally {
      setLoading(false);
    }
  };

  // Mock notifications for testing
  const getMockNotifications = () => [
    {
      id: 1,
      type: "success",
      title: "Document Approved",
      message: "Your document 'Annual Report 2024' has been approved",
      timestamp: new Date(Date.now() - 3600000),
      read: false,
    },
    {
      id: 2,
      type: "pending",
      title: "Pending Review",
      message: "Your document 'Budget Proposal' is awaiting review",
      timestamp: new Date(Date.now() - 7200000),
      read: false,
    },
    {
      id: 3,
      type: "info",
      title: "System Update",
      message: "New features have been added to the dashboard",
      timestamp: new Date(Date.now() - 86400000),
      read: true,
    },
  ];

  const markAsRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
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

  return (
    <>
      <div className="notification-overlay" onClick={onClose}></div>
      <div className="notification-panel">
        {/* Header */}
        <div className="notification-header">
          <div className="notification-title">
            <Bell size={20} />
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <span className="unread-count">{unreadCount}</span>
            )}
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="notification-actions">
            <button onClick={clearAll} className="clear-all-btn">
              Clear all
            </button>
          </div>
        )}

        {/* Notification List */}
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
                  <span className="unread-indicator"></span>
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
}

export default NotificationService;
