import { useState, useEffect } from "react";
import {
  FileText,
  Users,
  Clock,
  CheckCircle,
  Bell,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import UserManagement from "../components/admin/UserManagement";
import AuditLogs from "../components/admin/AuditLogs";
import DocumentStatus from "../components/admin/DocumentStatus";
import SessionIndicator from "../components/SessionIndicator";
import "./css/AdminDashboard.css";
import sanMarianoLogo from "../assets/smnhs_logo.png";

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("overview");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (activeView === "overview") {
      fetchDashboardStats();
    }
  }, [activeView]);

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

  // Updated to async logout
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const renderContent = () => {
    switch (activeView) {
      case "users":
        return <UserManagement />;
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
        {/* Stats Cards */}
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
                      <div className="activity-document">
                        {activity.document}
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

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
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
            onClick={() => setActiveView("overview")}
            className={`nav-item ${activeView === "overview" ? "active" : ""}`}
          >
            <BarChart3 className="nav-icon" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("users")}
            className={`nav-item ${activeView === "users" ? "active" : ""}`}
          >
            <Users className="nav-icon" />
            <span>User Management</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("documents")}
            className={`nav-item ${activeView === "documents" ? "active" : ""}`}
          >
            <FileText className="nav-icon" />
            <span>Document Status</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("logs")}
            className={`nav-item ${activeView === "logs" ? "active" : ""}`}
          >
            <ClipboardList className="nav-icon" />
            <span>Audit Logs</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header - Only show for overview */}
        {activeView === "overview" && (
          <header className="dashboard-header">
            <div className="header-content">
              <div className="header-left">
                <h1>Admin Dashboard</h1>
              </div>
              <div className="header-right">
                {/* Session Indicator */}
                <SessionIndicator />

                <button className="header-icon-btn">
                  <Bell />
                </button>
                <div className="user-menu">
                  <div className="user-info">
                    <span className="user-role">Administrator</span>
                    <span className="user-name">
                      {user?.username || "admin"}
                    </span>
                  </div>
                  <button onClick={handleLogout} className="logout-btn">
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>
        )}

        {renderContent()}
      </main>
    </div>
  );
}

export default AdminDashboard;
