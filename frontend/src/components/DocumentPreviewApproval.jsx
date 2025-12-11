import { useState, useRef, useEffect } from "react";
import {
  X,
  PenTool,
  Trash2,
  CheckCircle,
  Eye,
  FileText,
  Download,
  AlertCircle,
  Loader,
  Upload,
} from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import api from "../services/api";
import "./css/DocumentPreviewApproval.css";

function DocumentPreviewApproval({ isOpen, onClose, approval, onSuccess }) {
  const sigCanvas = useRef(null);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [documentUrl, setDocumentUrl] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [fileType, setFileType] = useState(null);
  const [canPreview, setCanPreview] = useState(false);
  const [convertingPreview, setConvertingPreview] = useState(false);
  const [isFileMissing, setIsFileMissing] = useState(false);

  useEffect(() => {
    if (isOpen && approval) {
      loadDocumentPreview();
    }

    return () => {
      if (documentUrl) {
        URL.revokeObjectURL(documentUrl);
      }
    };
  }, [isOpen, approval]);

  const loadDocumentPreview = async () => {
    try {
      setLoadingDoc(true);
      setError("");
      setIsFileMissing(false);

      console.log("📄 Loading document preview for ID:", approval.document_id);

      const fileName = approval.file_name || approval.title || "";
      const extension = fileName.split(".").pop().toLowerCase();
      setFileType(extension);

      console.log("   - File name:", fileName);
      console.log("   - Extension:", extension);

      // Native preview types (can be displayed directly in browser)
      const nativePreviewTypes = ["pdf", "jpg", "jpeg", "png", "gif", "txt"];

      // Office types that need conversion for preview
      const officeTypes = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

      const isNativePreview = nativePreviewTypes.includes(extension);
      const isOfficeDoc = officeTypes.includes(extension);

      setCanPreview(isNativePreview || isOfficeDoc);

      if (isNativePreview) {
        // Direct preview for PDF, images, text
        const response = await api.get(
          `/documents/${approval.document_id}/download`,
          {
            responseType: "blob",
          }
        );

        console.log("✅ Document loaded (native preview)");

        if (!response.data || response.data.size === 0) {
          throw new Error("Empty document received");
        }

        let blob = response.data;

        // Ensure correct MIME types
        if (extension === "pdf") {
          if (!blob.type.includes("pdf")) {
            blob = new Blob([response.data], { type: "application/pdf" });
          }

          const arrayBuffer = await blob.slice(0, 5).arrayBuffer();
          const header = new TextDecoder().decode(arrayBuffer);

          if (!header.startsWith("%PDF")) {
            throw new Error(
              "File appears to be corrupted or is not a valid PDF"
            );
          }
        } else if (["jpg", "jpeg", "png", "gif"].includes(extension)) {
          const mimeTypes = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
          };

          if (!blob.type.includes("image")) {
            blob = new Blob([response.data], { type: mimeTypes[extension] });
          }
        } else if (extension === "txt") {
          if (!blob.type.includes("text")) {
            blob = new Blob([response.data], { type: "text/plain" });
          }
        }

        const url = URL.createObjectURL(blob);
        setDocumentUrl(url);
      } else if (isOfficeDoc) {
        // Request PDF conversion for preview
        setConvertingPreview(true);
        console.log(
          "📄 Requesting Office document conversion to PDF preview..."
        );

        const response = await api.get(
          `/documents/${approval.document_id}/preview`,
          {
            responseType: "blob",
          }
        );

        if (!response.data || response.data.size === 0) {
          throw new Error("Failed to generate preview");
        }

        const pdfBlob = new Blob([response.data], { type: "application/pdf" });
        const url = URL.createObjectURL(pdfBlob);
        setDocumentUrl(url);
        console.log("✅ Office document converted to PDF for preview");
        setConvertingPreview(false);
      }
    } catch (error) {
      console.error("❌ Failed to load document:", error);

      // ✅ IMPROVED ERROR HANDLING
      if (error.response?.status === 404) {
        setIsFileMissing(true);
        setError(
          "⚠️ Document File Not Found: This document was uploaded before the storage system was properly configured. The file is no longer available on the server."
        );
      } else if (error.response?.status === 503) {
        setError(
          "Document preview conversion is temporarily unavailable. Please try downloading the file instead."
        );
      } else {
        setError(error.message || "Failed to load document preview");
      }

      setConvertingPreview(false);
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await api.get(
        `/documents/${approval.document_id}/download`,
        {
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", approval.file_name || approval.title);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      console.log("✅ File downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);

      if (error.response?.status === 404) {
        alert(
          "❌ File not found on server. This document may need to be re-uploaded."
        );
      } else {
        alert("Failed to download document");
      }
    }
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setError("");
  };

  const handleApprove = async () => {
    console.log("\n🖊️ ===== SIGNATURE APPROVAL DEBUG =====");

    if (!sigCanvas.current) {
      setError("Signature canvas not initialized");
      return;
    }

    if (sigCanvas.current.isEmpty()) {
      setError("Please provide your signature before approving");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const signatureImage = sigCanvas.current.toDataURL("image/png");

      if (!signatureImage.startsWith("data:image/")) {
        throw new Error("Invalid signature image format");
      }

      const requestPayload = {
        comments: comments.trim() || "Approved",
        signature_image: signatureImage,
      };

      const response = await api.post(
        `/approvals/${approval.approval_id}/approve`,
        requestPayload
      );

      if (response.data.success) {
        if (documentUrl) {
          URL.revokeObjectURL(documentUrl);
        }

        if (onSuccess) {
          onSuccess();
        }

        alert("✅ Document approved and digitally signed successfully!");
        onClose();
      }
    } catch (err) {
      console.error("❌ Approval error:", err);
      setError(
        err.response?.data?.message ||
          "Failed to approve document. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (documentUrl) {
      URL.revokeObjectURL(documentUrl);
    }
    setComments("");
    setError("");
    setIsFileMissing(false);
    onClose();
  };

  const getFileIcon = () => {
    const icons = {
      pdf: "📄",
      doc: "📝",
      docx: "📝",
      xls: "📊",
      xlsx: "📊",
      ppt: "📊",
      pptx: "📊",
      jpg: "🖼️",
      jpeg: "🖼️",
      png: "🖼️",
      txt: "📃",
    };
    return icons[fileType] || "📎";
  };

  const getFileTypeLabel = () => {
    const labels = {
      pdf: "PDF Document",
      doc: "Word Document",
      docx: "Word Document",
      xls: "Excel Spreadsheet",
      xlsx: "Excel Spreadsheet",
      ppt: "PowerPoint Presentation",
      pptx: "PowerPoint Presentation",
      jpg: "Image",
      jpeg: "Image",
      png: "Image",
      txt: "Text File",
    };
    return labels[fileType] || fileType?.toUpperCase() + " File";
  };

  if (!isOpen || !approval) return null;

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
              <h2>Review & Sign Document</h2>
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

        {/* ✅ IMPROVED: File Missing Warning */}
        {isFileMissing && (
          <div
            className="file-missing-warning"
            style={{
              background: "#FEF3C7",
              border: "1px solid #F59E0B",
              borderRadius: "8px",
              padding: "16px",
              margin: "16px 24px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <AlertCircle
              size={24}
              color="#F59E0B"
              style={{ flexShrink: 0, marginTop: "2px" }}
            />
            <div style={{ flex: 1 }}>
              <h4
                style={{
                  margin: "0 0 8px 0",
                  color: "#92400E",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Document File Not Available
              </h4>
              <p
                style={{
                  margin: "0 0 12px 0",
                  color: "#78350F",
                  fontSize: "13px",
                  lineHeight: "1.5",
                }}
              >
                This document was uploaded during system development before
                permanent storage was configured. The file is no longer
                available on the server.
              </p>
              <div
                style={{
                  background: "white",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #FCD34D",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px 0",
                    fontWeight: 600,
                    color: "#92400E",
                    fontSize: "13px",
                  }}
                >
                  ✅ Recommended Action:
                </p>
                <p style={{ margin: 0, color: "#78350F", fontSize: "13px" }}>
                  Contact <strong>{approval.submitter_name}</strong> to
                  re-upload this document. All new uploads are now saved to
                  permanent storage and will remain available.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Document Preview */}
        <div className="document-preview-section">
          <div className="preview-header">
            <FileText size={18} />
            <span>Document Preview</span>
            {!isFileMissing && (
              <button
                onClick={handleDownload}
                className="download-btn-header"
                title="Download document"
              >
                <Download size={16} />
                Download
              </button>
            )}
          </div>

          <div className="preview-container">
            {loadingDoc || convertingPreview ? (
              <div className="preview-loading">
                <div className="spinner"></div>
                <p>
                  {convertingPreview
                    ? "Converting document for preview..."
                    : "Loading document..."}
                </p>
              </div>
            ) : isFileMissing ? (
              <div className="no-preview-available">
                <div className="file-icon-large">❌</div>
                <h3>File Not Found</h3>
                <p className="file-name">
                  {approval.file_name || approval.title}
                </p>
                <div
                  className="preview-notice"
                  style={{ background: "#FEF3C7", borderColor: "#F59E0B" }}
                >
                  <AlertCircle size={20} color="#F59E0B" />
                  <p>
                    <strong>
                      This file is no longer available on the server.
                    </strong>
                    <br />
                    Please contact the document submitter to re-upload it.
                  </p>
                </div>
              </div>
            ) : !canPreview ? (
              <div className="no-preview-available">
                <div className="file-icon-large">{getFileIcon()}</div>
                <h3>{getFileTypeLabel()}</h3>
                <p className="file-name">
                  {approval.file_name || approval.title}
                </p>
                <div className="preview-notice">
                  <AlertCircle size={20} />
                  <p>
                    <strong>Preview not available for this file type.</strong>
                    <br />
                    Please download the file to view its contents.
                  </p>
                </div>
                <button onClick={handleDownload} className="download-btn-large">
                  <Download size={20} />
                  Download File
                </button>
              </div>
            ) : documentUrl ? (
              <iframe
                src={`${documentUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                title="Document Preview"
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

        {/* Signature Notice for Office Documents */}
        {!isFileMissing &&
          ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(fileType) && (
            <div className="signature-embedding-notice">
              <CheckCircle size={18} color="#0B8043" />
              <p>
                <strong>Signature Embedding:</strong> When you approve this
                document, your signature will be permanently embedded into the{" "}
                {fileType.toUpperCase()} file. The signed file will be available
                for download with visible signatures.
              </p>
            </div>
          )}

        {/* Error Message */}
        {error && !isFileMissing && (
          <div className="error-message">
            <span>{error}</span>
          </div>
        )}

        {/* Comments Section */}
        {!isFileMissing && (
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
        )}

        {/* Signature Section */}
        {!isFileMissing && (
          <div className="signature-section">
            <div className="signature-label-with-name">
              <PenTool size={18} />
              <div>
                <span className="signature-title">
                  Your Digital Signature *
                </span>
                <p className="signer-name">
                  Signing as: <strong>{approval.approver_name || "You"}</strong>
                </p>
              </div>
            </div>
            <p className="signature-description">
              Draw your signature below. This will be embedded in the document
              and cryptographically secured.
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
        )}

        {/* Security Notice */}
        {!isFileMissing && (
          <div className="security-notice">
            <div className="notice-icon">⚠️</div>
            <p>
              By clicking "Sign & Approve", you are digitally signing this
              document. This signature will be permanently embedded and is
              legally binding.
            </p>
          </div>
        )}

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
          {!isFileMissing && (
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
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentPreviewApproval;
