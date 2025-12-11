// backend/config/emailConfig.js
const nodemailer = require("nodemailer");

// Email transporter - with Railway-safe configuration
let transporter = null;

// Only initialize if email is enabled
if (process.env.EMAIL_ENABLED !== "false") {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true", // true for 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Better timeout handling for Railway
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
      // Ignore TLS errors in production (Railway environment)
      tls: {
        rejectUnauthorized: false,
      },
    });

    // CRITICAL: Make verification truly non-blocking
    // Use setImmediate to defer verification until after server starts
    setImmediate(() => {
      if (transporter) {
        transporter
          .verify()
          .then(() => {
            console.log("✅ Email server is ready to send messages");
          })
          .catch((error) => {
            console.log(
              "⚠️ Email transporter error (non-critical):",
              error.message
            );
            console.log("📧 App will continue without email functionality");
            // Don't set transporter to null - it might still work for sending
          });
      }
    });
  } catch (error) {
    console.log("⚠️ Email setup failed (non-critical):", error.message);
    console.log("📧 App will continue without email functionality");
    transporter = null;
  }
} else {
  console.log("📧 Email functionality is disabled (EMAIL_ENABLED=false)");
}

/**
 * Check if email is configured and ready
 * @returns {boolean}
 */
function isEmailConfigured() {
  return transporter !== null && process.env.EMAIL_ENABLED !== "false";
}

/**
 * Get transporter instance (for testing purposes)
 * @returns {Object|null}
 */
function getTransporter() {
  return transporter;
}

/**
 * Send email with error handling
 * @param {Object} options - Email options (to, subject, text, html)
 * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
 */
async function sendEmail(options) {
  // Check if email is enabled
  if (process.env.EMAIL_ENABLED === "false") {
    console.log("📧 Email disabled - would have sent:", options.subject);
    return { success: true, message: "Email disabled in config" };
  }

  // Check if transporter is available
  if (!transporter) {
    console.log("⚠️ Email not configured, skipping email send");
    return { success: false, message: "Email service unavailable" };
  }

  try {
    const info = await transporter.sendMail(options);
    console.log("✅ Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Failed to send email:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"SiguraDocs" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Password Reset Request - SiguraDocs",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password for your SiguraDocs account.</p>
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated email from SiguraDocs. Please do not reply.</p>
      </div>
    `,
    text: `You requested to reset your password. Visit this link: ${resetUrl}`,
  };

  return await sendEmail(mailOptions);
}

/**
 * Send notification email
 */
async function sendNotificationEmail(email, subject, message) {
  const mailOptions = {
    from: `"SiguraDocs" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>${message}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated email from SiguraDocs. Please do not reply.</p>
      </div>
    `,
    text: message,
  };

  return await sendEmail(mailOptions);
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
  isEmailConfigured,
  getTransporter,
};
