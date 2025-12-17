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
      console.log("📂 Opening preview for document:", documentId);
      loadSignedDocument();
      fetchSignatures();
    }

    return () => {
      if (previewUrl) {
        console.log("🧹 Cleaning up preview URL");
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, documentId]);

  const loadSignedDocument = async () => {
    try {
      setLoading(true);
      setError("");
      setPreviewUrl(null); // Clear previous preview

      console.log("📄 Loading signed document preview for ID:", documentId);

      // Get document details first to check file type and status
      const detailsResponse = await api.get(`/documents/${documentId}`);
      const document = detailsResponse.data.document;

      console.log("📋 Document details:", {
        title: document.title,
        status: document.status,
        file_name: document.file_name,
      });

      const fileName = document.file_name || document.title || "";
      const extension = fileName.split(".").pop().toLowerCase();
      setFileType(extension);

      console.log("   - File extension:", extension);
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
      console.log("📥 Fetching signed document from server...");
      const response = await api.get(`/documents/${documentId}/download`, {
        responseType: "blob",
      });

      console.log("📦 Received response:", {
        size: response.data.size,
        type: response.data.type,
      });

      if (!response.data || response.data.size === 0) {
        throw new Error("Empty document received");
      }

      let blob = response.data;
      const contentType = response.headers["content-type"] || "";

      console.log("🔍 Content type:", contentType);

      // For PDF preview, ensure correct MIME type
      if (contentType.includes("pdf") || extension === "pdf") {
        if (!blob.type.includes("pdf")) {
          blob = new Blob([response.data], { type: "application/pdf" });
        }

        // Verify it's actually a PDF
        const arrayBuffer = await blob.slice(0, 5).arrayBuffer();
        const header = new TextDecoder().decode(arrayBuffer);

        console.log("📄 PDF header check:", header.substring(0, 4));

        if (!header.startsWith("%PDF")) {
          throw new Error("File appears to be corrupted or is not a valid PDF");
        }

        const url = URL.createObjectURL(blob);
        console.log("✅ Created object URL for PDF preview");
        setPreviewUrl(url);
        setFileType("pdf");
      } else if (
        extension === "docx" ||
        extension === "doc" ||
        extension === "pptx" ||
        extension === "ppt"
      ) {
        // Office files are converted to PDF by backend
        blob = new Blob([response.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        console.log("✅ Created object URL for converted Office document");
        setPreviewUrl(url);
        setFileType("pdf");
      } else if (extension === "xlsx" || extension === "xls") {
        // Excel files cannot be previewed in browser
        setError(
          `Preview is not available for Excel files. Please download the signed document to view it.`
        );
      } else {
        // For other file types, show download message
        setError(
          `Preview is not available for ${extension.toUpperCase()} files. Please download the signed document to view it.`
        );
      }

      setLoading(false);
    } catch (error) {
      console.error("❌ Failed to load signed document:", error);
      console.error("Error details:", error.response?.data);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to load document preview"
      );
      setLoading(false);
    }
  };

  const fetchSignatures = async () => {
    try {
      console.log("🔍 Fetching signatures for document:", documentId);
      const response = await api.get(`/approvals/signatures/${documentId}`);
      console.log("✅ Signatures fetched:", response.data.signatures.length);
      setSignatures(response.data.signatures || []);
    } catch (error) {
      console.error("Failed to fetch signatures:", error);
    }
  };

  const handleDownload = async () => {
    try {
      console.log("⬇️ Downloading signed document:", documentId);
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
    setLoading(false);
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
        {signatures.length > 0 && !loading && !error && (
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
                <small>Please wait while we prepare the preview</small>
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
                onLoad={() => console.log("✅ PDF iframe loaded successfully")}
                onError={(e) => {
                  console.error("❌ PDF iframe load error:", e);
                  setError("Failed to display document preview");
                }}
              />
            ) : (
              <div className="preview-error">
                <FileText size={48} />
                <p>Unable to preview document</p>
                <button onClick={handleDownload} className="download-btn-large">
                  <Download size={20} />
                  Download Document
                </button>
              </div>
            )}
          </div>
        </div>

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
