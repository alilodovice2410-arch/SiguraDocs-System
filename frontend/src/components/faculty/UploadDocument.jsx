import { useState, useEffect } from "react";
import { X, Upload, FileText, AlertCircle } from "lucide-react";
import api from "../../services/api";
import "./css/UploadDocument.css";

function UploadDocument({ isOpen, onClose, onSuccess }) {
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    doc_type_id: "",
    file: null,
  });
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchDocumentTypes();
    }
  }, [isOpen]);

  const fetchDocumentTypes = async () => {
    try {
      const response = await api.get("/documents/types/all");
      setDocumentTypes(response.data.types);
    } catch (error) {
      console.error("Error fetching document types:", error);
      setError("Failed to load document types");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setError("File size must be less than 10MB");
        return;
      }

      // Check file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];

      if (!allowedTypes.includes(file.type)) {
        setError(
          "Invalid file type. Please upload PDF, DOC, DOCX, XLS, XLSX, JPG, or PNG"
        );
        return;
      }

      setFormData({ ...formData, file });
      setFileName(file.name);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validation
      if (!formData.title.trim()) {
        setError("Please enter a document title");
        setLoading(false);
        return;
      }

      if (!formData.doc_type_id) {
        setError("Please select a document type");
        setLoading(false);
        return;
      }

      if (!formData.file) {
        setError("Please select a file to upload");
        setLoading(false);
        return;
      }

      // Create FormData
      const uploadData = new FormData();
      uploadData.append("title", formData.title.trim());
      uploadData.append("doc_type_id", formData.doc_type_id);
      uploadData.append("file", formData.file);

      // Upload document
      const response = await api.post("/documents/submit", uploadData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        // Success - reset form and close modal
        setFormData({ title: "", doc_type_id: "", file: null });
        setFileName("");
        onSuccess && onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Upload error:", error);
      setError(
        error.response?.data?.message ||
          "Failed to upload document. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ title: "", doc_type_id: "", file: null });
      setFileName("");
      setError("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="upload-modal-overlay" onClick={handleClose}>
      <div
        className="upload-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="upload-modal-header">
          <div>
            <h2>Upload Document</h2>
            <p>Submit a new document for approval</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="upload-modal-close"
            disabled={loading}
          >
            <X />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="upload-error-message">
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="upload-form">
          {/* Document Title */}
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Document Title <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="form-input"
              placeholder="Enter document title"
              disabled={loading}
              required
            />
          </div>

          {/* Document Type */}
          <div className="form-group">
            <label htmlFor="doc_type" className="form-label">
              Document Type <span className="required">*</span>
            </label>
            <select
              id="doc_type"
              value={formData.doc_type_id}
              onChange={(e) =>
                setFormData({ ...formData, doc_type_id: e.target.value })
              }
              className="form-select"
              disabled={loading}
              required
            >
              <option value="">Select document type</option>
              {documentTypes.map((type) => (
                <option key={type.doc_type_id} value={type.doc_type_id}>
                  {type.type_name}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div className="form-group">
            <label htmlFor="file" className="form-label">
              File Upload <span className="required">*</span>
            </label>
            <div className="file-upload-wrapper">
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                className="file-input"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                disabled={loading}
                required
              />
              <label htmlFor="file" className="file-upload-label">
                {fileName ? (
                  <div className="file-selected">
                    <FileText />
                    <span>{fileName}</span>
                  </div>
                ) : (
                  <div className="file-placeholder">
                    <Upload />
                    <span>Click to upload or drag and drop</span>
                    <span className="file-hint">
                      PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10MB)
                    </span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={handleClose}
              className="btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner"></span>
                  Uploading...
                </span>
              ) : (
                <span className="btn-text">
                  <Upload />
                  Upload Document
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UploadDocument;
