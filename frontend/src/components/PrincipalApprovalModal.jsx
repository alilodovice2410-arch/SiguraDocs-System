import { useState, useRef, useEffect } from "react";
import {
  X,
  PenTool,
  Trash2,
  Eye,
  FileText,
  Download,
  AlertCircle,
} from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import api from "../services/api";
import "./css/DocumentPreviewApproval.css";

function PrincipalApprovalModal({ isOpen, onClose, approval, onSuccess }) {
  const sigCanvas = useRef(null);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [documentUrl, setDocumentUrl] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [fileType, setFileType] = useState(null);

  useEffect(() => {
    if (isOpen && approval) {
      loadDocumentPreview();
    }

    return () => {
      if (documentUrl) {
        URL.revokeObjectURL(documentUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, approval]);

  const loadDocumentPreview = async () => {
    try {
      setLoadingDoc(true);
      setError("");

      console.log("📄 Loading document preview for ID:", approval.document_id);

      const fileName = approval.file_name || approval.title || "";
      const extension = fileName.split(".").pop().toLowerCase();
      setFileType(extension);

      const nativePreviewTypes = ["pdf", "jpg", "jpeg", "png", "gif", "txt"];
      const isNativePreview = nativePreviewTypes.includes(extension);

      if (isNativePreview) {
        const response = await api.get(
          `/documents/${approval.document_id}/download`,
          {
            responseType: "blob",
          }
        );

        if (!response.data || response.data.size === 0) {
          throw new Error("Empty document received");
        }

        const url = URL.createObjectURL(response.data);
        setDocumentUrl(url);
      } else {
        console.log("ℹ️ Office files require download for preview");
      }
    } catch (error) {
      console.error("❌ Failed to load document:", error);
      setError(`Failed to load document preview: ${error.message}`);
    } finally {
      setLoadingDoc(false);
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

  const clearSignature = () => {
    sigCanvas.current.clear();
    setError("");
  };

  const handleApprove = async () => {
    console.log("\n🖊️ ===== PRINCIPAL SIGNATURE APPROVAL (FRONTEND) =====");

    if (!sigCanvas.current) {
      console.error("❌ Signature canvas ref is null!");
      setError("Signature canvas not initialized");
      return;
    }

    if (sigCanvas.current.isEmpty()) {
      console.error("❌ Signature canvas is empty!");
      setError("Please provide your signature before approving");
      return;
    }

    console.log("✅ Signature canvas is not empty");

    setLoading(true);
    setError("");

    try {
      const signatureImage = sigCanvas.current.toDataURL("image/png");

      console.log("📊 Signature Data Info:");
      console.log("   - Length:", signatureImage.length, "characters");
      console.log(
        "   - Valid PNG:",
        signatureImage.startsWith("data:image/png;base64,")
      );

      if (!signatureImage.startsWith("data:image/")) {
        throw new Error("Invalid signature image format");
      }

      const requestPayload = {
        comments: comments.trim() || "Approved by Principal",
        signature_image: signatureImage,
      };

      console.log("📤 Sending principal approval request:");
      console.log("   - Approval ID:", approval.approval_id);
      console.log("   - Comments:", requestPayload.comments);
      console.log("   - Signature size:", signatureImage.length, "chars");

      const response = await api.post(
        `/principal/approvals/${approval.approval_id}/approve`,
        requestPayload
      );

      console.log("✅ Principal approval response:", response.data);

      if (response.data.success) {
        if (documentUrl) {
          URL.revokeObjectURL(documentUrl);
        }

        if (onSuccess) {
          onSuccess();
        }

        alert("✅ Document approved and digitally signed by Principal!");
        onClose();
      } else {
        throw new Error(response.data.message || "Approval failed");
      }
    } catch (err) {
      console.error("❌ Principal approval error:", err);
      console.error("Error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });

      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to approve document. Please try again."
      );
    } finally {
      setLoading(false);
      console.log("=====================================\n");
    }
  };

  const handleClose = () => {
    if (documentUrl) {
      URL.revokeObjectURL(documentUrl);
    }
    setComments("");
    setError("");
    onClose();
  };

  const handleDownloadDocument = async () => {
    try {
      const response = await api.get(
        `/documents/${approval.document_id}/download`,
        { responseType: "blob" }
      );

      if (!response.data || !(response.data instanceof Blob)) {
        throw new Error("Invalid response format");
      }

      // Check for error blob
      if (
        response.data.size < 500 &&
        (response.data.type === "application/json" || response.data.type === "")
      ) {
        const text = await response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || "Download failed");
        } catch (e) {
          // not JSON - continue
        }
      }

      const headers = response.headers || {};
      const contentType = (headers["content-type"] || "").toLowerCase();
      const disposition = headers["content-disposition"] || "";
      let filename =
        approval.original_file_name ||
        approval.file_name ||
        approval.title ||
        "document";

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
    } catch (err) {
      console.error("Download error:", err);
      alert(err.message || "Failed to download document");
    }
  };

  if (!isOpen || !approval) return null;

  const officeTypes = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];
  const isOfficeFile = officeTypes.includes(fileType);

  return (
    <div className="preview-modal-overlay" onClick={handleClose}>
      <div
        className="preview-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="preview-modal-header">
          <div className="header-content">
            <div className="header-icon">
              <Eye />
            </div>
            <div>
              <h2>Review & Sign Document (Principal)</h2>
              <p>Review the document and add your digital signature</p>
            </div>
          </div>
          <button
            className="close-button"
            onClick={handleClose}
            disabled={loading}
          >
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

        {/* Document Preview */}
        <div className="document-preview-section">
          <div className="preview-header">
            <FileText size={18} />
            <span>Document Preview</span>
          </div>
          <div className="preview-container">
            {loadingDoc ? (
              <div className="preview-loading">
                <div className="spinner"></div>
                <p>Loading document...</p>
              </div>
            ) : error && !documentUrl ? (
              <div className="preview-error">
                <FileText size={48} />
                <p>{error}</p>
                <button onClick={loadDocumentPreview} className="retry-btn">
                  Retry
                </button>
              </div>
            ) : !documentUrl && isOfficeFile ? (
              <div className="no-preview-available">
                <div className="file-icon-large">
                  {fileType === "docx" || fileType === "doc"
                    ? "📝"
                    : fileType === "xlsx" || fileType === "xls"
                    ? "📊"
                    : "📄"}
                </div>
                <h3>{fileType?.toUpperCase()} Document</h3>
                <p className="file-name">
                  {approval.original_file_name ||
                    approval.file_name ||
                    approval.title}
                </p>
                <div className="preview-notice" style={{ marginTop: "1rem" }}>
                  <AlertCircle size={20} />
                  <p>
                    <strong>Preview not available in browser.</strong>
                    <br />
                    Download the file to review its contents.
                    <br />
                    <span style={{ color: "#0B8043", fontWeight: "600" }}>
                      ✅ Your signature will be embedded when you approve.
                    </span>
                  </p>
                </div>
                <button
                  onClick={handleDownloadDocument}
                  className="download-btn-large"
                  style={{
                    marginTop: "1rem",
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#0B8043",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "1rem",
                    margin: "1rem auto",
                  }}
                >
                  <Download size={20} />
                  Download File
                </button>
                <p
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    backgroundColor: "#e8f5e9",
                    borderRadius: "0.5rem",
                    color: "#2e7d32",
                    fontWeight: "500",
                    textAlign: "center",
                  }}
                >
                  📝 Review the document, then return here to sign and approve
                  it.
                </p>
              </div>
            ) : documentUrl ? (
              fileType === "pdf" ? (
                <iframe
                  src={`${documentUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                  title="Document Preview"
                  className="document-iframe"
                />
              ) : ["jpg", "jpeg", "png", "gif"].includes(fileType) ? (
                <img
                  src={documentUrl}
                  alt="Document preview"
                  className="document-image-preview"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              ) : (
                <iframe
                  src={documentUrl}
                  title="Document Preview"
                  className="document-iframe"
                />
              )
            ) : (
              <div className="preview-error">
                <FileText size={48} />
                <p>Unable to preview document</p>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && documentUrl && (
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
          <div className="signature-label-with-name">
            <PenTool size={18} />
            <div>
              <span className="signature-title">Your Digital Signature *</span>
              <p className="signer-name">
                Signing as:{" "}
                <strong>Principal - {approval.approver_name || "You"}</strong>
              </p>
            </div>
          </div>
          <p className="signature-description">
            Draw your signature below. This will be embedded in the document and
            cryptographically secured.
          </p>

          <div className="signature-canvas-wrapper">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: "signature-canvas",
                width: 600,
                height: 200,
              }}
              onEnd={() => {
                console.log("🖊️ Principal signature drawn");
                setError("");
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
            document as the Principal. This signature will be embedded in the
            document and is legally binding.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={handleClose}
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
                Sign & Approve as Principal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrincipalApprovalModal;
