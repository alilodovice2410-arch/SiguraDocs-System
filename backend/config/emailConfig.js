const nodemailer = require("nodemailer");

// Email transporter - Railway-compatible with Port 465
let transporter = null;

// Only initialize if email is enabled
if (process.env.EMAIL_ENABLED !== "false") {
  try {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465, // SSL port - more reliable on Railway
      secure: true, // true for port 465, false for port 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Longer timeouts for Railway
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
      socketTimeout: 30000,
      // TLS configuration
      tls: {
        rejectUnauthorized: false, // Accept self-signed certificates
        minVersion: "TLSv1.2",
      },
      // Enable debug for troubleshooting
      debug: process.env.NODE_ENV === "development",
      logger: process.env.NODE_ENV === "development",
    });

    // Verify connection configuration (async, non-blocking)
    transporter
      .verify()
      .then(() => {
        console.log("✅ Email server ready (Port 465 - SSL)");
      })
      .catch((error) => {
        console.log("⚠️ Email verification failed:", error.message);
        console.log("📧 App will continue without email functionality");
        transporter = null;
      });
  } catch (error) {
    console.log("⚠️ Email setup failed:", error.message);
    transporter = null;
  }
} else {
  console.log("📧 Email functionality is disabled (EMAIL_ENABLED=false)");
}

/**
 * Send email with error handling
 */
async function sendEmail(options) {
  if (process.env.EMAIL_ENABLED === "false") {
    console.log("📧 Email disabled - would have sent:", options.subject);
    return { success: true, message: "Email disabled in config" };
  }

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
};
