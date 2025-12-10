import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  Clock,
  AlertCircle,
  Search,
  Download,
  MessageSquare,
  Users,
  X,
} from "lucide-react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DocumentPreviewApproval from "../DocumentPreviewApproval";
import "./css/DepartmentHeadPendingApprovals.css";

function DepartmentHeadApprovals() {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [processingId, setProcessingId] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [comments, setComments] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await api.get("/approvals/pending");
      console.log("📋 Pending approvals:", response.data);
      setPendingApprovals(response.data.approvals || []);
    } catch (error) {
      console.error("Failed to fetch pending approvals:", error);
    } finally {
      setLoading(false);
    }
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

  const openActionModal = (approval, type) => {
    setSelectedDocument(approval);
    setActionType(type);
    setComments("");
    setShowActionModal(true);
  };

  const handleApproveWithSignature = (approval) => {
    setSelectedApproval(approval);
    setShowPreviewModal(true);
  };

  const handleApprovalSuccess = () => {
    fetchPendingApprovals();
    setSelectedApproval(null);
  };

  const handleReject = async () => {
    if (!selectedDocument || !comments.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    try {
      setProcessingId(selectedDocument.approval_id);

      await api.post(`/approvals/${selectedDocument.approval_id}/reject`, {
        comments: comments,
      });

      setPendingApprovals((prev) =>
        prev.filter((a) => a.approval_id !== selectedDocument.approval_id)
      );

      setShowActionModal(false);
      alert("Document rejected. The submitter has been notified.");
    } catch (error) {
      console.error("Rejection error:", error);
      alert(error.response?.data?.message || "Failed to reject document");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedDocument || !comments.trim()) {
      alert("Please provide revision instructions");
      return;
    }

    try {
      setProcessingId(selectedDocument.approval_id);

      await api.post(
        `/approvals/${selectedDocument.approval_id}/request-revision`,
        {
          comments: comments,
        }
      );

      setPendingApprovals((prev) =>
        prev.filter((a) => a.approval_id !== selectedDocument.approval_id)
      );

      setShowActionModal(false);
      alert("Revision requested. The submitter has been notified.");
    } catch (error) {
      console.error("Revision request error:", error);
      alert(error.response?.data?.message || "Failed to request revision");
    } finally {
      setProcessingId(null);
    }
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
    } catch (error) {
      console.error("Download error:", error);
      alert(
        error.response?.data?.message ||
          "Failed to download document. Try renaming the saved file to .pdf if it contains PDF data."
      );
    }
  };

  const handleViewDocument = (documentId) => {
    navigate(`/documents/${documentId}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPriorityIcon = (priority) => {
    if (priority === "urgent" || priority === "high") {
      return <AlertCircle className="w-3 h-3" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="approvals-loading">
        <div className="loading-spinner"></div>
        <p>Loading pending approvals...</p>
      </div>
    );
  }

  return (
    <div className="approvals-view">
      {/* Header Section - Glassmorphism */}
      <div className="approvals-header-modern">
        <div className="approvals-header-content">
          <div className="approvals-header-left">
            <h1 className="approvals-page-title">Pending Approvals</h1>
            <p className="approvals-page-subtitle">
              {filteredApprovals.length}{" "}
              {filteredApprovals.length === 1 ? "document" : "documents"}{" "}
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

      {/* Search & Filter - Glassmorphism */}
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

      {/* Approvals Grid */}
      {filteredApprovals.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-icon-modern">
            <CheckCircle />
          </div>
          <h2 className="empty-title-modern">All Caught Up!</h2>
          <p className="empty-description-modern">
            There are no pending approvals at the moment. Great work keeping
            things moving!
          </p>
        </div>
      ) : (
        <div className="approvals-grid-modern">
          {filteredApprovals.map((approval) => (
            <div key={approval.approval_id} className="approval-card-modern">
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
                      <div className="meta-label-modern">Uploaded by</div>
                      <div className="meta-value-modern">
                        {approval.submitter_name}
                      </div>
                    </div>
                  </div>

                  <div className="meta-item-modern">
                    <Clock className="meta-icon-modern" />
                    <div className="meta-content-modern">
                      <div className="meta-label-modern">Upload date</div>
                      <div className="meta-value-modern">
                        {formatDate(approval.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="approval-actions-modern">
                <button
                  onClick={() => handleViewDocument(approval.document_id)}
                  className="approval-btn-modern btn-view-modern"
                  disabled={processingId === approval.approval_id}
                >
                  <Eye />
                  View
                </button>
                <button
                  onClick={() => handleApproveWithSignature(approval)}
                  className="approval-btn-modern btn-approve-modern"
                  disabled={processingId === approval.approval_id}
                >
                  {processingId === approval.approval_id ? (
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
                  onClick={() => openActionModal(approval, "reject")}
                  className="approval-btn-modern btn-reject-modern"
                  disabled={processingId === approval.approval_id}
                >
                  <XCircle />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedDocument && (
        <div
          className="modal-overlay"
          onClick={() => setShowActionModal(false)}
        >
          <div className="action-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowActionModal(false)}
            >
              <X size={20} />
            </button>

            <div className="modal-header">
              {actionType === "reject" && (
                <>
                  <div className="modal-icon reject">
                    <XCircle size={32} />
                  </div>
                  <h2>Reject Document</h2>
                  <p>Please provide a reason for rejection.</p>
                </>
              )}
              {actionType === "revision" && (
                <>
                  <div className="modal-icon revision">
                    <MessageSquare size={32} />
                  </div>
                  <h2>Request Revision</h2>
                  <p>Provide instructions for the required changes.</p>
                </>
              )}
            </div>

            <div className="modal-body">
              <div className="doc-summary">
                <h4>{selectedDocument.title}</h4>
                <p>
                  {selectedDocument.document_type} •{" "}
                  {selectedDocument.submitter_name}
                </p>
              </div>

              <div className="comments-section">
                <label>Comments (Required)</label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={
                    actionType === "reject"
                      ? "Explain why this document is being rejected..."
                      : "Describe what changes need to be made..."
                  }
                  rows={4}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowActionModal(false)}
              >
                Cancel
              </button>
              {actionType === "reject" && (
                <button
                  className="btn-confirm reject"
                  onClick={handleReject}
                  disabled={processingId || !comments.trim()}
                >
                  <XCircle size={16} />
                  {processingId ? "Processing..." : "Reject Document"}
                </button>
              )}
              {actionType === "revision" && (
                <button
                  className="btn-confirm revision"
                  onClick={handleRequestRevision}
                  disabled={processingId || !comments.trim()}
                >
                  <MessageSquare size={16} />
                  {processingId ? "Processing..." : "Request Revision"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Preview & Approval Modal */}
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

export default DepartmentHeadApprovals;
