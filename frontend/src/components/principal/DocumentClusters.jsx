import { useState, useEffect } from "react";
import {
  Folder,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Grid,
  List,
  Eye,
  ChevronRight,
  Layers,
  Building2,
  AlertTriangle,
} from "lucide-react";
import api from "../../services/api";
import "./css/DocumentClusters.css";

function DocumentClusters() {
  const [clusters, setClusters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [clusterDocuments, setClusterDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedClusterBy, setSelectedClusterBy] = useState(null);

  useEffect(() => {
    fetchClusters();
  }, []);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      const response = await api.get("/clustering/analyze");

      if (response.data.success) {
        setClusters(response.data.clusters);
      } else {
        const fallbackResponse = await api.get("/documents/clustered");
        setClusters({
          byType: fallbackResponse.data.clusters || [],
          byDepartment: [],
          byPriority: [],
          needsAttention: [],
        });
      }
    } catch (error) {
      console.error("Error fetching clusters:", error);
      setClusters({
        byType: [],
        byDepartment: [],
        byPriority: [],
        needsAttention: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClusterDocuments = async (clusterType, clusterName) => {
    try {
      setLoadingDocs(true);
      const response = await api.get(
        `/clustering/${clusterType}/${encodeURIComponent(clusterName)}`
      );
      setClusterDocuments(response.data.documents || []);
    } catch (error) {
      console.error("Error fetching cluster documents:", error);
      setClusterDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleClusterClick = (cluster, type) => {
    setSelectedCluster({ ...cluster, type });
    fetchClusterDocuments(type, cluster.cluster_name);
  };

  const handleCloseModal = () => {
    setSelectedCluster(null);
    setClusterDocuments([]);
  };

  const getProgress = (cluster) => {
    if (!cluster.approved_count || !cluster.document_count) return 0;
    return Math.round((cluster.approved_count / cluster.document_count) * 100);
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: {
        bg: "cluster-urgent",
        text: "text-red-600",
        icon: "bg-red-100",
      },
      high: {
        bg: "cluster-high",
        text: "text-orange-600",
        icon: "bg-orange-100",
      },
      medium: {
        bg: "cluster-medium",
        text: "text-blue-600",
        icon: "bg-blue-100",
      },
      low: { bg: "cluster-low", text: "text-gray-600", icon: "bg-gray-100" },
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || "";
    const colors = {
      pending: "status-pending",
      in_review: "status-in-review",
      approved: "status-approved",
      rejected: "status-rejected",
      revision_requested: "status-revision",
    };
    return colors[statusLower] || "status-default";
  };

  const formatStatus = (status) => {
    if (!status) return "Unknown";
    return status.replace(/_/g, " ");
  };

  const ClusterCard = ({ cluster, type }) => {
    const progress = getProgress(cluster);

    let iconBgColor = "bg-blue-100";
    let iconColor = "text-blue-600";

    if (type === "priority") {
      const colors = getPriorityColor(cluster.cluster_name);
      iconBgColor = colors.icon;
      iconColor = colors.text;
    } else if (type === "department") {
      iconBgColor = "bg-purple-100";
      iconColor = "text-purple-600";
    }

    return (
      <div
        className="cluster-card"
        onClick={() => handleClusterClick(cluster, type)}
      >
        <div className="cluster-card-header">
          <div className={`cluster-icon ${iconBgColor} ${iconColor}`}>
            {type === "department" ? <Folder /> : <FileText />}
          </div>
          <span className="cluster-count-badge">{cluster.document_count}</span>
        </div>

        <h3 className="cluster-title">{cluster.cluster_name}</h3>

        <div className="cluster-stats">
          <div className="stat-row">
            <span className="stat-label">Approved</span>
            <span className="stat-value text-green-600">
              {cluster.approved_count || 0}
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Pending</span>
            <span className="stat-value text-orange-600">
              {cluster.pending_count || 0}
            </span>
          </div>
          {cluster.rejected_count !== undefined && (
            <div className="stat-row">
              <span className="stat-label">Rejected</span>
              <span className="stat-value text-red-600">
                {cluster.rejected_count}
              </span>
            </div>
          )}
        </div>

        <div className="cluster-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">{progress}% Complete</span>
        </div>
      </div>
    );
  };

  const AttentionCard = ({ cluster }) => {
    let alertClass = "attention-card-urgent";
    let Icon = AlertCircle;

    if (cluster.cluster_name.includes("Overdue")) {
      alertClass = "attention-card-warning";
      Icon = Clock;
    } else if (cluster.cluster_name.includes("Revision")) {
      alertClass = "attention-card-info";
      Icon = FileText;
    }

    return (
      <div className={`attention-card ${alertClass}`}>
        <div className="attention-content">
          <div className="attention-icon">
            <Icon />
          </div>
          <div className="attention-details">
            <h4>{cluster.cluster_name}</h4>
            <p>{cluster.document_count} documents</p>
          </div>
        </div>
        <button
          className="attention-btn"
          onClick={() => handleClusterClick(cluster, "attention")}
        >
          Review
        </button>
      </div>
    );
  };

  const DocumentModal = () => {
    if (!selectedCluster) return null;

    return (
      <div className="modal-overlay" onClick={handleCloseModal}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>{selectedCluster.cluster_name}</h2>
              <p className="modal-subtitle">
                {clusterDocuments.length} documents in this cluster
              </p>
            </div>
            <button className="modal-close" onClick={handleCloseModal}>
              <XCircle />
            </button>
          </div>

          <div className="modal-body">
            {loadingDocs ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading documents...</p>
              </div>
            ) : clusterDocuments.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <p>No documents found</p>
              </div>
            ) : (
              <div className="documents-list">
                {clusterDocuments.map((doc) => (
                  <div key={doc.document_id} className="document-item">
                    <div className="document-icon">
                      <FileText />
                    </div>
                    <div className="document-details">
                      <h4>{doc.title}</h4>
                      <div className="document-meta">
                        <span>{doc.document_type}</span>
                        {doc.department && <span>• {doc.department}</span>}
                        {doc.uploader_name && (
                          <span>• By {doc.uploader_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="document-actions">
                      <span
                        className={`status-badge ${getStatusColor(doc.status)}`}
                      >
                        {formatStatus(doc.status)}
                      </span>
                      <button
                        className="action-btn"
                        onClick={() =>
                          window.open(`/documents/${doc.document_id}`, "_blank")
                        }
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="clusters-loading">
        <div className="spinner"></div>
        <p>Loading clusters...</p>
      </div>
    );
  }

  if (!clusters) {
    return (
      <div className="clusters-error">
        <AlertCircle size={48} />
        <p>Failed to load clusters</p>
        <button onClick={fetchClusters} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="clusters-container">
      {/* Page Header */}
      <div className="clusters-header">
        <div className="header-text">
          <h2>Document Clusters</h2>
          <p>Auto-grouped documents for better organization</p>
        </div>
        <div className="view-toggle">
          <button
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => setViewMode("grid")}
          >
            <Grid size={18} />
          </button>
          <button
            className={viewMode === "list" ? "active" : ""}
            onClick={() => setViewMode("list")}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Attention Alerts - Show at the top if available */}
      {clusters.needsAttention && clusters.needsAttention.length > 0 && (
        <section className="attention-section">
          <div className="section-header">
            <AlertCircle className="section-icon text-red-600" />
            <h3>Requires Immediate Attention</h3>
          </div>
          <div className="attention-grid">
            {clusters.needsAttention.map((cluster, idx) => (
              <AttentionCard key={idx} cluster={cluster} />
            ))}
          </div>
        </section>
      )}

      {/* Cluster By Section */}
      <div className="cluster-by-section">
        <div className="cluster-by-header">
          <div className="cluster-by-icon">
            <Layers size={20} />
          </div>
          <h3>Cluster By</h3>
        </div>
        <div className="cluster-options">
          <div
            className={`cluster-option-card ${
              selectedClusterBy === "type" ? "selected" : ""
            }`}
            data-type="type"
            onClick={() => setSelectedClusterBy("type")}
          >
            <div className="cluster-option-icon">
              <FileText size={20} />
            </div>
            <div className="cluster-option-info">
              <div className="cluster-option-title">Document Type</div>
              <div className="cluster-option-description">
                Group by file type
              </div>
            </div>
            <ChevronRight size={20} className="cluster-option-arrow" />
          </div>

          <div
            className={`cluster-option-card ${
              selectedClusterBy === "department" ? "selected" : ""
            }`}
            data-type="department"
            onClick={() => setSelectedClusterBy("department")}
          >
            <div className="cluster-option-icon">
              <Building2 size={20} />
            </div>
            <div className="cluster-option-info">
              <div className="cluster-option-title">Department</div>
              <div className="cluster-option-description">
                Group by faculty dept
              </div>
            </div>
            <ChevronRight size={20} className="cluster-option-arrow" />
          </div>

          <div
            className={`cluster-option-card ${
              selectedClusterBy === "priority" ? "selected" : ""
            }`}
            data-type="priority"
            onClick={() => setSelectedClusterBy("priority")}
          >
            <div className="cluster-option-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="cluster-option-info">
              <div className="cluster-option-title">Priority</div>
              <div className="cluster-option-description">Group by urgency</div>
            </div>
            <ChevronRight size={20} className="cluster-option-arrow" />
          </div>
        </div>
      </div>

      {/* Cluster Results - Show based on selection */}
      {selectedClusterBy && (
        <section
          className="cluster-section"
          data-cluster-type={selectedClusterBy}
        >
          <div className="section-header">
            {selectedClusterBy === "type" && (
              <>
                <FileText className="section-icon text-blue-600" />
                <h3>Clustered by Document Type</h3>
              </>
            )}
            {selectedClusterBy === "department" && (
              <>
                <Folder className="section-icon text-purple-600" />
                <h3>Clustered by Department</h3>
              </>
            )}
            {selectedClusterBy === "priority" && (
              <>
                <TrendingUp className="section-icon text-orange-600" />
                <h3>Clustered by Priority</h3>
              </>
            )}
          </div>
          <div className={`clusters-grid ${viewMode}`}>
            {selectedClusterBy === "type" &&
              clusters.byType?.map((cluster, idx) => (
                <ClusterCard key={idx} cluster={cluster} type="type" />
              ))}
            {selectedClusterBy === "department" &&
              clusters.byDepartment?.map((cluster, idx) => (
                <ClusterCard key={idx} cluster={cluster} type="department" />
              ))}
            {selectedClusterBy === "priority" &&
              clusters.byPriority?.map((cluster, idx) => (
                <ClusterCard key={idx} cluster={cluster} type="priority" />
              ))}
          </div>
        </section>
      )}

      {/* Show message when no cluster type is selected */}
      {!selectedClusterBy && (
        <div className="empty-state" style={{ marginTop: "2rem" }}>
          <Layers size={48} />
          <p>Select a cluster type above to view documents</p>
        </div>
      )}

      {/* Document Details Modal */}
      <DocumentModal />
    </div>
  );
}

export default DocumentClusters;
