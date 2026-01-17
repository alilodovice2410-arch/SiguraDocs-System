import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Users,
  Clock,
  CheckCircle,
  Bell,
  BarChart3,
  ClipboardList,
  Menu,
  X,
  UserCheck, // NEW: Icon for Pending Approvals
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import UserManagement from "../components/admin/UserManagement";
import AuditLogs from "../components/admin/AuditLogs";
import DocumentStatus from "../components/admin/DocumentStatus";
import PendingApprovals from "../components/admin/PendingApprovals"; // NEW: Import PendingApprovals
import SessionIndicator from "../components/SessionIndicator";
import "./css/AdminDashboard.css";
import sanMarianoLogo from "../assets/smnhs_logo.png";

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0); // NEW: Track pending count
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (activeView === "overview") {
      fetchDashboardStats();
    }
    // NEW: Fetch pending count on mount and when view changes
    fetchPendingCount();
  }, [activeView]);

  // prevent body scroll while mobile sidebar is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (sidebarOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = prev || "";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [sidebarOpen]);

  // close user dropdown when clicking outside
  useEffect(() => {
    function handleDocClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [userMenuOpen]);

  // close user dropdown on resize to avoid layout issues
  useEffect(() => {
    function onResize() {
      setUserMenuOpen(false);
      setSidebarOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get("/dashboard/stats");
      setStats(response.data.data);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Fetch pending user count
  const fetchPendingCount = async () => {
    try {
      const response = await api.get("/auth/pending-users");
      setPendingCount(response.data.count || 0);
    } catch (error) {
      console.error("Failed to fetch pending count:", error);
      setPendingCount(0);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNavClick = (view) => {
    setActiveView(view);
    // close sidebar on mobile after clicking nav
    setSidebarOpen(false);
    // Refresh pending count when navigating away from pending approvals
    if (view !== "pending") {
      fetchPendingCount();
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case "users":
        return <UserManagement />;
      case "pending": // NEW: Pending Approvals view
        return <PendingApprovals />;
      case "documents":
        return <DocumentStatus />;
      case "logs":
        return <AuditLogs />;
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => {
    if (loading) {
      return (
        <div className="dashboard-loading">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="dashboard-content-wrapper">
        {/* Stats Cards - Fixed Structure */}
        <div className="stats-grid">
          <div className="stat-card stat-card-blue">
            <div className="stat-header">
              <h3>Total Users</h3>
              <div className="stat-icon stat-icon-blue">
                <Users />
              </div>
            </div>
            <div className="stat-content">
              <p className="stat-number">{stats?.totalUsers || 0}</p>
              <p className="stat-label">Active system users</p>
            </div>
          </div>

          <div className="stat-card stat-card-green">
            <div className="stat-header">
              <h3>Active Documents</h3>
              <div className="stat-icon stat-icon-green">
                <FileText />
              </div>
            </div>
            <div className="stat-content">
              <p className="stat-number">{stats?.activeDocuments || 0}</p>
              <p className="stat-label">In the system</p>
            </div>
          </div>

          <div className="stat-card stat-card-orange">
            <div className="stat-header">
              <h3>Pending Approvals</h3>
              <div className="stat-icon stat-icon-orange">
                <Clock />
              </div>
            </div>
            <div className="stat-content">
              <p className="stat-number">{stats?.pendingApprovals || 0}</p>
              <p className="stat-label">Awaiting review</p>
            </div>
          </div>

          <div className="stat-card stat-card-purple">
            <div className="stat-header">
              <h3>Completed Today</h3>
              <div className="stat-icon stat-icon-purple">
                <CheckCircle />
              </div>
            </div>
            <div className="stat-content">
              <p className="stat-number">{stats?.completedToday || 0}</p>
              <p className="stat-label">Documents processed</p>
            </div>
          </div>
        </div>

        {/* NEW: Pending Users Alert */}
        {pendingCount > 0 && (
          <div className="pending-alert">
            <div className="pending-alert-content">
              <UserCheck size={24} />
              <div className="pending-alert-text">
                <strong>
                  {pendingCount} pending user registration
                  {pendingCount > 1 ? "s" : ""}
                </strong>
                <span>
                  Review and approve new teacher/head teacher registrations
                </span>
              </div>
              <button
                className="pending-alert-btn"
                onClick={() => handleNavClick("pending")}
              >
                Review Now
              </button>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="activity-section">
          <div className="section-header">
            <h2>Recent Activity</h2>
            <p>Latest system activities and notifications</p>
          </div>

          <div className="activity-list">
            {!stats?.recentActivities || stats.recentActivities.length === 0 ? (
              <div className="activity-empty">
                <p>No recent activity</p>
              </div>
            ) : (
              stats.recentActivities.map((activity, index) => {
                const getActivityIcon = (type) => {
                  switch (type) {
                    case "APPROVED":
                      return {
                        icon: CheckCircle,
                        className: "activity-icon-green",
                      };
                    case "USER_CREATED":
                      return {
                        icon: Users,
                        className: "activity-icon-blue",
                      };
                    case "UPLOADED":
                      return {
                        icon: FileText,
                        className: "activity-icon-purple",
                      };
                    default:
                      return { icon: Clock, className: "activity-icon-gray" };
                  }
                };

                const { icon: Icon, className } = getActivityIcon(
                  activity.type
                );

                return (
                  <div key={index} className="activity-item">
                    <div className={`activity-icon ${className}`}>
                      <Icon />
                    </div>
                    <div className="activity-details">
                      <p className="activity-title">{activity.title}</p>
                      <p className="activity-description">
                        {activity.description} • {activity.timestamp}
                      </p>
                    </div>
                    {activity.document && (
                      <div className="activity-actions">
                        <div className="activity-document">
                          {activity.document}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  // user avatar initials
  const userInitials = (user?.username || "A").slice(0, 1).toUpperCase();

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img
              src={sanMarianoLogo}
              alt="San Mariano National High School Logo"
              className="school-logo"
            />
          </div>
          <div className="sidebar-title">
            <h2>SiguraDocs</h2>
            <p>San Mariano High School</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            type="button"
            onClick={() => handleNavClick("overview")}
            className={`nav-item ${activeView === "overview" ? "active" : ""}`}
          >
            <BarChart3 className="nav-icon" />
            <span>Overview</span>
          </button>

          {/* NEW: Pending Approvals Navigation Item */}
          <button
            type="button"
            onClick={() => handleNavClick("pending")}
            className={`nav-item ${activeView === "pending" ? "active" : ""}`}
          >
            <UserCheck className="nav-icon" />
            <span>Pending Approvals</span>
            {pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick("users")}
            className={`nav-item ${activeView === "users" ? "active" : ""}`}
          >
            <Users className="nav-icon" />
            <span>User Management</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavClick("documents")}
            className={`nav-item ${activeView === "documents" ? "active" : ""}`}
          >
            <FileText className="nav-icon" />
            <span>Document Status</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavClick("logs")}
            className={`nav-item ${activeView === "logs" ? "active" : ""}`}
          >
            <ClipboardList className="nav-icon" />
            <span>Audit Logs</span>
          </button>
        </nav>
      </aside>

      {/* overlay for mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header - Show for all views */}
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              {/* mobile hamburger */}
              <button
                className="mobile-hamburger"
                onClick={() => setSidebarOpen((s) => !s)}
                aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              >
                {sidebarOpen ? <X /> : <Menu />}
              </button>

              <h1>
                {activeView === "overview" && "Admin Dashboard"}
                {activeView === "pending" && "Pending Approvals"}
                {activeView === "users" && "User Management"}
                {activeView === "documents" && "Document Status"}
                {activeView === "logs" && "Audit Logs"}
              </h1>
            </div>
            <div className="header-right" ref={userMenuRef}>
              <div className="session-wrapper">
                <SessionIndicator />
              </div>

              <button className="header-icon-btn" title="Notifications">
                <Bell />
              </button>

              {/* Desktop user menu (username + logout) */}
              <div className="user-menu desktop-only">
                <div className="user-info">
                  <span className="user-role">Administrator</span>
                  <span className="user-name">{user?.username || "admin"}</span>
                </div>
                <button onClick={handleLogout} className="logout-btn">
                  Logout
                </button>
              </div>

              {/* Mobile avatar + dropdown */}
              <div className="mobile-user">
                <button
                  className="avatar-btn"
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((s) => !s)}
                >
                  {userInitials}
                </button>

                {userMenuOpen && (
                  <div
                    className="user-dropdown"
                    role="menu"
                    aria-label="User menu"
                  >
                    <div className="dropdown-user-info">
                      <div className="dropdown-username">
                        {user?.username || "admin"}
                      </div>
                      <div className="dropdown-role">Administrator</div>
                    </div>
                    <div className="dropdown-actions">
                      <button
                        className="dropdown-logout-primary"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}

export default AdminDashboard;
