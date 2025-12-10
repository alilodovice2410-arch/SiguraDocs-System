// backend/routes/passwordReset.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { getTransporter, isEmailConfigured } = require("../config/emailConfig");

// Store verification codes temporarily (in production, use Redis or database)
const verificationCodes = new Map();

// Generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /auth/request-password-reset
router.post("/request-password-reset", async (req, res) => {
  try {
    console.log("📧 Password reset request received for:", req.body.email);

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email is configured
    if (!isEmailConfigured()) {
      console.error("❌ Email not configured");
      return res.status(500).json({
        message:
          "Email service is not configured. Please contact administrator.",
      });
    }

    // Check if user exists
    let users;
    try {
      const result = await db.query(
        "SELECT user_id, full_name, email FROM users WHERE email = ?",
        [email]
      );

      users = Array.isArray(result[0]) ? result[0] : result;
      console.log("📊 Query result:", users);
    } catch (dbError) {
      console.error("❌ Database query error:", dbError);
      return res.status(500).json({
        message: "Database error. Please try again.",
      });
    }

    if (!users || users.length === 0) {
      console.log("⚠️ No user found with email:", email);
      return res.status(404).json({
        message: "No account found with this email address",
      });
    }

    const user = users[0];
    console.log("✅ User found:", user.full_name);

    // Generate verification code
    const code = generateCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store code with expiration
    verificationCodes.set(email, {
      code,
      expiresAt,
      userId: user.user_id,
    });

    console.log("🔑 Generated code:", code, "for", email);

    // Send email with code
    const mailOptions = {
      from: `"SiguraDocs" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "SiguraDocs - Password Reset Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2d4739 0%, #3d5a49 100%); 
                      color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: white; border: 2px dashed #2d4739; padding: 20px; 
                        text-align: center; margin: 20px 0; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; color: #2d4739; 
                    letter-spacing: 5px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; 
                       padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
              <p>San Mariano National High School</p>
            </div>
            <div class="content">
              <p>Hello <strong>${user.full_name}</strong>,</p>
              <p>We received a request to reset your password for your SiguraDocs account.</p>
              
              <div class="code-box">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">Your verification code is:</p>
                <div class="code">${code}</div>
              </div>

              <p><strong>This code will expire in 10 minutes.</strong></p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Never share this code with anyone</li>
                  <li>SiguraDocs staff will never ask for this code</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>

              <p>If you didn't request a password reset, you can safely ignore this email. 
                 Your password will remain unchanged.</p>

              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>SiguraDocs Team</strong>
              </p>
            </div>
            <div class="footer">
              <p>© 2024 SiguraDocs - San Mariano National High School</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log("📤 Attempting to send email to:", email);

    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully:", info.messageId);

      res.status(200).json({
        message: "Verification code sent successfully to your email",
      });
    } catch (emailError) {
      console.error("❌ Email sending error:", emailError);
      console.error("Error details:", {
        code: emailError.code,
        command: emailError.command,
        response: emailError.response,
      });

      return res.status(500).json({
        message: "Failed to send email. Please try again or contact support.",
        error: emailError.message,
      });
    }
  } catch (error) {
    console.error("❌ Request password reset error:", error);
    res.status(500).json({
      message: "Failed to send verification code. Please try again.",
      error: error.message,
    });
  }
});

// POST /auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    console.log("🔐 Password reset attempt for:", req.body.email);

    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        message: "Email, code, and new password are required",
      });
    }

    // Validate password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    // Check if code exists and is valid
    const storedData = verificationCodes.get(email);

    if (!storedData) {
      console.log("⚠️ No code found for email:", email);
      return res.status(400).json({
        message: "Invalid or expired verification code",
      });
    }

    // Check if code matches
    if (storedData.code !== code) {
      console.log("⚠️ Code mismatch for:", email);
      return res.status(400).json({
        message: "Incorrect verification code",
      });
    }

    // Check if code has expired
    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(email);
      console.log("⚠️ Code expired for:", email);
      return res.status(400).json({
        message: "Verification code has expired. Please request a new one.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password_hash in database
    try {
      await db.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [
        hashedPassword,
        storedData.userId,
      ]);
      console.log("✅ Password_hash updated for user:", storedData.userId);
    } catch (dbError) {
      console.error("❌ Database update error:", dbError);
      return res.status(500).json({
        message: "Failed to update password. Please try again.",
      });
    }

    // Delete used code
    verificationCodes.delete(email);

    // Send confirmation email (non-blocking)
    if (isEmailConfigured()) {
      const confirmMailOptions = {
        from: `"SiguraDocs" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "SiguraDocs - Password Successfully Reset",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #2d4739 0%, #3d5a49 100%); 
                        color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .success-box { background: #d1fae5; border-left: 4px solid #10b981; 
                             padding: 15px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✓ Password Reset Successful</h1>
              </div>
              <div class="content">
                <div class="success-box">
                  <strong>Your password has been successfully reset!</strong>
                </div>
                
                <p>You can now log in to SiguraDocs using your new password.</p>
                
                <p><strong>If you did not make this change, please contact your administrator immediately.</strong></p>
                
                <p style="margin-top: 30px;">
                  Best regards,<br>
                  <strong>SiguraDocs Team</strong>
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      try {
        const transporter = getTransporter();
        await transporter.sendMail(confirmMailOptions);
        console.log("✅ Confirmation email sent to:", email);
      } catch (emailError) {
        console.error("⚠️ Confirmation email failed:", emailError);
        // Don't fail the request if confirmation email fails
      }
    }

    res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({
      message: "Failed to reset password. Please try again.",
      error: error.message,
    });
  }
});

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired verification codes`);
  }
}, 5 * 60 * 1000);

module.exports = router;
