import { useState, useEffect } from "react";
import {
  X,
  Download,
  FileText,
  AlertCircle,
  Loader,
  Shield,
} from "lucide-react";
import api from "../../services/api";
import "./css/SignedDocumentPreview.css";

function SignedDocumentPreview({ isOpen, onClose, documentId, documentTitle }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [fileType, setFileType] = useState(null);

  useEffect(() => {
    if (isOpen && documentId) {
      loadSignedDocument();
      fetchSignatures();
    }

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, documentId]);

  const loadSignedDocument = async () => {
    try {
      setLoading(true);
      setError("");

      console.log("📄 Loading signed document preview for ID:", documentId);

      // Get document details first to check file type
      const detailsResponse = await api.get(`/documents/${documentId}`);
      const document = detailsResponse.data.document;

      const fileName = document.file_name || document.title || "";
      const extension = fileName.split(".").pop().toLowerCase();
      setFileType(extension);

      console.log("   - File name:", fileName);
      console.log("   - Extension:", extension);
      console.log("   - Status:", document.status);

      // Only show preview for approved documents
      if (document.status !== "approved") {
        setError(
          "This document has not been approved yet. Preview with signatures is only available for approved documents."
        );
        setLoading(false);
        return;
      }

      // Request the signed document (backend will embed signatures automatically)
      const response = await api.get(`/documents/${documentId}/download`, {
        responseType: "blob",
      });

      if (!response.data || response.data.size === 0) {
        throw new Error("Empty document received");
      }

      let blob = response.data;

      // For PDF preview, ensure correct MIME type
      const contentType = response.headers["content-type"] || "";

      if (contentType.includes("pdf") || extension === "pdf") {
        if (!blob.type.includes("pdf")) {
          blob = new Blob([response.data], { type: "application/pdf" });
        }

        // Verify it's actually a PDF
        const arrayBuffer = await blob.slice(0, 5).arrayBuffer();
        const header = new TextDecoder().decode(arrayBuffer);

        if (!header.startsWith("%PDF")) {
          throw new Error("File appears to be corrupted or is not a valid PDF");
        }

        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        console.log("✅ Signed PDF preview loaded");
      } else {
        // For other file types, show download message
        setError(
          `Preview is not available for ${extension.toUpperCase()} files. Please download the signed document to view it.`
        );
      }

      setLoading(false);
    } catch (error) {
      console.error("❌ Failed to load signed document:", error);
      setError(error.message || "Failed to load document preview");
      setLoading(false);
    }
  };

  const fetchSignatures = async () => {
    try {
      const response = await api.get(`/approvals/signatures/${documentId}`);
      setSignatures(response.data.signatures || []);
    } catch (error) {
      console.error("Failed to fetch signatures:", error);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await api.get(`/documents/${documentId}/download`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Get filename from response headers or use default
      const contentDisposition = response.headers["content-disposition"];
      let filename = `SIGNED_${documentTitle}`;

      if (contentDisposition) {
        const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
          contentDisposition
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "");
        }
      }

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      console.log("✅ Signed document downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download signed document");
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="signed-preview-modal-overlay" onClick={handleClose}>
      <div
        className="signed-preview-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="signed-preview-modal-header">
          <div className="header-content">
            <div className="header-icon">
              <Shield />
            </div>
            <div>
              <h2>Signed Document Preview</h2>
              <p>{documentTitle}</p>
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

        {/* Signature Info Banner */}
        {signatures.length > 0 && (
          <div className="signature-info-banner">
            <Shield size={20} />
            <div>
              <strong>This document has been digitally signed</strong>
              <p>
                {signatures.length} signature{signatures.length > 1 ? "s" : ""}{" "}
                embedded in this document
              </p>
            </div>
          </div>
        )}

        {/* Document Preview */}
        <div className="signed-document-preview-section">
          <div className="preview-header">
            <FileText size={18} />
            <span>Document with Digital Signatures</span>
            <button
              onClick={handleDownload}
              className="download-btn-header"
              title="Download signed document"
              disabled={loading || !!error}
            >
              <Download size={16} />
              Download
            </button>
          </div>

          <div className="preview-container">
            {loading ? (
              <div className="preview-loading">
                <div className="spinner"></div>
                <p>Loading signed document...</p>
              </div>
            ) : error ? (
              <div className="preview-error">
                <AlertCircle size={48} />
                <h3>Preview Not Available</h3>
                <p>{error}</p>
                <button onClick={handleDownload} className="download-btn-large">
                  <Download size={20} />
                  Download Signed Document
                </button>
              </div>
            ) : previewUrl ? (
              <iframe
                src={`${previewUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                title="Signed Document Preview"
                className="document-iframe"
              />
            ) : (
              <div className="preview-error">
                <FileText size={48} />
                <p>Unable to preview document</p>
              </div>
            )}
          </div>
        </div>

        {/* Signatures List */}
        {signatures.length > 0 && (
          <div className="signatures-summary">
            <h3>Document Signatures</h3>
            <div className="signatures-list-compact">
              {signatures.map((sig, index) => (
                <div
                  key={sig.signature_id || index}
                  className="signature-item-compact"
                >
                  <div className="signature-level">
                    Level {sig.approval_level}
                  </div>
                  <div className="signature-details">
                    <strong>{sig.signer_name}</strong>
                    <span>{sig.signer_role}</span>
                  </div>
                  <div className="signature-date">
                    {new Date(sig.signed_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="security-notice-preview">
          <div className="notice-icon">🔒</div>
          <p>
            All signatures are cryptographically secured and embedded in the
            document. Any modification to this document will invalidate the
            signatures.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions">
          <button
            type="button"
            className="close-button-action"
            onClick={handleClose}
          >
            Close
          </button>
          <button
            type="button"
            className="download-button-action"
            onClick={handleDownload}
            disabled={loading || !!error}
          >
            <Download size={18} />
            Download Signed Document
          </button>
        </div>
      </div>
    </div>
  );
}

export default SignedDocumentPreview;
