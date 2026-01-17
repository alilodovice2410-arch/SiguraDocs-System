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

// Mock API
const mockApi = {
  get: async (url) => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (url === "/admin/documents") {
      return {
        data: {
          documents: [
            {
              document_id: 1,
              title: "Q4 Financial Report",
              document_type: "Report",
              uploader_name: "John Doe",
              uploader_department: "Finance",
              status: "approved",
              priority: "high",
              created_at: "2025-01-15T10:30:00",
            },
            {
              document_id: 2,
              title: "Staff Meeting Minutes",
              document_type: "Minutes",
              uploader_name: "Jane Smith",
              uploader_department: "Administration",
              status: "pending",
              priority: "medium",
              created_at: "2025-01-16T14:20:00",
            },
            {
              document_id: 3,
              title: "Budget Proposal 2025",
              document_type: "Proposal",
              uploader_name: "Mike Johnson",
              uploader_department: "Finance",
              status: "in_review",
              priority: "urgent",
              created_at: "2025-01-17T09:15:00",
            },
          ],
        },
      };
    }

    if (url === "/admin/departments") {
      return {
        data: {
          departments: [
            { department_id: 1, department_name: "Finance" },
            { department_id: 2, department_name: "Administration" },
            { department_id: 3, department_name: "HR" },
          ],
        },
      };
    }

    return { data: {} };
  },
};

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
      const response = await mockApi.get("/admin/documents");
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
      const response = await mockApi.get("/admin/departments");
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
      <div className="document-status-loading">
        <div className="loading-spinner"></div>
        <p>Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="document-status">
      {/* Header - UPDATED TO MATCH OTHER PAGES */}
      <div className="ds-header">
        <div className="ds-header-left">
          <div className="ds-header-icon">
            <FileText />
          </div>
          <div>
            <h1>Document Status</h1>
            <p>Monitor and track all documents in the system</p>
          </div>
        </div>
        <button className="ds-btn-primary" onClick={fetchDocuments}>
          <RefreshCw size={20} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="ds-stats">
        <div className="ds-stat">
          <span className="ds-stat-label">Total Documents</span>
          <span className="ds-stat-value">{stats.total}</span>
        </div>
        <div className="ds-stat">
          <span className="ds-stat-label">Pending</span>
          <span className="ds-stat-value">{stats.pending}</span>
        </div>
        <div className="ds-stat">
          <span className="ds-stat-label">Approved</span>
          <span className="ds-stat-value">{stats.approved}</span>
        </div>
        <div className="ds-stat">
          <span className="ds-stat-label">Rejected</span>
          <span className="ds-stat-value">{stats.rejected}</span>
        </div>
      </div>

      {/* Filters */}
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

      {/* Table Container */}
      <div className="ds-table-container">
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
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="ds-action-btn ds-action-download"
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

      {/* Pagination */}
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
    </div>
  );
}

export default DocumentStatus;
