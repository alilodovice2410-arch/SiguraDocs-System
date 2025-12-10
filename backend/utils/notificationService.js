// backend/utils/notificationService.js
const { pool } = require("../config/database");
const { getTransporter, isEmailConfigured } = require("../config/emailConfig");

async function sendEmail(to, subject, html, text) {
  // If email credentials are not set, skip sending but log
  if (!isEmailConfigured()) {
    console.log("Email not configured - skipping email send");
    return;
  }

  const transporter = getTransporter();

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text: text || html,
      html,
    });
    console.log(`✅ Email sent to ${to} (${subject})`);
  } catch (err) {
    console.error(
      "❌ Failed to send email:",
      err && err.message ? err.message : err
    );
    // Don't throw – email is best-effort
  }
}

/**
 * notifyUser
 * Inserts an in-system notification and sends an email (best-effort).
 *
 * Parameters:
 * - userId: recipient user id
 * - documentId: optional document id (used to build web link)
 * - title: notification title (string)
 * - message: notification message (string)
 * - type: one of 'info'|'warning'|'success'|'error' (optional)
 * - connection: optional mysql connection instance to use in same transaction
 */
async function notifyUser(
  userId,
  documentId,
  title,
  message,
  type = "info",
  connection = null
) {
  // Use provided connection (transaction-aware) when present
  const db = connection || pool;

  // Validate type against DB enum (info, warning, success, error)
  const validTypes = ["info", "warning", "success", "error"];
  const notifType = validTypes.includes(type) ? type : "info";

  try {
    // Insert into notifications table (use supplied connection if available)
    await db.query(
      `INSERT INTO notifications (user_id, document_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
      [userId, documentId || null, title, message, notifType]
    );
    console.log(`✅ Notification inserted for user ${userId}: ${title}`);
  } catch (err) {
    console.error(
      "❌ Error inserting notification into DB:",
      err && err.message ? err.message : err
    );
    // continue to attempt email (do not throw)
  }

  // Attempt to fetch user's email and send an email
  try {
    // Use db (transaction-aware) for user lookup as well; if a connection was passed,
    // the user's row will be consistent with the transaction context.
    const [rows] = await db.query(
      "SELECT email, full_name FROM users WHERE user_id = ?",
      [userId]
    );
    const user = rows && rows[0];
    if (user && user.email) {
      const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
      const docLink = documentId
        ? `${frontend}/documents/${documentId}`
        : frontend;
      const subject = title;
      const html = `
        <p>Hi ${user.full_name || ""},</p>
        <p>${message}</p>
        ${documentId ? `<p><a href="${docLink}">View document</a></p>` : ""}
        <hr/>
        <p style="font-size:12px;color:#666">This is an automated notification from SiguraDocs</p>
      `;
      await sendEmail(
        user.email,
        subject,
        html,
        `${message}\n\nView: ${docLink}`
      );
    } else {
      console.log(`ℹ️ User ${userId} has no email configured, skipping email`);
    }
  } catch (err) {
    console.error(
      "❌ Error while trying to send notification email:",
      err && err.message ? err.message : err
    );
    // best-effort: do not throw
  }
}

module.exports = {
  notifyUser,
  sendEmail,
};
