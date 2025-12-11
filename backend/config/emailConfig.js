// backend/config/emailConfig.js
const nodemailer = require("nodemailer");

// Create a single transporter instance to be reused
const createTransporter = () => {
  // Railway-optimized configuration - Use port 465 with SSL
  const config = {
    host: "smtp.gmail.com",
    port: 465, // Use 465 instead of 587 for Railway
    secure: true, // Use SSL/TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Use Gmail App Password here
    },
    // Extended timeouts for cloud environments
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000,
    socketTimeout: 60000,
    // Connection pooling for better performance
    pool: true,
    maxConnections: 5,
    maxMessages: 10,
    // Add these for Railway network compatibility
    tls: {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
  };

  const transporter = nodemailer.createTransport(config);

  // Test connection on startup (non-blocking)
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ Email transporter error:", error.message);
      console.log("⚠️ Email may not work. Check these settings:");
      console.log(
        "   - EMAIL_USER:",
        process.env.EMAIL_USER ? "✓ Set" : "✗ Not set"
      );
      console.log(
        "   - EMAIL_PASS:",
        process.env.EMAIL_PASS ? "✓ Set" : "✗ Not set"
      );
      console.log(
        "   - EMAIL_PORT:",
        process.env.EMAIL_PORT || "465 (default)"
      );
      console.log("\n📝 To fix:");
      console.log("   1. Go to https://myaccount.google.com/security");
      console.log("   2. Enable 2-Step Verification");
      console.log("   3. Generate an App Password for 'Mail'");
      console.log("   4. Use that 16-character password as EMAIL_PASS");
      console.log("   5. Ensure EMAIL_PORT=465 in Railway Variables");
    } else {
      console.log("✅ Email server is ready to send messages");
      console.log(`📧 Using Gmail account: ${process.env.EMAIL_USER}`);
      console.log(`📫 Using port: 465 (SSL/TLS)`);
    }
  });

  return transporter;
};

// Singleton instance
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

// Helper to check if email is configured
const isEmailConfigured = () => {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
};

module.exports = {
  getTransporter,
  isEmailConfigured,
};
