import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  User,
  Calendar,
  Filter,
  Search,
} from "lucide-react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import "./css/ApprovalHistory.css";

function ApprovalHistory() {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalApproved: 0,
    totalRejected: 0,
    totalReviewed: 0,
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, [filter]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = filter !== "all" ? { status: filter } : {};
      const response = await api.get("/principal/approval-history", { params });
      const historyData = response.data.history || [];

      setHistory(historyData);

      // Calculate stats
      const approved = historyData.filter(
        (item) => item.status === "approved"
      ).length;
      const rejected = historyData.filter(
        (item) => item.status === "rejected"
      ).length;

      setStats({
        totalApproved: approved,
        totalRejected: rejected,
        totalReviewed: historyData.length,
      });
    } catch (error) {
      console.error("Failed to fetch history:", error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.submitted_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.document_type?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="status-icon-approved" />;
      case "rejected":
        return <XCircle className="status-icon-rejected" />;
      case "revision_requested":
        return <FileText className="status-icon-revision" />;
      default:
        return <FileText className="status-icon-default" />;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "approved":
        return "status-badge-approved";
      case "rejected":
        return "status-badge-rejected";
      case "revision_requested":
        return "status-badge-revision";
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

  if (loading) {
    return (
      <div className="approval-history-container">
        <div className="history-loading">
          <div className="loading-spinner"></div>
          <p>Loading approval history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="approval-history-container">
      {/* Stats Cards */}
      <div className="history-stats-grid">
        <div className="history-stat-card stat-green">
          <div className="stat-card-icon">
            <CheckCircle />
          </div>
          <div className="stat-card-info">
            <div className="stat-card-number">{stats.totalApproved}</div>
            <div className="stat-card-label">Total Approved</div>
            <div className="stat-card-description">
              Documents successfully approved
            </div>
          </div>
        </div>

        <div className="history-stat-card stat-red">
          <div className="stat-card-icon">
            <XCircle />
          </div>
          <div className="stat-card-info">
            <div className="stat-card-number">{stats.totalRejected}</div>
            <div className="stat-card-label">Total Rejected</div>
            <div className="stat-card-description">
              Documents requiring revision
            </div>
          </div>
        </div>

        <div className="history-stat-card stat-blue">
          <div className="stat-card-icon">
            <Eye />
          </div>
          <div className="stat-card-info">
            <div className="stat-card-number">{stats.totalReviewed}</div>
            <div className="stat-card-label">Total Reviewed</div>
            <div className="stat-card-description">All processed documents</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="history-filter-section">
        <div className="filter-header">
          <Filter className="filter-icon" />
          <span className="filter-label">Filter by:</span>
        </div>

        <div className="filter-buttons-group">
          <button
            className={`filter-button ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`filter-button ${filter === "approved" ? "active" : ""}`}
            onClick={() => setFilter("approved")}
          >
            Approved
          </button>
          <button
            className={`filter-button ${filter === "rejected" ? "active" : ""}`}
            onClick={() => setFilter("rejected")}
          >
            Rejected
          </button>
        </div>

        <div className="search-box-history">
          <Search className="search-icon-history" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input-history"
          />
        </div>
      </div>

      {/* Review Timeline */}
      <div className="review-timeline-section">
        <h2 className="timeline-title">Review Timeline</h2>

        {filteredHistory.length === 0 ? (
          <div className="history-empty-state">
            <FileText size={64} />
            <h3>No documents found</h3>
            <p>Documents you review will appear here</p>
          </div>
        ) : (
          <div className="timeline-list">
            {filteredHistory.map((item) => (
              <div key={item.approval_id} className="timeline-item">
                <div className="timeline-indicator">
                  {getStatusIcon(item.status)}
                </div>

                <div className="timeline-content">
                  <div className="timeline-header">
                    <div className="timeline-main-info">
                      <h3 className="timeline-document-title">{item.title}</h3>
                      <span
                        className={`timeline-status-badge ${getStatusBadgeClass(
                          item.status
                        )}`}
                      >
                        {item.status === "approved" && "✓ Approved"}
                        {item.status === "rejected" && "✗ Rejected"}
                        {item.status === "revision_requested" &&
                          "Revision Requested"}
                      </span>
                      <span className="timeline-document-type">
                        {item.document_type}
                      </span>
                    </div>
                    <button
                      className="timeline-view-btn"
                      onClick={() => navigate(`/documents/${item.document_id}`)}
                    >
                      <Eye size={16} />
                      View
                    </button>
                  </div>

                  <div className="timeline-meta">
                    <div className="timeline-meta-item">
                      <User size={16} />
                      <span>Uploaded by {item.submitted_by}</span>
                    </div>
                    <div className="timeline-meta-item">
                      <Calendar size={16} />
                      <span>Reviewed on {formatDate(item.decision_date)}</span>
                    </div>
                    <div className="timeline-meta-item">
                      <CheckCircle size={16} />
                      <span>By {item.approved_by}</span>
                    </div>
                  </div>

                  {item.comments && (
                    <div className="timeline-comments">
                      <div className="comments-label">Review Comments:</div>
                      <div className="comments-text">{item.comments}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ApprovalHistory;
