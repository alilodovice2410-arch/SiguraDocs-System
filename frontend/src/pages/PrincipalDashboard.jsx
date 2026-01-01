import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Activity,
  FileText,
  Users,
  Bell,
  TrendingUp,
  BarChart3,
  Search,
  XCircle,
  Grid,
  History,
  Menu,
  X,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import SessionIndicator from "../components/SessionIndicator";
import DocumentClusters from "../components/principal/DocumentClusters";
import DocumentPreviewApproval from "../components/DocumentPreviewApproval";
import ApprovalHistory from "../components/principal/ApprovalHistory";
import Analytics from "../components/principal/Analytics";
import NotificationBell from "../components/principal/NotificationBell";
import "./css/PrincipalDashboard.css";
import "../components/principal/css/PendingApprovals.css";
import "../components/principal/css/Overview.css";
import sanMarianoLogo from "../assets/smnhs_logo.png";

function PrincipalDashboard() {
  const [stats, setStats] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [processingApproval, setProcessingApproval] = useState(null);

  // mobile sidebar open state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Signature modal states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close mobile sidebar when viewport expands past breakpoint
  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 1024 && sidebarOpen) {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sidebarOpen]);

  // Close on Escape key for better UX
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [statsResponse, approvalsResponse] = await Promise.all([
        api.get("/principal/dashboard/stats"),
        api.get("/approvals/pending"),
      ]);

      // 🔍 DEBUG: Log the complete API response
      console.log("=== DASHBOARD STATS DEBUG ===");
      console.log("Full stats response:", statsResponse.data);
      console.log("Stats data object:", statsResponse.data.data);
      console.log("Approved Total:", statsResponse.data.data?.approvedTotal);
      console.log(
        "Approved This Week:",
        statsResponse.data.data?.approvedThisWeek
      );
      console.log(
        "Pending Your Approval:",
        statsResponse.data.data?.pendingYourApproval
      );
      console.log("===========================");

      setStats(statsResponse.data.data);
      setPendingApprovals(approvalsResponse.data.approvals || []);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      console.error("Error details:", error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleApprove = (approval) => {
    setSelectedApproval(approval);
    setShowPreviewModal(true);
  };

  const handleApprovalSuccess = () => {
    fetchDashboardData();
    setSelectedApproval(null);
  };

  const handleReject = async (approvalId) => {
    const reason = prompt("Please provide a reason for rejection:");

    if (!reason || reason.trim() === "") {
      alert("Rejection reason is required");
      return;
    }

    try {
      setProcessingApproval(approvalId);

      await api.post(`/approvals/${approvalId}/reject`, {
        comments: reason,
      });

      setPendingApprovals((prev) =>
        prev.filter((a) => a.approval_id !== approvalId)
      );

      setStats((prev) => ({
        ...prev,
        pendingYourApproval: Math.max(0, (prev?.pendingYourApproval || 0) - 1),
      }));

      alert("Document rejected");
    } catch (error) {
      console.error("Rejection error:", error);
      alert(error.response?.data?.message || "Failed to reject document");
      fetchDashboardData();
    } finally {
      setProcessingApproval(null);
    }
  };

  const handleViewDocument = (documentId) => {
    navigate(`/documents/${documentId}`);
  };

  const getPriorityIcon = (priority) => {
    if (priority === "urgent" || priority === "high") {
      return <AlertCircle className="w-3 h-3" />;
    }
    return null;
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

  const filteredApprovals = pendingApprovals.filter((approval) => {
    const matchesSearch =
      approval.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      approval.submitter_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterPriority === "all" || approval.priority === filterPriority;
    return matchesSearch && matchesFilter;
  });

  const handleNavClick = (view) => {
    setActiveView(view);
    // close sidebar on mobile after clicking nav
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // compute isMobile for accessibility attributes
  const isMobile =
    typeof window !== "undefined" ? window.innerWidth <= 1024 : false;

  return (
    <div className="principal-dashboard">
      {/* Sidebar — add open class when sidebarOpen for mobile */}
      <aside
        className={`principal-sidebar ${sidebarOpen ? "open" : ""}`}
        aria-hidden={isMobile && !sidebarOpen}
      >
        <div className="sidebar-content">
          <div className="sidebar-header">
            {/* Close button inside sidebar (visible on mobile) */}
            <button
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X />
            </button>

            <div className="sidebar-logo">
              <img src={sanMarianoLogo} alt="logo" />
            </div>
            <div className="sidebar-title">
              <h2>SiguraDocs</h2>
              <p>Principal Portal</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              onClick={() => handleNavClick("overview")}
              className={`nav-item ${
                activeView === "overview" ? "active" : ""
              }`}
            >
              <BarChart3 className="nav-icon" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => handleNavClick("clusters")}
              className={`nav-item ${
                activeView === "clusters" ? "active" : ""
              }`}
            >
              <Grid className="nav-icon" />
              <span>Document Clusters</span>
            </button>

            <button
              onClick={() => handleNavClick("approvals")}
              className={`nav-item ${
                activeView === "approvals" ? "active" : ""
              }`}
            >
              <CheckCircle className="nav-icon" />
              <span>Pending Approvals</span>
              {stats?.pendingYourApproval > 0 && (
                <span
                  className={`notification-badge ${
                    stats.pendingYourApproval >= 10 ? "multi" : "single"
                  }`}
                >
                  {stats.pendingYourApproval}
                </span>
              )}
            </button>

            <button
              onClick={() => handleNavClick("history")}
              className={`nav-item ${activeView === "history" ? "active" : ""}`}
            >
              <History className="nav-icon" />
              <span>Approval History</span>
            </button>

            <button
              onClick={() => handleNavClick("analytics")}
              className={`nav-item ${
                activeView === "analytics" ? "active" : ""
              }`}
            >
              <TrendingUp className="nav-icon" />
              <span>Analytics</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* mobile backdrop (placed after the sidebar so it's visually behind the sidebar reliably) */}
      <div
        className={`mobile-backdrop ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      {/* Main Content */}
      <main className="principal-main">
        {/* Header */}
        <header className="principal-header">
          <div className="header-content">
            <div className="header-left">
              {/* hamburger for mobile */}
              <button
                className="hamburger-btn"
                aria-label={sidebarOpen ? "Close menu" : "Open menu"}
                aria-expanded={!!sidebarOpen}
                onClick={() => setSidebarOpen((s) => !s)}
              >
                {sidebarOpen ? <X /> : <Menu />}
              </button>

              <h1>
                {activeView === "overview" && "Principal Dashboard"}
                {activeView === "clusters" && "Principal Dashboard"}
                {activeView === "approvals" && "Principal Dashboard"}
                {activeView === "history" && "Principal Dashboard"}
                {activeView === "analytics" && "Principal Dashboard"}
              </h1>
            </div>

            <div className="header-right">
              <SessionIndicator />

              <NotificationBell />

              <div className="header-user-info">
                <div className="header-user-details">
                  <p className="header-user-name">
                    {user?.full_name || "principal"}
                  </p>
                  <p className="header-user-role">
                    {user?.role_name || "Principal"}
                  </p>
                </div>
              </div>

              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {/* Overview View */}
          {activeView === "overview" && (
            <>
              {/* Modern Stats Grid - 4 Cards */}
              <div
                className="stats-grid-modern"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "1.5rem",
                  marginBottom: "2rem",
                }}
              >
                {/* Pending Review Card */}
                <div className="stat-card-modern stat-orange">
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

                {/* Total Documents Card */}
                <div className="stat-card-modern stat-blue">
                  <div className="stat-card-header-modern">
                    <div className="stat-info-modern">
                      <div className="stat-count-modern">
                        {stats?.totalDocuments || 0}
                      </div>
                      <div className="stat-label-modern">Total Documents</div>
                      <div className="stat-description-modern">
                        All submitted documents
                      </div>
                    </div>
                    <div className="stat-icon-modern stat-icon-blue">
                      <FileText />
                    </div>
                  </div>
                </div>

                {/* Approved Card */}
                <div className="stat-card-modern stat-green">
                  <div className="stat-card-header-modern">
                    <div className="stat-info-modern">
                      <div className="stat-count-modern">
                        {stats?.approvedTotal || 0}
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

                {/* Rejected Card - NEW */}
                <div className="stat-card-modern stat-red">
                  <div className="stat-card-header-modern">
                    <div className="stat-info-modern">
                      <div className="stat-count-modern">
                        {stats?.rejectedTotal || 0}
                      </div>
                      <div className="stat-label-modern">Rejected</div>
                      <div className="stat-description-modern">
                        Documents rejected
                      </div>
                    </div>
                    <div className="stat-icon-modern stat-icon-red">
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
                  onClick={() => handleNavClick("clusters")}
                >
                  <div className="action-content-modern">
                    <div className="action-icon-wrapper-modern action-blue">
                      <Activity />
                    </div>
                    <div className="action-details-modern">
                      <h3 className="action-title-modern">Document Clusters</h3>
                      <p className="action-description-modern">
                        View organized document groups and analytics
                      </p>
                      <button className="action-button-modern">
                        <span>View Clusters</span>
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
                  {!pendingApprovals || pendingApprovals.length === 0 ? (
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
                    pendingApprovals.slice(0, 3).map((doc) => (
                      <div
                        key={doc.approval_id}
                        className="document-item-modern"
                        onClick={() =>
                          navigate(`/documents/${doc.document_id}`)
                        }
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
                              // don't let the parent document click handler run
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
            </>
          )}

          {/* Clusters View */}
          {activeView === "clusters" && <DocumentClusters />}

          {/* History View - Now using the imported component */}
          {activeView === "history" && <ApprovalHistory />}

          {/* Approvals View */}
          {activeView === "approvals" && (
            <div className="approvals-view">
              {/* ... approvals view content unchanged ... */}
              <div className="approvals-header-modern">
                <div className="approvals-header-content">
                  <div className="approvals-header-left">
                    <h1 className="approvals-page-title">Pending Approvals</h1>
                    <p className="approvals-page-subtitle">
                      {filteredApprovals.length}{" "}
                      {filteredApprovals.length === 1
                        ? "document"
                        : "documents"}{" "}
                      awaiting your review
                    </p>
                  </div>
                  <div className="approvals-header-right">
                    <div className="approval-count-badge">
                      <div>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            opacity: 0.9,
                            marginBottom: "0.25rem",
                          }}
                        >
                          Pending
                        </div>
                        <div className="approval-count-number">
                          {filteredApprovals.length}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modern Search & Filter */}
              <div className="search-filter-modern">
                <div className="search-filter-grid">
                  <div className="search-box-modern">
                    <Search className="search-icon-modern" />
                    <input
                      type="text"
                      placeholder="Search by document title or submitter name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input-modern"
                    />
                  </div>
                  <div className="filter-group-modern">
                    <span className="filter-label-modern">Filter:</span>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="filter-select-modern"
                    >
                      <option value="all">All Priorities</option>
                      <option value="urgent">🔴 Urgent</option>
                      <option value="high">🟠 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="normal">🔵 Normal</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Approvals list */}
              {filteredApprovals.length === 0 ? (
                <div className="empty-state-modern">
                  <div className="empty-icon-modern">
                    <CheckCircle />
                  </div>
                  <h2 className="empty-title-modern">All Caught Up!</h2>
                  <p className="empty-description-modern">
                    There are no pending approvals at the moment. Great work
                    keeping things moving!
                  </p>
                </div>
              ) : (
                <div className="approvals-grid-modern">
                  {filteredApprovals.map((approval) => (
                    <div
                      key={approval.approval_id}
                      className="approval-card-modern"
                    >
                      <div className="approval-card-content">
                        <div className="approval-card-header-modern">
                          <div className="approval-doc-icon-modern">
                            <FileText />
                          </div>
                          <div className="approval-title-area">
                            <h3 className="approval-title-modern">
                              {approval.title}
                              <span
                                className={`priority-badge-modern ${
                                  approval.priority === "urgent"
                                    ? "priority-urgent-modern"
                                    : approval.priority === "high"
                                    ? "priority-high-modern"
                                    : "priority-normal-modern"
                                }`}
                              >
                                {getPriorityIcon(approval.priority)}
                                {approval.priority?.toUpperCase()}
                              </span>
                            </h3>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.375rem 0.875rem",
                                background: "rgba(251, 146, 60, 0.2)",
                                border: "1px solid rgba(251, 146, 60, 0.3)",
                                borderRadius: "8px",
                                fontSize: "0.813rem",
                                fontWeight: "500",
                                color: "#fdba74",
                              }}
                            >
                              {approval.document_type}
                            </span>
                          </div>
                        </div>

                        <div className="approval-meta-modern">
                          <div className="meta-item-modern">
                            <Users className="meta-icon-modern" />
                            <div className="meta-content-modern">
                              <div className="meta-label-modern">
                                Uploaded by
                              </div>
                              <div className="meta-value-modern">
                                {approval.submitter_name}
                              </div>
                            </div>
                          </div>

                          <div className="meta-item-modern">
                            <Clock className="meta-icon-modern" />
                            <div className="meta-content-modern">
                              <div className="meta-label-modern">
                                Upload date
                              </div>
                              <div className="meta-value-modern">
                                {formatDate(approval.created_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="approval-actions-modern">
                        <button
                          onClick={() =>
                            handleViewDocument(approval.document_id)
                          }
                          className="approval-btn-modern btn-view-modern"
                          disabled={processingApproval === approval.approval_id}
                        >
                          <Eye />
                          View
                        </button>
                        <button
                          onClick={() => handleApprove(approval)}
                          className="approval-btn-modern btn-approve-modern"
                          disabled={processingApproval === approval.approval_id}
                        >
                          {processingApproval === approval.approval_id ? (
                            <>
                              <div
                                className="loading-spinner-modern"
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  borderWidth: "2px",
                                }}
                              />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle />
                              Approve
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleReject(approval.approval_id)}
                          className="approval-btn-modern btn-reject-modern"
                          disabled={processingApproval === approval.approval_id}
                        >
                          <XCircle />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analytics View: render the dedicated Analytics component */}
          {activeView === "analytics" && <Analytics />}
        </div>
      </main>

      {/* DocumentPreviewApproval modal */}
      <DocumentPreviewApproval
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setSelectedApproval(null);
        }}
        approval={selectedApproval}
        onSuccess={handleApprovalSuccess}
      />
    </div>
  );
}

export default PrincipalDashboard;
