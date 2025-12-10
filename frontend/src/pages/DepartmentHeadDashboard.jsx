import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  FolderOpen,
  Activity,
  LayoutDashboard,
  Bell,
  LogOut,
  GraduationCap,
  History,
  Menu,
  X,
} from "lucide-react";
import api from "../services/api";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import HeadTeacherApprovals from "../components/departmentHead/DepartmentHeadPendingApprovals";
import DepartmentHeadApprovalHistory from "../components/departmentHead/DepartmentHeadApprovalHistory";
import DepartmentHeadDocuments from "../components/departmentHead/DepartmentHeadDocuments";
import DepartmentHeadNotificationBell from "../components/departmentHead/DepartmentHeadNotificationBell";
import DepartmentHeadAnalytics from "../components/departmentHead/DepartmentHeadAnalytics";
import ProfilePictureModal from "../components/ProfilePictureModal";
import sanMarianoLogo from "../assets/smnhs_logo.png";
import { BarChart2 } from "lucide-react";
import "../pages/css/DepartmentHeadDashboard.css";

function DepartmentHeadDashboard() {
  // Get user FIRST before using it
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // NOW we can use user in state initialization
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState(
    user?.profile_picture || null
  );

  useEffect(() => {
    fetchDashboardStats();
    fetchRecentDocuments();
  }, []);

  // Close mobile sidebar when viewport expands
  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 1024 && sidebarOpen) {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sidebarOpen]);

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

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

  const fetchRecentDocuments = async () => {
    try {
      const response = await api.get("/approvals/pending");
      setRecentDocuments(response.data.approvals?.slice(0, 3) || []);
    } catch (error) {
      console.error("Failed to fetch recent documents:", error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleNavClick = (view) => {
    console.log("Navigating to view:", view);
    setActiveView(view);
    setSidebarOpen(false);
  };

  // Handler for notification navigation - FIXED TO MATCH PROP NAME
  const handleNavigateFromNotification = (view = "approvals") => {
    console.log("🔔 Navigation triggered from notification to:", view);
    setActiveView(view);
    setSidebarOpen(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleProfilePictureUpdate = async (newPicture) => {
    try {
      if (newPicture === null) {
        // Remove picture
        await api.delete("/profile/remove-picture");
        setProfilePicture(null);
      } else {
        // Upload new picture
        const response = await api.post("/profile/upload-picture", {
          profile_picture: newPicture,
        });
        setProfilePicture(response.data.profile_picture);
      }
    } catch (error) {
      console.error("Failed to update profile picture:", error);
      throw error;
    }
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Overview", view: "overview" },
    {
      icon: Eye,
      label: "Pending Approvals",
      view: "approvals",
      badge: stats?.pendingYourApproval,
    },
    { icon: FolderOpen, label: "Documents", view: "documents" },
    { icon: BarChart2, label: "Analytics", view: "analytics" },
    { icon: History, label: "Approval History", view: "history" },
  ];

  if (loading) {
    return (
      <div className="depthead-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const isMobile =
    typeof window !== "undefined" ? window.innerWidth <= 1024 : false;

  return (
    <div className="depthead-dashboard">
      {/* Sidebar */}
      <aside
        className={`depthead-sidebar ${sidebarOpen ? "open" : ""}`}
        aria-hidden={isMobile && !sidebarOpen}
      >
        <div className="sidebar-content">
          <div className="sidebar-header">
            {/* Close button for mobile */}
            <button
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X />
            </button>

            <div className="sidebar-logo">
              <img src={sanMarianoLogo} className="logo-icon" />
            </div>
            <div className="sidebar-title">
              <h2>SiguraDocs</h2>
              <p>Department Head Portal</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item.view}
                className={`nav-item ${
                  activeView === item.view ? "active" : ""
                }`}
                onClick={() => handleNavClick(item.view)}
              >
                <item.icon className="nav-icon" />
                {item.label}
                {item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Logout at bottom (kept for mobile only) */}
        <div className="sidebar-footer">
          <button className="logout-btn-sidebar" onClick={handleLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      <div
        className={`mobile-backdrop ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      {/* Main Content */}
      <main
        className={`depthead-main ${
          activeView === "approvals" ? "approvals-active" : ""
        }`}
      >
        {/* Header */}
        <header className="depthead-header">
          <div className="header-content">
            <div className="header-left">
              {/* Hamburger for mobile */}
              <button
                className="hamburger-btn"
                aria-label={sidebarOpen ? "Close menu" : "Open menu"}
                aria-expanded={!!sidebarOpen}
                onClick={() => setSidebarOpen((s) => !s)}
              >
                {sidebarOpen ? <X /> : <Menu />}
              </button>

              <h1>
                {activeView === "overview" && "Department Head Dashboard"}
                {activeView === "approvals" && "Department Head Dashboard"}
                {activeView === "documents" && "Department Head Dashboard"}
                {activeView === "history" && "Department Head Dashboard"}
                {activeView === "analytics" && "Department Head Dashboard"}
              </h1>
            </div>
            <div className="header-right">
              <DepartmentHeadNotificationBell
                onNavigateToView={(view) => {
                  console.log("🔔 Inline navigation to:", view);
                  setActiveView(view);
                  setSidebarOpen(false);
                }}
              />

              {/* User Info in Header */}
              <div
                className="sidebar-user-info header-user-inline"
                onClick={() => setProfileModalOpen(true)}
                style={{ cursor: "pointer" }}
              >
                <div className="user-avatar">
                  {profilePicture ? (
                    <img
                      src={profilePicture}
                      alt="Profile"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                      }}
                    />
                  ) : (
                    user?.full_name?.charAt(0) || "H"
                  )}
                </div>
                <div className="user-details">
                  <span className="user-name">
                    {user?.full_name || "Head Teacher"}
                  </span>
                  <span className="user-dept">
                    {user?.subject
                      ? `${user.subject}`
                      : user?.department || "Department"}
                  </span>
                </div>
              </div>

              {/* Logout button in header */}
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content - Overview */}
        {activeView === "overview" && (
          <div className="dashboard-content">
            {/* Modern Stats Grid */}
            <div className="stats-grid-modern">
              <div
                className="stat-card-modern stat-orange clickable"
                onClick={() => handleNavClick("approvals")}
              >
                <div className="stat-card-header-modern">
                  <div className="stat-info-modern">
                    <div className="stat-count-modern">
                      {stats?.pendingYourApproval || 0}
                    </div>
                    <div className="stat-label-modern">Pending Review</div>
                    <div className="stat-description-modern">
                      Documents awaiting review
                    </div>
                  </div>
                  <div className="stat-icon-modern stat-icon-orange">
                    <Clock />
                  </div>
                </div>
              </div>

              <div className="stat-card-modern stat-blue">
                <div className="stat-card-header-modern">
                  <div className="stat-info-modern">
                    <div className="stat-count-modern">
                      {stats?.departmentDocuments || 0}
                    </div>
                    <div className="stat-label-modern">Total Documents</div>
                    <div className="stat-description-modern">
                      All department documents
                    </div>
                  </div>
                  <div className="stat-icon-modern stat-icon-blue">
                    <FileText />
                  </div>
                </div>
              </div>

              <div className="stat-card-modern stat-green">
                <div className="stat-card-header-modern">
                  <div className="stat-info-modern">
                    <div className="stat-count-modern">
                      {stats?.approvedThisMonth || 0}
                    </div>
                    <div className="stat-label-modern">Approved</div>
                    <div className="stat-description-modern">
                      Successfully approved
                    </div>
                  </div>
                  <div className="stat-icon-modern stat-icon-green">
                    <CheckCircle />
                  </div>
                </div>
              </div>

              <div className="stat-card-modern stat-purple">
                <div className="stat-card-header-modern">
                  <div className="stat-info-modern">
                    <div className="stat-count-modern">
                      {stats?.rejected || 0}
                    </div>
                    <div className="stat-label-modern">Rejected</div>
                    <div className="stat-description-modern">
                      Needs revision
                    </div>
                  </div>
                  <div className="stat-icon-modern stat-icon-purple">
                    <XCircle />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions-modern">
              <div
                className="action-card-modern"
                onClick={() => handleNavClick("approvals")}
                style={{ position: "relative" }}
              >
                <div className="action-content-modern">
                  <div className="action-icon-wrapper-modern">
                    <Eye />
                  </div>
                  <div className="action-details-modern">
                    <h3 className="action-title-modern">Pending Approvals</h3>
                    <p className="action-description-modern">
                      Review documents awaiting your approval
                    </p>
                    <button className="action-button-modern">
                      <span>View Approvals</span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                {stats?.pendingYourApproval > 0 && (
                  <div className="action-badge-modern">
                    {stats.pendingYourApproval}
                  </div>
                )}
              </div>

              <div
                className="action-card-modern"
                onClick={() => handleNavClick("documents")}
              >
                <div className="action-content-modern">
                  <div className="action-icon-wrapper-modern action-blue">
                    <FolderOpen />
                  </div>
                  <div className="action-details-modern">
                    <h3 className="action-title-modern">
                      Department Documents
                    </h3>
                    <p className="action-description-modern">
                      View all documents in your department
                    </p>
                    <button className="action-button-modern">
                      <span>View Documents</span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Documents Section */}
            <div className="recent-documents-modern">
              <div className="recent-header-modern">
                <h2 className="recent-title-modern">Recent Documents</h2>
                <p className="recent-subtitle-modern">
                  Latest submissions requiring attention
                </p>
              </div>

              <div className="recent-list-modern">
                {!recentDocuments || recentDocuments.length === 0 ? (
                  <div className="empty-state-modern-overview">
                    <div className="empty-icon-wrapper-modern">
                      <FileText />
                    </div>
                    <h3 className="empty-title-overview">
                      No Recent Documents
                    </h3>
                    <p className="empty-description-overview">
                      Documents will appear here as they are submitted
                    </p>
                  </div>
                ) : (
                  recentDocuments.map((doc) => (
                    <div
                      key={doc.approval_id}
                      className="document-item-modern"
                      onClick={() => navigate(`/documents/${doc.document_id}`)}
                    >
                      <div className="doc-icon-wrapper-modern">
                        <FileText />
                      </div>
                      <div className="doc-info-modern">
                        <h3 className="doc-title-modern">{doc.title}</h3>
                        <div className="doc-meta-modern">
                          <span>By {doc.submitter_name}</span>
                          <span>•</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                      </div>
                      <div className="doc-status-modern">
                        <span className="status-badge-modern status-pending-modern">
                          Pending
                        </span>
                        <button
                          className="review-btn-modern"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavClick("approvals");
                          }}
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approvals View */}
        {activeView === "approvals" && <HeadTeacherApprovals />}

        {/* Documents View */}
        {activeView === "documents" && (
          <div className="dashboard-content">
            <DepartmentHeadDocuments />
          </div>
        )}

        {/* History View */}
        {activeView === "history" && (
          <div className="dashboard-content approvals-view">
            <DepartmentHeadApprovalHistory />
          </div>
        )}

        {/*Analytics View */}
        {activeView === "analytics" && (
          <div className="dashboard-content">
            <DepartmentHeadAnalytics />
          </div>
        )}
      </main>

      {/* Profile Picture Modal - Place outside of main to avoid z-index issues */}
      <ProfilePictureModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentPicture={profilePicture}
        onUpdate={handleProfilePictureUpdate}
      />
    </div>
  );
}

export default DepartmentHeadDashboard;
