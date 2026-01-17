import { useState, useEffect } from "react";
import {
  UserCheck,
  UserX,
  Clock,
  Mail,
  Building2,
  BookOpen,
  CreditCard,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import api from "../../services/api";
import "./css/PendingApprovals.css";

function PendingApprovals() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/auth/pending-users");
      setPendingUsers(response.data.pendingUsers || []);
    } catch (error) {
      console.error("Failed to fetch pending users:", error);
      alert("Failed to load pending registrations");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId, userName) => {
    if (
      !confirm(`Are you sure you want to approve ${userName}'s registration?`)
    ) {
      return;
    }

    try {
      setProcessing(userId);
      await api.post(`/auth/approve-user/${userId}`);
      alert(`✅ ${userName} has been approved successfully!`);
      fetchPendingUsers();
    } catch (error) {
      console.error("Failed to approve user:", error);
      alert(error.response?.data?.message || "Failed to approve user");
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectClick = (user) => {
    setSelectedUser(user);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedUser) return;

    try {
      setProcessing(selectedUser.user_id);
      await api.post(`/auth/reject-user/${selectedUser.user_id}`, {
        reason: rejectReason,
      });
      alert(`❌ ${selectedUser.full_name}'s registration has been rejected.`);
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedUser(null);
      fetchPendingUsers();
    } catch (error) {
      console.error("Failed to reject user:", error);
      alert(error.response?.data?.message || "Failed to reject user");
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="pending-approvals-loading">
        <div className="loading-spinner"></div>
        <p>Loading pending registrations...</p>
      </div>
    );
  }

  return (
    <div className="pending-approvals">
      {/* Header */}
      <div className="pa-header">
        <div className="pa-header-left">
          <div className="pa-header-icon">
            <Clock />
          </div>
          <div>
            <h1>Pending Registrations</h1>
            <p>Review and approve or reject user registration requests</p>
          </div>
        </div>
        <div className="pa-badge">{pendingUsers.length} Pending</div>
      </div>

      {/* Pending Users List */}
      {pendingUsers.length === 0 ? (
        <div className="pa-empty">
          <CheckCircle size={64} />
          <h3>No Pending Registrations</h3>
          <p>All registration requests have been processed.</p>
        </div>
      ) : (
        <div className="pa-grid">
          {pendingUsers.map((user) => (
            <div key={user.user_id} className="pa-card">
              <div className="pa-card-header">
                <div className="pa-user-avatar">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="pa-user-info">
                  <h3>{user.full_name}</h3>
                  <span className={`pa-role-badge role-${user.role_id}`}>
                    {user.role_name}
                  </span>
                </div>
              </div>

              <div className="pa-card-body">
                <div className="pa-info-row">
                  <Mail size={16} />
                  <span>{user.email}</span>
                </div>

                <div className="pa-info-row">
                  <Building2 size={16} />
                  <span>{user.department}</span>
                </div>

                {user.subject && (
                  <div className="pa-info-row">
                    <BookOpen size={16} />
                    <span>Subject: {user.subject}</span>
                  </div>
                )}

                <div className="pa-info-row">
                  <CreditCard size={16} />
                  <span>Employee ID: {user.employee_id}</span>
                </div>

                <div className="pa-info-row">
                  <Clock size={16} />
                  <span>Registered: {formatDate(user.created_at)}</span>
                </div>
              </div>

              <div className="pa-card-footer">
                <button
                  className="pa-btn pa-btn-approve"
                  onClick={() => handleApprove(user.user_id, user.full_name)}
                  disabled={processing === user.user_id}
                >
                  {processing === user.user_id ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <UserCheck size={18} />
                      Approve
                    </>
                  )}
                </button>

                <button
                  className="pa-btn pa-btn-reject"
                  onClick={() => handleRejectClick(user)}
                  disabled={processing === user.user_id}
                >
                  <UserX size={18} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          className="pa-modal-overlay"
          onClick={() => setShowRejectModal(false)}
        >
          <div className="pa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pa-modal-header">
              <div className="pa-modal-icon reject">
                <XCircle size={24} />
              </div>
              <h2>Reject Registration</h2>
              <p>Reject {selectedUser?.full_name}'s registration request</p>
            </div>

            <div className="pa-modal-body">
              <div className="pa-form-group">
                <label htmlFor="rejectReason">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a reason for rejection (will be logged for records)"
                  rows={4}
                />
              </div>

              <div className="pa-alert">
                <AlertCircle size={20} />
                <p>
                  This user will not be able to log in after rejection. They
                  will need to contact you directly or register again.
                </p>
              </div>
            </div>

            <div className="pa-modal-footer">
              <button
                className="pa-btn pa-btn-secondary"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                  setSelectedUser(null);
                }}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="pa-btn pa-btn-reject"
                onClick={handleRejectSubmit}
                disabled={processing}
              >
                {processing ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PendingApprovals;
