import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import {
  ArrowLeft,
  FileText,
  Download,
  Calendar,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  Upload,
  Folder,
  Bell,
  Grid,
  History,
  TrendingUp,
  FolderOpen,
  Shield,
} from "lucide-react";
import SessionIndicator from "../SessionIndicator";
import NotificationService from "./NotificationService";
import DocumentSignatures from "../DocumentSignatures";
import "./css/DocumentDetailsPage.css";
import sanMarianoLogo from "../../assets/smnhs_logo.png";

function DocumentDetailsPage() {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [docData, setDocData] = useState(null);
  const [approvalChain, setApprovalChain] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  // Determine sidebar type based on user role
  const isPrincipal = user?.role_name?.toLowerCase() === "principal";
  const sidebarClass = isPrincipal ? "principal-sidebar" : "faculty-sidebar";

  useEffect(() => {
    fetchDocumentDetails();
  }, [id]);

  const fetchDocumentDetails = async () => {
    try {
      setLoading(true);

      // Fetch document details
      const docResponse = await api.get(`/documents/${id}`);
      console.log("Document details:", docResponse.data);
      setDocData(docResponse.data.document);
      setApprovalChain(docResponse.data.approvalChain || []);
    } catch (error) {
      console.error("Error fetching document details:", error);
    } finally {
      setLoading(false);
    }
  };

  // In DocumentDetailsPage.jsx
  console.log("Current user role:", user?.role_name);

  // Helper: parse filename from Content-Disposition
  const extractFilename = (disposition, fallback) => {
    if (!disposition) return fallback;
    // filename*=UTF-8''... or filename="..."
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

  const handleDownload = async () => {
    try {
      const response = await api.get(`/documents/${id}/download`, {
        responseType: "blob",
      });

      if (!response.data || !(response.data instanceof Blob)) {
        throw new Error("Invalid response format");
      }

      // If server returned a tiny JSON error inside a blob, parse it
      if (
        response.data.size < 500 &&
        response.data.type === "application/json"
      ) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || "Download failed");
      }

      // Inspect headers to pick a correct filename and MIME type
      const headers = response.headers || {};
      const contentType = (headers["content-type"] || "").toLowerCase();
      const disposition = headers["content-disposition"] || "";
      // Prefer original_file_name (if backend provides it) then stored file_name
      let filename =
        docData?.original_file_name || docData?.file_name || `document_${id}`;

      filename = extractFilename(disposition, filename);

      // If server returned PDF content but filename doesn't end with .pdf, fix it
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
      const link = window.document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      window.document.body.appendChild(link);
      link.click();
      link.remove();

      // Give the browser a moment before revoking the object URL
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      console.log("Download successful:", filename);
    } catch (error) {
      console.error("Download error:", error);

      let errorMsg = "Failed to download document. ";

      if (error.response?.data?.message) {
        errorMsg += error.response.data.message;
      } else if (error.response?.status === 404) {
        errorMsg += "Document not found.";
      } else if (error.response?.status === 403) {
        errorMsg += "You don't have permission to download this document.";
      } else if (error.message) {
        errorMsg += error.message;
      } else {
        errorMsg += "Please try again.";
      }

      alert(errorMsg);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
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
        return "status-badge status-pending";
      case "in_review":
      case "in review":
        return "status-badge status-review";
      case "approved":
        return "status-badge status-approved";
      case "rejected":
        return "status-badge status-rejected";
      default:
        return "status-badge status-default";
    }
  };

  const formatStatus = (status) => {
    if (!status) return "Unknown";
    return status.replace(/_/g, " ");
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Reusable sidebar component
  const renderSidebar = () => (
    <aside className={sidebarClass}>
      <div className="sidebar-content">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <img src={sanMarianoLogo} />
            </div>
          </div>
          <div className="sidebar-title">
            <h2>SiguraDocs</h2>
            <p>
              {isPrincipal ? "Principal Portal" : "San Mariano High School"}
            </p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {isPrincipal ? (
            // Principal Navigation Items
            <>
              <button
                onClick={() => navigate("/dashboard")}
                className="nav-item"
              >
                <BarChart3 className="nav-icon" />
                <span>Overview</span>
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="nav-item"
              >
                <Grid className="nav-icon" />
                <span>Document Clusters</span>
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="nav-item"
              >
                <CheckCircle className="nav-icon" />
                <span>Pending Approvals</span>
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="nav-item"
              >
                <FolderOpen className="nav-icon" />
                <span>Departments</span>
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="nav-item"
              >
                <History className="nav-icon" />
                <span>Approval History</span>
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="nav-item"
              >
                <TrendingUp className="nav-icon" />
                <span>Analytics</span>
              </button>
            </>
          ) : (
            // Faculty Navigation Items
            <>
              <button
                onClick={() => navigate("/dashboard")}
                className="nav-item"
              >
                <BarChart3 className="nav-icon" />
                <span>Overview</span>
              </button>
              <button className="nav-item">
                <Upload className="nav-icon" />
                <span>Upload Document</span>
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="nav-item"
              >
                <Folder className="nav-icon" />
                <span>My Documents</span>
              </button>
              <button
                className="nav-item"
                onClick={() => setShowNotifications(true)}
              >
                <Bell className="nav-icon" />
                <span>Notifications</span>
              </button>
            </>
          )}
        </nav>

        {/* User Profile Section - Only for Principal */}
        {isPrincipal && (
          <div className="sidebar-user">
            <div className="user-profile">
              <div className="user-avatar">
                {user?.full_name?.charAt(0) || "P"}
              </div>
              <div className="user-info">
                <p className="user-name">{user?.full_name || "Principal"}</p>
                <p className="user-role">{user?.role_name || "Principal"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  if (loading) {
    return (
      <div className="document-details-page-with-sidebar">
        {renderSidebar()}
        <div className="details-main-with-sidebar">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading document details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!docData) {
    return (
      <div className="document-details-page-with-sidebar">
        {renderSidebar()}
        <div className="details-main-with-sidebar">
          <div className="error-state">
            <FileText size={64} />
            <h2>Document Not Found</h2>
            <p>
              The document you're looking for doesn't exist or you don't have
              access to it.
            </p>
            <button onClick={() => navigate("/dashboard")} className="back-btn">
              <ArrowLeft />
              Go Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-details-page-with-sidebar">
      {renderSidebar()}

      <main className="details-main-with-sidebar">
        <header className="details-header">
          <div className="header-content-details">
            {/* Left side intentionally left empty (back button removed) to keep header-right aligned */}
            <div className="header-left-details" />

            <div className="header-right-details">
              <SessionIndicator />
              <button
                className="header-icon-btn"
                onClick={() => setShowNotifications(true)}
              >
                <Bell />
              </button>
              <div className="user-menu">
                <div className="user-info">
                  <span className="user-role">{user?.role_name || "User"}</span>
                  <span className="user-name">{user?.full_name || "User"}</span>
                </div>
                <button onClick={handleLogout} className="logout-btn">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="details-content-wrapper">
          <div className="details-container">
            <div className="document-header">
              <div className="document-icon-large">
                <FileText />
              </div>
              <div className="document-header-info">
                <h1>{docData.title}</h1>
                <div className={getStatusClass(docData.status)}>
                  {getStatusIcon(docData.status)}
                  <span>{formatStatus(docData.status)}</span>
                </div>
              </div>
            </div>

            <div className="document-info-grid">
              <div className="info-card">
                <div className="info-label">
                  <FileText className="info-icon" />
                  <span>Document Type</span>
                </div>
                <div className="info-value">{docData.document_type}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <User className="info-icon" />
                  <span>Submitted By</span>
                </div>
                <div className="info-value">{docData.submitter_name}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Calendar className="info-icon" />
                  <span>Uploaded On</span>
                </div>
                <div className="info-value">
                  {formatDate(docData.created_at)}
                </div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Clock className="info-icon" />
                  <span>Last Updated</span>
                </div>
                <div className="info-value">
                  {formatDate(docData.updated_at)}
                </div>
              </div>
            </div>

            {/* Approval Chain Section */}
            {approvalChain && approvalChain.length > 0 && (
              <div className="approval-chain-section">
                <div className="section-title">
                  <Shield className="section-icon" />
                  <h2>Approval Chain</h2>
                </div>
                <div className="approval-timeline">
                  {approvalChain.map((approval, index) => (
                    <div
                      key={index}
                      className={`approval-step approval-step-${approval.status}`}
                    >
                      <div className="step-indicator">
                        <div className="step-number">
                          {approval.approval_level}
                        </div>
                        {index < approvalChain.length - 1 && (
                          <div className="step-line"></div>
                        )}
                      </div>
                      <div className="step-content">
                        <div className="step-header">
                          <div>
                            <h4>{approval.approver_name}</h4>
                            <p className="step-role">
                              {approval.approver_role}
                              {approval.approver_subject &&
                                ` - ${approval.approver_subject}`}
                            </p>
                          </div>
                          <span
                            className={`step-status status-${approval.status}`}
                          >
                            {formatStatus(approval.status)}
                          </span>
                        </div>
                        {approval.comments && (
                          <p className="step-comments">{approval.comments}</p>
                        )}
                        {approval.decision_date && (
                          <p className="step-date">
                            {formatDate(approval.decision_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ✅ ADDED: DocumentSignatures Component - Replaces the old signatures display */}
            <DocumentSignatures documentId={docData.document_id} />

            <div className="file-info-section">
              <h2>File Information</h2>
              <div className="file-info-content">
                <div className="file-info-item">
                  <span className="file-info-label">File Name:</span>
                  <span className="file-info-value">
                    {docData.original_file_name || docData.file_name}
                  </span>
                </div>
                <div className="file-info-item">
                  <span className="file-info-label">File Size:</span>
                  <span className="file-info-value">
                    {formatFileSize(docData.file_size)}
                  </span>
                </div>
                {docData.department && (
                  <div className="file-info-item">
                    <span className="file-info-label">Department:</span>
                    <span className="file-info-value">
                      {docData.department}
                    </span>
                  </div>
                )}
                {docData.description && (
                  <div className="file-info-item">
                    <span className="file-info-label">Description:</span>
                    <span className="file-info-value">
                      {docData.description}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {docData.remarks && (
              <div className="remarks-section">
                <h2>Remarks</h2>
                <div className="remarks-content">
                  <AlertCircle className="remarks-icon" />
                  <p>{docData.remarks}</p>
                </div>
              </div>
            )}

            <div className="document-actions">
              <button onClick={handleDownload} className="download-btn-action">
                <Download />
                <span>Download Document</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Notification Panel */}
      <NotificationService
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
}

export default DocumentDetailsPage;
