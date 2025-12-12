import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  User,
  FolderOpen,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./css/DepartmentHeadDocuments.css";

function DepartmentHeadDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDocType, setFilterDocType] = useState("all");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [documentTypes, setDocumentTypes] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  });

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchDocuments();
    fetchDocumentTypes();
    fetchDepartmentTeachers();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get("/documents");
      const deptDocuments = response.data.documents || [];

      setDocuments(deptDocuments);

      // Calculate stats
      const stats = {
        total: deptDocuments.length,
        approved: deptDocuments.filter((d) => d.status === "approved").length,
        pending: deptDocuments.filter(
          (d) => d.status === "pending" || d.status === "in_review"
        ).length,
        rejected: deptDocuments.filter((d) => d.status === "rejected").length,
      };
      setStats(stats);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const response = await api.get("/documents/types/all");
      setDocumentTypes(response.data.types || []);
    } catch (error) {
      console.error("Failed to fetch document types:", error);
    }
  };

  const fetchDepartmentTeachers = async () => {
    try {
      // Get unique teachers from documents
      const response = await api.get("/documents");
      const deptDocuments = response.data.documents || [];
      const uniqueTeachers = [
        ...new Map(
          deptDocuments.map((doc) => [
            doc.submitter_name,
            {
              name: doc.submitter_name,
              username: doc.submitter_username,
            },
          ])
        ).values(),
      ];
      setTeachers(uniqueTeachers);
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.submitter_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_type?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === "all" ||
      doc.status === filterStatus ||
      (filterStatus === "in_review" &&
        (doc.status === "pending" || doc.status === "in_review"));

    const matchesDocType =
      filterDocType === "all" || doc.document_type === filterDocType;

    const matchesTeacher =
      filterTeacher === "all" || doc.submitter_name === filterTeacher;

    const matchesDate = (() => {
      if (dateRange === "all") return true;
      const docDate = new Date(doc.created_at);
      const now = new Date();
      const diffDays = Math.floor((now - docDate) / (1000 * 60 * 60 * 24));

      switch (dateRange) {
        case "today":
          return diffDays === 0;
        case "week":
          return diffDays <= 7;
        case "month":
          return diffDays <= 30;
        case "3months":
          return diffDays <= 90;
        default:
          return true;
      }
    })();

    return (
      matchesSearch &&
      matchesStatus &&
      matchesDocType &&
      matchesTeacher &&
      matchesDate
    );
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="status-icon-approved" />;
      case "rejected":
        return <XCircle className="status-icon-rejected" />;
      case "in_review":
      case "pending":
        return <Clock className="status-icon-pending" />;
      default:
        return <AlertCircle className="status-icon-default" />;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "approved":
        return "status-badge-approved";
      case "rejected":
        return "status-badge-rejected";
      case "in_review":
      case "pending":
        return "status-badge-pending";
      default:
        return "status-badge-default";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleDownload = async (documentId, fileName) => {
    try {
      const response = await api.get(`/documents/${documentId}/download`, {
        responseType: "blob",
      });

      const contentType = (
        response.headers["content-type"] || ""
      ).toLowerCase();
      const disposition = response.headers["content-disposition"] || "";

      let filename = fileName || "document";

      // Extract filename from content-disposition
      const filenameMatch =
        /filename\*=(?:UTF-8'')?([^;]+)|filename=\"?([^\";]+)\"?/i.exec(
          disposition
        );
      if (filenameMatch) {
        const raw = filenameMatch[1] || filenameMatch[2];
        if (raw) {
          try {
            filename = decodeURIComponent(raw.replace(/(^"|"$)/g, ""));
          } catch (e) {
            filename = raw.replace(/(^"|"$)/g, "");
          }
        }
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
    } catch (error) {
      console.error("Download error:", error);
      alert(error.response?.data?.message || "Failed to download document.");
    }
  };

  const handleViewDocument = (documentId) => {
    navigate(`/documents/${documentId}`);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterDocType("all");
    setFilterTeacher("all");
    setDateRange("all");
  };

  if (loading) {
    return (
      <div className="dept-docs-container">
        <div className="docs-loading">
          <div className="loading-spinner"></div>
          <p>Loading department documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dept-docs-container">
      {/* Stats Cards */}
      <div className="docs-stats-grid">
        <div className="docs-stat-card stat-blue">
          <div className="stat-card-icon">
            <FolderOpen />
          </div>
          <div className="stat-card-info">
            <div className="stat-card-number">{stats.total}</div>
            <div className="stat-card-label">Total Documents</div>
            <div className="stat-card-description">All department files</div>
          </div>
        </div>

        <div className="docs-stat-card stat-green">
          <div className="stat-card-icon">
            <CheckCircle />
          </div>
          <div className="stat-card-info">
            <div className="stat-card-number">{stats.approved}</div>
            <div className="stat-card-label">Approved</div>
            <div className="stat-card-description">Successfully approved</div>
          </div>
        </div>

        <div className="docs-stat-card stat-orange">
          <div className="stat-card-icon">
            <Clock />
          </div>
          <div className="stat-card-info">
            <div className="stat-card-number">{stats.pending}</div>
            <div className="stat-card-label">Pending</div>
            <div className="stat-card-description">Under review</div>
          </div>
        </div>

        <div className="docs-stat-card stat-red">
          <div className="stat-card-icon">
            <XCircle />
          </div>
          <div className="stat-card-info">
            <div className="stat-card-number">{stats.rejected}</div>
            <div className="stat-card-label">Rejected</div>
            <div className="stat-card-description">Needs revision</div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="docs-filter-section">
        <div className="filter-row">
          <div className="search-box-docs">
            <Search className="search-icon-docs" />
            <input
              type="text"
              placeholder="Search by title, teacher, or document type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-docs"
            />
          </div>

          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear All
          </button>
        </div>

        <div className="filter-grid">
          <div className="filter-group">
            <label className="filter-label">
              <Filter size={16} />
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="approved">✓ Approved</option>
              <option value="in_review">⏳ Pending/In Review</option>
              <option value="rejected">✗ Rejected</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <FileText size={16} />
              Document Type
            </label>
            <select
              value={filterDocType}
              onChange={(e) => setFilterDocType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Types</option>
              {documentTypes.map((type) => (
                <option key={type.doc_type_id} value={type.type_name}>
                  {type.type_name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <User size={16} />
              Teacher
            </label>
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Teachers</option>
              {teachers.map((teacher) => (
                <option key={teacher.username} value={teacher.name}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <Calendar size={16} />
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="3months">Last 3 Months</option>
            </select>
          </div>
        </div>

        <div className="filter-summary">
          Showing <strong>{filteredDocuments.length}</strong> of{" "}
          <strong>{documents.length}</strong> documents
        </div>
      </div>

      {/* Documents List */}
      <div className="docs-list-section">
        <div className="docs-list-header">
          <h2 className="docs-list-title">Department Documents</h2>
          <p className="docs-list-subtitle">
            All documents from {user?.department} department
          </p>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="docs-empty-state">
            <FolderOpen size={64} />
            <h3>No documents found</h3>
            <p>
              {searchQuery || filterStatus !== "all"
                ? "Try adjusting your filters"
                : "Documents will appear here as they are submitted"}
            </p>
          </div>
        ) : (
          <div className="docs-table-wrapper">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Uploaded By</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.document_id} className="doc-table-row">
                    <td>
                      <div className="doc-title-cell">
                        <div className="doc-icon-wrapper">
                          <FileText size={20} />
                        </div>
                        <div className="doc-title-info">
                          <div className="doc-title-text">{doc.title}</div>
                          {doc.description && (
                            <div className="doc-description-text">
                              {doc.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="doc-type-badge">
                        {doc.document_type}
                      </span>
                    </td>
                    <td>
                      <div className="submitter-info">
                        <div className="submitter-name">
                          {doc.submitter_name}
                        </div>
                        <div className="submitter-dept">
                          {doc.submitter_department}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`doc-status-badge ${getStatusBadgeClass(
                          doc.status
                        )}`}
                      >
                        {getStatusIcon(doc.status)}
                        {doc.status === "in_review"
                          ? "In Review"
                          : doc.status.charAt(0).toUpperCase() +
                            doc.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className="date-cell">
                        {formatDate(doc.created_at)}
                      </div>
                    </td>
                    <td>
                      <div className="size-cell">
                        {formatFileSize(doc.file_size)}
                      </div>
                    </td>
                    <td>
                      <div className="doc-actions">
                        <button
                          className="action-btn btn-view"
                          onClick={() => handleViewDocument(doc.document_id)}
                          title="View Details"
                        >
                          <Eye size={16} />
                          <span>View</span>
                        </button>
                        <button
                          className="action-btn btn-download"
                          onClick={() =>
                            handleDownload(
                              doc.document_id,
                              doc.original_file_name || doc.file_name
                            )
                          }
                          title="Download"
                        >
                          <Download size={16} />
                          <span>Download</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DepartmentHeadDocuments;
