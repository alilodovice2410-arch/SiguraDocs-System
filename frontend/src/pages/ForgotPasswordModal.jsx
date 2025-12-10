import { useState } from "react";
import { X, Mail, Lock, CheckCircle, AlertCircle } from "lucide-react";
import authService from "../services/authService";
import "./css/ForgotPasswordModal.css";

function ForgotPasswordModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1); // 1: Email, 2: Code + New Password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Reset modal state
  const resetModal = () => {
    setStep(1);
    setEmail("");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
    setLoading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Step 1: Request reset code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);

    try {
      await authService.requestPasswordReset(email);
      setSuccess("Verification code sent to your email!");
      setTimeout(() => {
        setStep(2);
        setSuccess("");
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to send code. Please check your email."
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!code) {
      setError("Please enter the verification code");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(email, code, newPassword);
      setSuccess("Password reset successful! Redirecting to login...");
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to reset password. Please check your code."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>
          <X size={20} />
        </button>

        <div className="modal-header">
          <div className="modal-icon">
            {step === 1 ? <Mail size={32} /> : <Lock size={32} />}
          </div>
          <h2 className="modal-title">
            {step === 1 ? "Forgot Password?" : "Reset Password"}
          </h2>
          <p className="modal-description">
            {step === 1
              ? "Enter your email to receive a verification code"
              : "Enter the code sent to your email and create a new password"}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}

        {step === 1 ? (
          // Step 1: Email Input
          <form onSubmit={handleRequestCode} className="modal-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-container">
                <Mail className="input-icon" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="Enter your registered email"
                  disabled={loading}
                  required
                />
              </div>
              <p className="form-helper-text">
                We'll send a 6-digit verification code to this email
              </p>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Sending..." : "Send Verification Code"}
            </button>
          </form>
        ) : (
          // Step 2: Code + New Password
          <form onSubmit={handleResetPassword} className="modal-form">
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <div className="input-container">
                <Lock className="input-icon" size={18} />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="input-field code-input"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  disabled={loading}
                  required
                />
              </div>
              <p className="form-helper-text">
                Check your email ({email}) for the code
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <div className="input-container">
                <Lock className="input-icon" size={18} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field"
                  placeholder="Enter new password (min. 8 characters)"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <div className="input-container">
                <Lock className="input-icon" size={18} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="Confirm new password"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCode("");
                setNewPassword("");
                setConfirmPassword("");
                setError("");
              }}
              className="btn-secondary"
              disabled={loading}
            >
              Back to Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordModal;
