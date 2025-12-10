// Create this file: src/components/DocumentSignatures.jsx
import { useState, useEffect } from "react";
import { Shield, Calendar, User, CheckCircle } from "lucide-react";
import api from "../services/api";
import "./css/DocumentSignatures.css";

function DocumentSignatures({ documentId }) {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSignatures();
  }, [documentId]);

  const fetchSignatures = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/approvals/signatures/${documentId}`);
      console.log("📋 Signatures fetched:", response.data.signatures);
      setSignatures(response.data.signatures || []);
      setError(null);
    } catch (error) {
      console.error("Failed to fetch signatures:", error);
      setError("Failed to load signatures");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="signatures-loading">
        <div className="spinner"></div>
        <p>Loading signatures...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="signatures-error">
        <p>{error}</p>
      </div>
    );
  }

  if (signatures.length === 0) {
    return (
      <div className="no-signatures">
        <Shield size={32} />
        <p>No signatures yet</p>
        <small>This document has not been signed by any approvers</small>
      </div>
    );
  }

  return (
    <div className="signatures-container">
      <div className="signatures-header">
        <h3 className="signatures-title">
          <Shield size={20} />
          Digital Signatures ({signatures.length})
        </h3>
        <p className="signatures-subtitle">
          All signatures are cryptographically secured and tamper-proof
        </p>
      </div>

      <div className="signatures-list">
        {signatures.map((sig, index) => (
          <div key={sig.signature_id || index} className="signature-card">
            <div className="signature-header-row">
              <div className="signature-info">
                <div className="signer-name">
                  <User size={16} />
                  {sig.signer_name}
                </div>
                <div className="signature-meta">
                  <span className="role-badge">{sig.signer_role}</span>
                  <span className="dept-badge">{sig.signer_department}</span>
                  {sig.signer_subject && (
                    <span className="subject-badge">{sig.signer_subject}</span>
                  )}
                </div>
              </div>
              <div className="approval-level">
                <CheckCircle size={16} />
                Level {sig.approval_level}
              </div>
            </div>

            {/* ✅ SIGNATURE IMAGE DISPLAY */}
            {sig.signature_image ? (
              <div className="signature-image-container">
                <div className="signature-label">Digital Signature:</div>
                <img
                  src={sig.signature_image}
                  alt={`Signature of ${sig.signer_name}`}
                  className="signature-image"
                />
              </div>
            ) : (
              <div className="no-signature-image">
                <Shield size={20} />
                <span>Signature recorded (no image available)</span>
              </div>
            )}

            <div className="signature-footer">
              <div className="signature-detail">
                <Calendar size={14} />
                <span>{formatDate(sig.signed_at)}</span>
              </div>
              <div className="signature-detail">
                <Shield size={14} />
                <span className="hash-text" title={sig.signature_hash}>
                  {sig.signature_hash.substring(0, 16)}...
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DocumentSignatures;
