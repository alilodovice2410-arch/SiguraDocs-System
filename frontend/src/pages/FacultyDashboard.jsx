import { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Bell,
  Folder,
  BarChart3,
  Eye,
  Download,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Menu,
  X,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import UploadDocument from "../components/faculty/UploadDocument";
import NotificationService from "../components/faculty/NotificationService";
import SessionIndicator from "../components/SessionIndicator";
import sanMarianoLogo from "../assets/smnhs_logo.png";
import "./css/FacultyDashboard.css";

function FacultyDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeView, setActiveView] = useState("overview");
  const [documents, setDocuments] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    if (activeView === "documents") {
      fetchAllDocuments();
    }
  }, [activeView, filterStatus]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const statsResponse = await api.get("/dashboard/stats");
      console.log("Dashboard stats:", statsResponse.data.data);
      setStats(statsResponse.data.data);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDocuments = async () => {
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const response = await api.get("/documents", { params });
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleUploadSuccess = () => {
    fetchDashboardStats();
    if (activeView === "documents") {
      fetchAllDocuments();
    }
  };

  const formatStatus = (status) => {
    if (!status) return "Unknown";
    return status.replace(/_/g, " ");
  };

  const handleDocumentClick = (docId) => {
    navigate(`/documents/${docId}`);
  };

  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "pending":
        return <Clock className="status-icon" />;
      case "in_review":
      case "in review":
        return <AlertCircle className="status-icon" />;
      case "approved":
        return <CheckCircle className="status-icon" />;
      case "rejected":
        return <XCircle className="status-icon" />;
      default:
        return <FileText className="status-icon" />;
    }
  };

  const getStatusClass = (status) => {
    const statusLower = status?.toLowerCase() || "";
    switch (statusLower) {
      case "pending":
        return "status-badge-glass status-pending-glass";
      case "in_review":
      case "in review":
        return "status-badge-glass status-review-glass";
      case "approved":
        return "status-badge-glass status-approved-glass";
      case "rejected":
        return "status-badge-glass status-rejected-glass";
      default:
        return "status-badge-glass status-default-glass";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const extractFilename = (disposition, fallback) => {
    if (!disposition) return fallback;
    const filenameMatch =
      /filename\*=(?:UTF-8'')?([^;]+)|filename=\"?([^\";]+)\"?/i.exec(
        disposition
      );
    if (filenameMatch) {
      const raw = filenameMatch[1] || filenameMatch[2];
      if (raw) {
        try {
          return decodeURIComponent(raw.replace(/(^"|"$)/g, ""));
        } catch (e) {
          return raw.replace(/(^"|"$)/g, "");
        }
      }
    }
    return fallback;
  };

  const handleDownload = async (doc) => {
    try {
      const response = await api.get(`/documents/${doc.document_id}/download`, {
        responseType: "blob",
      });

      if (!response.data || !(response.data instanceof Blob)) {
        throw new Error("Invalid response format");
      }

      if (
        response.data.size < 500 &&
        response.data.type === "application/json"
      ) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || "Download failed");
      }

      const headers = response.headers || {};
      const contentType = (headers["content-type"] || "").toLowerCase();
      const disposition = headers["content-disposition"] || "";
      let filename =
        doc.original_file_name ||
        doc.file_name ||
        `document_${doc.document_id}`;

      filename = extractFilename(disposition, filename);

      if (
        contentType.includes("pdf") &&
        !filename.toLowerCase().endsWith(".pdf")
      ) {
        const base = filename.includes(".")
          ? filename.replace(/\.[^/.]+$/, "")
          : filename;
        filename = `${base}.pdf`;
      }

      const blob = new Blob([response.data], {
        type: contentType || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      console.log("Download successful:", filename);
    } catch (error) {
      console.error("Download error:", error);

      let errorMsg = "Failed to download document. ";
      if (error.response?.data?.message) {
        errorMsg += error.response.data.message;
      } else if (error.message) {
        errorMsg += error.message;
      } else {
        errorMsg += "Please try again.";
      }

      alert(errorMsg);
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="faculty-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="faculty-dashboard">
      {/* Mobile Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${mobileMenuOpen ? "active" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      ></div>

      {/* Sidebar */}
      <aside
        className={`faculty-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}
      >
        <div className="sidebar-content">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img
                src={sanMarianoLogo}
                alt="San Mariano National High School Logo"
                className="school-logo"
              />
              <div className="logo-icon"></div>
            </div>
            <div className="sidebar-title">
              <h2>SiguraDocs</h2>
              <p>San Mariano High School</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              onClick={() => {
                setActiveView("overview");
                setMobileMenuOpen(false);
              }}
              className={`nav-item ${
                activeView === "overview" ? "active" : ""
              }`}
            >
              <BarChart3 className="nav-icon" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => {
                setShowUploadModal(true);
                setMobileMenuOpen(false);
              }}
              className="nav-item"
            >
              <Upload className="nav-icon" />
              <span>Upload Document</span>
            </button>
            <button
              onClick={() => {
                setActiveView("documents");
                setMobileMenuOpen(false);
              }}
              className={`nav-item ${
                activeView === "documents" ? "active" : ""
              }`}
            >
              <Folder className="nav-icon" />
              <span>My Documents</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="faculty-main">
        {/* Header */}
        <header className="faculty-header">
          <div className="header-content">
            <div className="header-left">
              <button
                className="mobile-menu-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
              <h1>
                {activeView === "overview"
                  ? "Faculty Dashboard"
                  : "My Documents"}
              </h1>
            </div>

            <div className="header-right">
              <SessionIndicator />
              <button
                className="header-icon-btn"
                onClick={() => setShowNotifications(true)}
              >
                <Bell />
                <span className="notification-badge"></span>
              </button>

              <div className="user-menu">
                <div className="user-info">
                  <span className="user-role">Faculty</span>
                  <span className="user-name">
                    {user?.full_name || "Faculty User"}
                  </span>
                </div>
                <button onClick={handleLogout} className="logout-btn">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content - Overview */}
        {activeView === "overview" && (
          <div className="dashboard-content">
            {/* Modern Stats Grid - 4 Cards */}
            <div className="stats-grid-modern">
              <div className="stat-card-modern stat-blue">
                <div className="stat-card-header-modern">
                  <div className="stat-info-modern">
                    <div className="stat-count-modern">
                      {stats?.totalDocuments || 0}
                    </div>
                    <div className="stat-label-modern">Total Uploaded</div>
                    <div className="stat-description-modern">
                      Documents submitted
                    </div>
                  </div>
                  <div className="stat-icon-modern stat-icon-blue">
                    <FileText />
                  </div>
                </div>
              </div>

              <div className="stat-card-modern stat-orange">
                <div className="stat-card-header-modern">
                  <div className="stat-info-modern">
                    <div className="stat-count-modern">
                      {stats?.pending || 0}
                    </div>
                    <div className="stat-label-modern">Pending Review</div>
                    <div className="stat-description-modern">
                      Awaiting approval
                    </div>
                  </div>
                  <div className="stat-icon-modern stat-icon-orange">
                    <Clock />
                  </div>
                </div>
              </div>

              <div className="stat-card-modern stat-green">
                <div className="stat-card-header-modern">
                  <div className="stat-info-modern">
                    <div className="stat-count-modern">
                      {stats?.approved || 0}
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

              <div className="stat-card-modern stat-red">
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
                onClick={() => setShowUploadModal(true)}
              >
                <div className="action-content-modern">
                  <div className="action-icon-wrapper-modern">
                    <Upload />
                  </div>
                  <div className="action-details-modern">
                    <h3 className="action-title-modern">Upload Document</h3>
                    <p className="action-description-modern">
                      Submit a new document for review and approval
                    </p>
                    <button className="action-button-modern">
                      <span>Upload Now</span>
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

              <div
                className="action-card-modern"
                onClick={() => setActiveView("documents")}
              >
                <div className="action-content-modern">
                  <div className="action-icon-wrapper-modern action-blue">
                    <Folder />
                  </div>
                  <div className="action-details-modern">
                    <h3 className="action-title-modern">My Documents</h3>
                    <p className="action-description-modern">
                      View and manage all your document submissions
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
                  Your latest document submissions and their status
                </p>
              </div>

              <div className="recent-list-modern">
                {!stats?.recentDocuments ||
                stats.recentDocuments.length === 0 ? (
                  <div className="empty-state-modern-overview">
                    <div className="empty-icon-wrapper-modern">
                      <FileText />
                    </div>
                    <h3 className="empty-title-overview">No documents yet</h3>
                    <p className="empty-description-overview">
                      Upload your first document to get started!
                    </p>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="upload-btn-modern"
                    >
                      <Upload />
                      <span>Upload Document</span>
                    </button>
                  </div>
                ) : (
                  stats.recentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="document-item-modern"
                      onClick={() => handleDocumentClick(doc.id)}
                    >
                      <div className="doc-icon-wrapper-modern">
                        <FileText />
                      </div>
                      <div className="doc-info-modern">
                        <h3 className="doc-title-modern">{doc.title}</h3>
                        <div className="doc-meta-modern">
                          <span>{doc.type}</span>
                          <span>•</span>
                          <span>{doc.date}</span>
                        </div>
                      </div>
                      <div className="doc-status-modern">
                        <span
                          className={`status-badge-modern status-${doc.status
                            .toLowerCase()
                            .replace(/ /g, "-")
                            .replace(/_/g, "-")}`}
                        >
                          {formatStatus(doc.status)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* My Documents View - Full Featured */}
        {activeView === "documents" && (
          <div className="dashboard-content">
            {/* Stats Summary */}
            <div className="stats-summary-glass">
              <div className="stat-item-glass stat-item-blue">
                <div className="stat-icon-glass stat-icon-blue-glass">
                  <FileText />
                </div>
                <div className="stat-info-glass">
                  <span className="stat-value-glass">{documents.length}</span>
                  <span className="stat-label-glass">Total Documents</span>
                </div>
              </div>

              <div className="stat-item-glass stat-item-orange">
                <div className="stat-icon-glass stat-icon-orange-glass">
                  <Clock />
                </div>
                <div className="stat-info-glass">
                  <span className="stat-value-glass">
                    {documents.filter((d) => d.status === "pending").length}
                  </span>
                  <span className="stat-label-glass">Pending Review</span>
                </div>
              </div>

              <div className="stat-item-glass stat-item-green">
                <div className="stat-icon-glass stat-icon-green-glass">
                  <CheckCircle />
                </div>
                <div className="stat-info-glass">
                  <span className="stat-value-glass">
                    {documents.filter((d) => d.status === "approved").length}
                  </span>
                  <span className="stat-label-glass">Approved</span>
                </div>
              </div>

              <div className="stat-item-glass stat-item-red">
                <div className="stat-icon-glass stat-icon-red-glass">
                  <XCircle />
                </div>
                <div className="stat-info-glass">
                  <span className="stat-value-glass">
                    {documents.filter((d) => d.status === "rejected").length}
                  </span>
                  <span className="stat-label-glass">Rejected</span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="filters-container-glass">
              <div className="search-box-glass">
                <Search className="search-icon-glass" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input-glass"
                />
              </div>

              <div className="filter-group-glass">
                <Filter className="filter-icon-glass" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select-glass"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Documents Container */}
            <div className="documents-container-glass">
              {filteredDocuments.length === 0 ? (
                <div className="empty-state-glass">
                  <div className="empty-icon-glass">
                    <Folder />
                  </div>
                  <h3>No documents found</h3>
                  <p>
                    {searchTerm || filterStatus
                      ? "Try adjusting your filters or search term"
                      : "Upload your first document to get started"}
                  </p>
                  {!searchTerm && !filterStatus && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="empty-upload-btn-glass"
                    >
                      <Upload />
                      <span>Upload Document</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="documents-grid-glass">
                  {filteredDocuments.map((doc) => (
                    <div key={doc.document_id} className="document-card-glass">
                      <div className="card-header-glass">
                        <div className="document-icon-glass">
                          <FileText />
                        </div>
                        <div className={getStatusClass(doc.status)}>
                          {getStatusIcon(doc.status)}
                          <span>{formatStatus(doc.status)}</span>
                        </div>
                      </div>

                      <div className="card-body-glass">
                        <h3 className="document-title-glass">{doc.title}</h3>
                        <div className="document-meta-glass">
                          <span className="meta-item-glass">
                            <FileText className="meta-icon-glass" />
                            {doc.document_type}
                          </span>
                          <span className="meta-item-glass">
                            <Calendar className="meta-icon-glass" />
                            {formatDate(doc.created_at)}
                          </span>
                        </div>
                        {doc.file_size && (
                          <p className="file-size-glass">
                            {formatFileSize(doc.file_size)}
                          </p>
                        )}
                      </div>

                      <div className="card-actions-glass">
                        <button
                          onClick={() =>
                            navigate(`/documents/${doc.document_id}`)
                          }
                          className="action-button-glass action-view-glass"
                        >
                          <Eye />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="action-button-glass action-download-glass"
                        >
                          <Download />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Upload Document Modal */}
      <UploadDocument
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* Notification Panel */}
      <NotificationService
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
}

export default FacultyDashboard;
