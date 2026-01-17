import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  RefreshCw,
} from "lucide-react";
import api from "../../services/api";
import "./css/DocumentStatus.css";

function DocumentStatus() {
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [documentTypes, setDocumentTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const documentsPerPage = 15;

  useEffect(() => {
    fetchDocuments();
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (documents.length > 0) {
      fetchDocumentTypes();
    }
  }, [documents]);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, filterStatus, filterType, filterDepartment]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/documents");
      setDocuments(response.data.documents);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const uniqueTypes = [
        ...new Set(documents.map((doc) => doc.document_type)),
      ].filter(Boolean);
      setDocumentTypes(
        uniqueTypes.map((type, index) => ({ id: index, name: type }))
      );
    } catch (error) {
      console.error("Failed to fetch document types:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get("/admin/departments");
      setDepartments(response.data.departments);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const filterDocuments = () => {
    let filtered = [...documents];

    if (searchTerm) {
      filtered = filtered.filter(
        (doc) =>
          doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.document_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.uploader_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((doc) => doc.status === filterStatus);
    }

    if (filterType !== "all") {
      filtered = filtered.filter((doc) => doc.document_type === filterType);
    }

    if (filterDepartment !== "all") {
      filtered = filtered.filter(
        (doc) => doc.uploader_department === filterDepartment
      );
    }

    setFilteredDocuments(filtered);
    setCurrentPage(1);
  };

  const handleViewDocument = async (documentId) => {
    try {
      const response = await api.get(`/documents/${documentId}`);
      setSelectedDocument(response.data);
      setShowModal(true);
    } catch (error) {
      console.error("Failed to fetch document details:", error);
      alert("Failed to load document details");
    }
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

      let downloadFileName = fileName || "document";

      const filenameMatch =
        /filename\*=(?:UTF-8'')?([^;]+)|filename="?([^";]+)"?/i.exec(
          disposition
        );
      if (filenameMatch) {
        const rawFilename = filenameMatch[1] || filenameMatch[2];
        if (rawFilename) {
          try {
            downloadFileName = decodeURIComponent(
              rawFilename.replace(/(^"|"$)/g, "")
            );
          } catch (e) {
            downloadFileName = rawFilename.replace(/(^"|"$)/g, "");
          }
        }
      }

      const blob = new Blob([response.data], {
        type: contentType || "application/octet-stream",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", downloadFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Download error:", error);
      alert(error.response?.data?.message || "Failed to download document.");
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: {
        icon: Clock,
        className: "ds-status-pending",
        label: "Pending",
      },
      in_review: {
        icon: RefreshCw,
        className: "ds-status-review",
        label: "In Review",
      },
      approved: {
        icon: CheckCircle,
        className: "ds-status-approved",
        label: "Approved",
      },
      rejected: {
        icon: XCircle,
        className: "ds-status-rejected",
        label: "Rejected",
      },
      revision_requested: {
        icon: AlertCircle,
        className: "ds-status-revision",
        label: "Needs Revision",
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`ds-status-badge ${config.className}`}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { className: "ds-priority-low", label: "Low" },
      medium: { className: "ds-priority-medium", label: "Medium" },
      high: { className: "ds-priority-high", label: "High" },
      urgent: { className: "ds-priority-urgent", label: "Urgent" },
    };

    const config = priorityConfig[priority] || priorityConfig.medium;

    return (
      <span className={`ds-priority-badge ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const indexOfLastDoc = currentPage * documentsPerPage;
  const indexOfFirstDoc = indexOfLastDoc - documentsPerPage;
  const currentDocuments = filteredDocuments.slice(
    indexOfFirstDoc,
    indexOfLastDoc
  );
  const totalPages = Math.ceil(filteredDocuments.length / documentsPerPage);

  const stats = {
    total: documents.length,
    pending: documents.filter((d) => d.status === "pending").length,
    approved: documents.filter((d) => d.status === "approved").length,
    rejected: documents.filter((d) => d.status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="document-status">
        <div className="ds-loading-wrapper">
          <div className="ds-loading-spinner" aria-hidden="true"></div>
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="document-status">
      {/* Header Card - Matching User Management Style */}
      <div className="ds-header-card">
        <div className="ds-header-content">
          <div className="ds-header-icon-wrapper">
            <FileText size={32} />
          </div>
          <div className="ds-header-text">
            <h1>Document Status</h1>
            <p>Monitor and track all documents in the system</p>
          </div>
        </div>
        <button className="ds-btn-refresh" onClick={fetchDocuments}>
          <RefreshCw size={20} />
          Refresh
        </button>
      </div>

      <div className="ds-stats">
        <div className="ds-stat-card ds-stat-total">
          <div className="ds-stat-icon">
            <FileText />
          </div>
          <div className="ds-stat-content">
            <span className="ds-stat-value">{stats.total}</span>
            <span className="ds-stat-label">Total Documents</span>
          </div>
        </div>
        <div className="ds-stat-card ds-stat-pending">
          <div className="ds-stat-icon">
            <Clock />
          </div>
          <div className="ds-stat-content">
            <span className="ds-stat-value">{stats.pending}</span>
            <span className="ds-stat-label">Pending</span>
          </div>
        </div>
        <div className="ds-stat-card ds-stat-approved">
          <div className="ds-stat-icon">
            <CheckCircle />
          </div>
          <div className="ds-stat-content">
            <span className="ds-stat-value">{stats.approved}</span>
            <span className="ds-stat-label">Approved</span>
          </div>
        </div>
        <div className="ds-stat-card ds-stat-rejected">
          <div className="ds-stat-icon">
            <XCircle />
          </div>
          <div className="ds-stat-content">
            <span className="ds-stat-value">{stats.rejected}</span>
            <span className="ds-stat-label">Rejected</span>
          </div>
        </div>
      </div>

      <div className="ds-filters">
        <div className="ds-search">
          <Search className="ds-search-icon" />
          <input
            type="text"
            placeholder="Search by title, type, or submitter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="ds-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="revision_requested">Needs Revision</option>
        </select>

        <select
          className="ds-filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All Types</option>
          {documentTypes.map((type, index) => (
            <option key={index} value={type.name}>
              {type.name}
            </option>
          ))}
        </select>

        <select
          className="ds-filter-select"
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.department_id} value={dept.department_name}>
              {dept.department_name}
            </option>
          ))}
        </select>
      </div>

      <div className="ds-table-container">
        {/* New scroll wrapper: handles horizontal scrolling inside the container (keeps page width stable) */}
        <div className="ds-table-scroll">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Submitted By</th>
                <th>Department</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentDocuments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="ds-empty">
                    No documents found
                  </td>
                </tr>
              ) : (
                currentDocuments.map((doc) => (
                  <tr key={doc.document_id}>
                    <td>
                      <div className="ds-doc-title">
                        <FileText size={18} />
                        <span>{doc.title}</span>
                      </div>
                    </td>
                    <td>{doc.document_type || "—"}</td>
                    <td>
                      <div className="ds-submitter">
                        <User size={14} />
                        {doc.uploader_name}
                      </div>
                    </td>
                    <td>{doc.uploader_department || "—"}</td>
                    <td>{getStatusBadge(doc.status)}</td>
                    <td>{getPriorityBadge(doc.priority)}</td>
                    <td>
                      <div className="ds-date">
                        <Calendar size={14} />
                        {new Date(doc.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="ds-actions">
                        <button
                          className="ds-action-btn ds-action-view"
                          onClick={() => handleViewDocument(doc.document_id)}
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="ds-action-btn ds-action-download"
                          onClick={() =>
                            handleDownload(doc.document_id, doc.title)
                          }
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="ds-pagination">
          <button
            className="ds-page-btn"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <div className="ds-page-numbers">
            {[...Array(totalPages)].map((_, index) => {
              const pageNum = index + 1;
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    className={`ds-page-num ${
                      currentPage === pageNum ? "active" : ""
                    }`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              } else if (
                pageNum === currentPage - 2 ||
                pageNum === currentPage + 2
              ) {
                return <span key={pageNum}>...</span>;
              }
              return null;
            })}
          </div>

          <button
            className="ds-page-btn"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {showModal && selectedDocument && (
        <div className="ds-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Document Details</h2>
              <button
                className="ds-modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <div className="ds-modal-body">
              <div className="ds-modal-section">
                <h3>Basic Information</h3>
                <div className="ds-modal-grid">
                  <div className="ds-modal-field">
                    <label>Title:</label>
                    <span>{selectedDocument.document.title}</span>
                  </div>
                  <div className="ds-modal-field">
                    <label>Type:</label>
                    <span>
                      {selectedDocument.document.document_type || "—"}
                    </span>
                  </div>
                  <div className="ds-modal-field">
                    <label>Status:</label>
                    {getStatusBadge(selectedDocument.document.status)}
                  </div>
                  <div className="ds-modal-field">
                    <label>Priority:</label>
                    {getPriorityBadge(selectedDocument.document.priority)}
                  </div>
                  <div className="ds-modal-field">
                    <label>Submitted By:</label>
                    <span>{selectedDocument.document.uploader_name}</span>
                  </div>
                  <div className="ds-modal-field">
                    <label>Department:</label>
                    <span>
                      {selectedDocument.document.uploader_department || "—"}
                    </span>
                  </div>
                  <div className="ds-modal-field">
                    <label>Submission Date:</label>
                    <span>
                      {new Date(
                        selectedDocument.document.created_at
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {selectedDocument.history &&
                selectedDocument.history.length > 0 && (
                  <div className="ds-modal-section">
                    <h3>Document History</h3>
                    <div className="ds-history-timeline">
                      {selectedDocument.history.map((item, index) => (
                        <div key={index} className="ds-history-item">
                          <div className="ds-history-marker"></div>
                          <div className="ds-history-content">
                            <div className="ds-history-header">
                              <span className="ds-history-action">
                                {item.action_taken}
                              </span>
                              <span className="ds-history-date">
                                {new Date(item.action_date).toLocaleString()}
                              </span>
                            </div>
                            <div className="ds-history-user">
                              By: {item.first_name} {item.last_name} (
                              {item.role})
                            </div>
                            {item.comments && (
                              <div className="ds-history-comments">
                                {item.comments}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="ds-modal-footer">
              <button
                className="ds-btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
              <button
                className="ds-btn-primary"
                onClick={() =>
                  handleDownload(
                    selectedDocument.document.document_id,
                    selectedDocument.document.title
                  )
                }
              >
                <Download size={18} />
                Download Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentStatus;
