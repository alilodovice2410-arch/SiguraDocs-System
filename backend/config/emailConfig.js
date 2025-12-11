// backend/config/emailConfig.js
const { Resend } = require("resend");

// Check which email service to use
const useResend = !!process.env.RESEND_API_KEY;

let resendClient = null;

// Initialize Resend if API key exists
if (useResend) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
  console.log("✅ Using Resend for email delivery (FREE - 3,000 emails/month)");
} else {
  console.log("⚠️ RESEND_API_KEY not set - emails will not work");
  console.log("   Add RESEND_API_KEY to Railway Variables");
  console.log("   Get your key from: https://resend.com/api-keys");
}

/**
 * Send email using Resend
 */
async function sendEmail(to, subject, html) {
  try {
    if (!useResend) {
      console.error("❌ Cannot send email - RESEND_API_KEY not configured");
      return false;
    }

    const { data, error } = await resendClient.emails.send({
      from: process.env.EMAIL_FROM || "SiguraDocs <onboarding@resend.dev>",
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log(`✅ Email sent via Resend to ${to} (ID: ${data.id})`);
    return true;
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
    return false;
  }
}

// Legacy compatibility - return transporter-like object
const getTransporter = () => {
  return {
    sendMail: async (mailOptions) => {
      return await sendEmail(
        mailOptions.to,
        mailOptions.subject,
        mailOptions.html
      );
    },
  };
};

const isEmailConfigured = () => {
  return !!process.env.RESEND_API_KEY;
};

module.exports = {
  getTransporter,
  isEmailConfigured,
  sendEmail,
};
