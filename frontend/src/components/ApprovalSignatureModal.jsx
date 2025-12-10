// Create this file: src/components/ApprovalSignatureModal.jsx
import { useState, useRef } from "react";
import { X, PenTool, Trash2, CheckCircle } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import api from "../services/api";
import "./css/ApprovalSignatureModal.css";

function ApprovalSignatureModal({ isOpen, onClose, approval, onSuccess }) {
  const sigCanvas = useRef(null);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearSignature = () => {
    sigCanvas.current.clear();
    setError("");
  };

  const handleApprove = async () => {
    // Validate signature
    if (sigCanvas.current.isEmpty()) {
      setError("Please provide your signature before approving");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get signature as base64 data URL (PNG format)
      const signatureImage = sigCanvas.current.toDataURL("image/png");

      // Send approval request with signature
      const response = await api.post(
        `/approvals/${approval.approval_id}/approve`,
        {
          comments: comments.trim() || "Approved",
          signature_image: signatureImage, // Send the full base64 data URL
        }
      );

      if (response.data.success) {
        // Success callback
        if (onSuccess) {
          onSuccess();
        }

        // Show success message
        alert("✅ Document approved and digitally signed successfully!");

        // Close modal
        onClose();
      }
    } catch (err) {
      console.error("Approval error:", err);
      setError(
        err.response?.data?.message ||
          "Failed to approve document. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !approval) return null;

  return (
    <div className="signature-modal-overlay" onClick={onClose}>
      <div
        className="signature-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="signature-modal-header">
          <div className="header-content">
            <div className="header-icon">
              <CheckCircle />
            </div>
            <div>
              <h2>Approve Document</h2>
              <p>Review and add your digital signature</p>
            </div>
          </div>
          <button className="close-button" onClick={onClose} disabled={loading}>
            <X />
          </button>
        </div>

        {/* Document Info */}
        <div className="document-info-section">
          <h3>{approval.title}</h3>
          <p className="document-meta">
            {approval.document_type} • Submitted by {approval.submitter_name}
            {approval.department && ` • ${approval.department}`}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <span>{error}</span>
          </div>
        )}

        {/* Comments Section */}
        <div className="form-section">
          <label htmlFor="comments">Comments (Optional)</label>
          <textarea
            id="comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Add any comments about this approval..."
            rows={3}
            disabled={loading}
          />
        </div>

        {/* Signature Section */}
        <div className="signature-section">
          <div className="signature-label">
            <PenTool size={18} />
            <span>Your Digital Signature *</span>
          </div>
          <p className="signature-description">
            Draw your signature below. This will be cryptographically secured
            and attached to the document.
          </p>

          <div className="signature-canvas-wrapper">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: "signature-canvas",
                width: 600,
                height: 200,
              }}
            />
          </div>

          <button
            type="button"
            className="clear-button"
            onClick={clearSignature}
            disabled={loading}
          >
            <Trash2 size={16} />
            Clear Signature
          </button>
        </div>

        {/* Security Notice */}
        <div className="security-notice">
          <div className="notice-icon">⚠️</div>
          <p>
            By clicking "Sign & Approve", you are digitally signing this
            document. This signature is cryptographically secured and cannot be
            altered.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="approve-button"
            onClick={handleApprove}
            disabled={loading}
          >
            {loading ? (
              <span className="loading-text">
                <span className="spinner"></span>
                Processing...
              </span>
            ) : (
              <>
                <PenTool size={18} />
                Sign & Approve
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApprovalSignatureModal;
