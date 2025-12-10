import { useState, useEffect } from "react";
import {
  ClipboardList,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Trash2,
  Edit,
} from "lucide-react";
import api from "../../services/api";
import "./css/AuditLogs.css";

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 20;

  useEffect(() => {
    fetchAuditLogs();
    fetchUsers();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, filterAction, filterUser, dateRange]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/audit-logs");
      setLogs(response.data.logs);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get("/admin/users");
      setUsers(response.data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Action filter
    if (filterAction !== "all") {
      filtered = filtered.filter((log) => log.action === filterAction);
    }

    // User filter
    if (filterUser !== "all") {
      filtered = filtered.filter((log) => log.user_id === parseInt(filterUser));
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(
        (log) => new Date(log.created_at) >= new Date(dateRange.start)
      );
    }
    if (dateRange.end) {
      filtered = filtered.filter(
        (log) =>
          new Date(log.created_at) <= new Date(dateRange.end + "T23:59:59")
      );
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  };

  const handleExport = () => {
    // Convert logs to CSV
    const headers = ["Date", "Time", "User", "Action", "Details", "IP Address"];
    const csvData = filteredLogs.map((log) => [
      new Date(log.created_at).toLocaleDateString(),
      new Date(log.created_at).toLocaleTimeString(),
      log.full_name,
      log.action.replace(/_/g, " "),
      log.details || "",
      log.ip_address || "",
    ]);

    const csv = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getActionIcon = (action) => {
    const iconMap = {
      LOGIN_SUCCESS: { icon: CheckCircle, className: "log-icon-green" },
      LOGIN_FAILED: { icon: XCircle, className: "log-icon-red" },
      LOGOUT: { icon: Clock, className: "log-icon-gray" },
      USER_CREATED: { icon: User, className: "log-icon-blue" },
      USER_UPDATED: { icon: Edit, className: "log-icon-blue" },
      USER_DELETED: { icon: Trash2, className: "log-icon-red" },
      DOCUMENT_UPLOADED: { icon: Upload, className: "log-icon-purple" },
      DOCUMENT_APPROVED: { icon: CheckCircle, className: "log-icon-green" },
      DOCUMENT_REJECTED: { icon: XCircle, className: "log-icon-red" },
      STATUS_CHANGE: { icon: FileText, className: "log-icon-orange" },
      PASSWORD_CHANGED: { icon: AlertCircle, className: "log-icon-yellow" },
      PASSWORD_RESET: { icon: AlertCircle, className: "log-icon-yellow" },
    };

    return iconMap[action] || { icon: FileText, className: "log-icon-gray" };
  };

  const uniqueActions = [...new Set(logs.map((log) => log.action))];

  // Pagination
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  if (loading) {
    return (
      <div className="audit-logs-loading">
        <div className="loading-spinner"></div>
        <p>Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="audit-logs">
      {/* Header */}
      <div className="al-header">
        <div className="al-header-left">
          <div className="al-header-icon">
            <ClipboardList />
          </div>
          <div>
            <h1>Audit Logs</h1>
            <p>Track all system activities and user actions</p>
          </div>
        </div>
        <button className="al-btn-primary" onClick={handleExport}>
          <Download size={20} />
          Export Logs
        </button>
      </div>

      {/* Filters */}
      <div className="al-filters">
        <div className="al-search">
          <Search className="al-search-icon" />
          <input
            type="text"
            placeholder="Search by action, user, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="al-filter-select"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="all">All Actions</option>
          {uniqueActions.map((action) => (
            <option key={action} value={action}>
              {action.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select
          className="al-filter-select"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
        >
          <option value="all">All Users</option>
          {users.map((user) => (
            <option key={user.user_id} value={user.user_id}>
              {user.full_name}
            </option>
          ))}
        </select>

        <div className="al-date-filters">
          <div className="al-date-input">
            <Calendar size={18} />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              placeholder="Start date"
            />
          </div>
          <span>to</span>
          <div className="al-date-input">
            <Calendar size={18} />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              placeholder="End date"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="al-stats">
        <div className="al-stat">
          <span className="al-stat-label">Total Logs</span>
          <span className="al-stat-value">{filteredLogs.length}</span>
        </div>
        <div className="al-stat">
          <span className="al-stat-label">Filtered Results</span>
          <span className="al-stat-value">{filteredLogs.length}</span>
        </div>
        <div className="al-stat">
          <span className="al-stat-label">Unique Users</span>
          <span className="al-stat-value">
            {new Set(filteredLogs.map((log) => log.user_id)).size}
          </span>
        </div>
      </div>

      {/* Logs List */}
      <div className="al-logs-container">
        {currentLogs.length === 0 ? (
          <div className="al-empty">
            <ClipboardList size={48} />
            <p>No audit logs found</p>
          </div>
        ) : (
          <div className="al-logs-list">
            {currentLogs.map((log) => {
              const { icon: Icon, className } = getActionIcon(log.action);

              return (
                <div key={log.log_id} className="al-log-item">
                  <div className={`al-log-icon ${className}`}>
                    <Icon size={20} />
                  </div>

                  <div className="al-log-content">
                    <div className="al-log-header">
                      <span className="al-log-action">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="al-log-time">
                        {new Date(log.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="al-log-details">
                      <div className="al-log-user">
                        <User size={14} />
                        <span>{log.full_name}</span>
                        {log.role_name && (
                          <span className="al-log-role">({log.role_name})</span>
                        )}
                      </div>
                      {log.details && (
                        <p className="al-log-description">{log.details}</p>
                      )}
                      {log.document_title && (
                        <div className="al-log-document">
                          <FileText size={14} />
                          <span>{log.document_title}</span>
                        </div>
                      )}
                    </div>

                    {log.ip_address && (
                      <div className="al-log-meta">
                        <span className="al-log-ip">IP: {log.ip_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="al-pagination">
            <button
              className="al-page-btn"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>

            <div className="al-page-numbers">
              {[...Array(totalPages)].map((_, index) => {
                const pageNum = index + 1;
                // Show first page, last page, current page, and pages around current
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      className={`al-page-num ${
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
              className="al-page-btn"
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
    </div>
  );
}

export default AuditLogs;
