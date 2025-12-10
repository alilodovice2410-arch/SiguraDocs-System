import React, { useState, useRef } from "react";
import { X, Upload, Camera, Trash2 } from "lucide-react";
import "./css/ProfilePictureModal.css";

const ProfilePictureModal = ({ isOpen, onClose, currentPicture, onUpdate }) => {
  const [preview, setPreview] = useState(currentPicture);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    // Read and preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!preview || preview === currentPicture) {
      onClose();
      return;
    }

    setUploading(true);
    try {
      await onUpdate(preview);
      onClose();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentPicture) return;

    if (!confirm("Are you sure you want to remove your profile picture?")) {
      return;
    }

    setUploading(true);
    try {
      await onUpdate(null); // null = remove picture
      setPreview(null);
      onClose();
    } catch (error) {
      console.error("Remove failed:", error);
      alert("Failed to remove profile picture");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div
        className="profile-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile-modal-header">
          <h2>Profile Picture</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="profile-modal-body">
          <div className="profile-preview">
            {preview ? (
              <img
                src={preview}
                alt="Profile preview"
                className="preview-image"
              />
            ) : (
              <div className="preview-placeholder">
                <Camera size={48} />
                <p>No profile picture</p>
              </div>
            )}
          </div>

          <div className="profile-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            <button
              className="profile-btn primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={20} />
              Choose Photo
            </button>

            {(preview || currentPicture) && (
              <button
                className="profile-btn danger"
                onClick={handleRemove}
                disabled={uploading}
              >
                <Trash2 size={20} />
                Remove Photo
              </button>
            )}
          </div>
        </div>

        <div className="profile-modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            className="save-btn"
            onClick={handleUpload}
            disabled={uploading || (!preview && !currentPicture)}
          >
            {uploading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePictureModal;
