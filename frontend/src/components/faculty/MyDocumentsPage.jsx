import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import {
  ArrowLeft,
  Upload,
  FileText,
  Filter,
  Search,
  Eye,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Folder,
} from "lucide-react";
import UploadDocument from "./UploadDocument";
import "./css/MyDocumentsPage.css";

function MyDocumentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchDocuments();
  }, [filterStatus]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = filterStatus ? { status: filterStatus } : {};
      const response = await api.get("/documents", { params });
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchDocuments();
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const formatStatus = (status) => {
    if (!status) return "Unknown";
    return status.replace(/_/g, " ");
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

  return (
    <div className="my-documents-page-glass">
      {/* Header */}
      <header className="documents-header-glass">
        <div className="header-content-glass">
          <div className="header-left-glass">
            <button
              onClick={() => {
                // Faculty/Staff go to My Documents, others to dashboard
                if (user?.role_name === "Faculty") {
                  navigate("/my-documents");
                } else {
                  navigate("/dashboard");
                }
              }}
              className="back-btn"
            >
              <ArrowLeft />
              <span>Back</span>
            </button>
            <div className="header-title-glass">
              <h1>My Documents</h1>
              <p>Manage and track all your document submissions</p>
            </div>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="upload-button-glass"
          >
            <Upload />
            <span>Upload New Document</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="documents-main-glass">
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

        {/* Documents List */}
        <div className="documents-container-glass">
          {loading ? (
            <div className="loading-state-glass">
              <div className="loading-spinner-glass"></div>
              <p>Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
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
                      onClick={() => navigate(`/documents/${doc.document_id}`)}
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
      </main>

      {/* Upload Modal */}
      <UploadDocument
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}

export default MyDocumentsPage;
