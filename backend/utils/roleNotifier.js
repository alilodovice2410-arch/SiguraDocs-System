// contents of file
/**
 * utils/roleNotifier.js
 *
 * Responsibilities:
 * - Find Head Teacher by department
 * - Find Principal
 * - Create in-system notifications for Head Teacher and Principal
 * - Helper functions intended to be called from routes (documents submit, approvals approve/reject)
 *
 * Notes:
 * - Uses the shared notification insertion + email helper (notificationService.notifyUser).
 * - All DB operations accept an optional `connection` (transaction-aware) or will use pool.
 */

const { pool } = require("../config/database");
const { notifyUser } = require("../utils/notificationService"); // best-effort email + insert
const { logActivity, ACTIONS } = require("../utils/auditLogger");

/**
 * Helper to choose DB accessor (connection in transaction vs pool)
 */
function dbFor(connection) {
  return connection || pool;
}

/**
 * Find an active Head Teacher for a given department.
 * Returns { user_id, full_name, subject, email } or null
 */
async function findHeadTeacherForDepartment(department, connection = null) {
  const db = dbFor(connection);
  try {
    const [rows] = await db.query(
      `SELECT user_id, full_name, subject, email
       FROM users
       WHERE role_id = 3
         AND department = ?
         AND status = 'active'
       LIMIT 1`,
      [department]
    );
    if (rows && rows.length > 0) return rows[0];
    return null;
  } catch (err) {
    console.error("findHeadTeacherForDepartment error:", err);
    throw err;
  }
}

/**
 * Find the active Principal (role_id = 2)
 * Returns { user_id, full_name, email } or null
 */
async function findPrincipal(connection = null) {
  const db = dbFor(connection);
  try {
    const [rows] = await db.query(
      `SELECT user_id, full_name, email
       FROM users
       WHERE role_id = 2
         AND status = 'active'
       LIMIT 1`
    );
    if (rows && rows.length > 0) return rows[0];
    return null;
  } catch (err) {
    console.error("findPrincipal error:", err);
    throw err;
  }
}

/**
 * Notify Head Teacher that a new document was uploaded.
 *
 * - Inserts an in-system notification (via notifyUser)
 * - Optionally accepts a DB connection to participate in the calling transaction
 *
 * Parameters:
 * - documentId (int)
 * - uploader (object) { user_id, full_name, department, email } OR uploaderId (int) if you don't have object
 * - title (string) document title
 * - department (string)
 * - connection (optional) - mysql connection to use in same transaction
 *
 * Returns: headTeacher object or null
 */
async function notifyHeadTeacherOfNewUpload(
  documentId,
  uploader,
  title,
  department,
  connection = null
) {
  const db = dbFor(connection);

  try {
    let uploaderInfo = uploader;
    if (typeof uploader === "number") {
      const [urows] = await db.query(
        "SELECT user_id, full_name, department, email FROM users WHERE user_id = ?",
        [uploader]
      );
      uploaderInfo = urows[0] || { user_id: uploader, full_name: "User" };
    }

    const headTeacher = await findHeadTeacherForDepartment(
      department,
      connection
    );

    if (!headTeacher) {
      console.log(
        `notifyHeadTeacherOfNewUpload: No head teacher found for department=${department}`
      );
      return null;
    }

    const titleText = `New Document Submitted: ${title}`;
    const message = `${uploaderInfo.full_name} submitted a new document "${title}" for ${department}. Please review and take action.`;

    // Use notifyUser which inserts in-system notification and attempts email (best-effort)
    await notifyUser(
      headTeacher.user_id,
      documentId,
      titleText,
      message,
      "info",
      connection || undefined // notifyUser accepts connection as optional last param
    );

    console.log(
      `✅ Head Teacher notified (in-system) - ${headTeacher.full_name} (user_id=${headTeacher.user_id})`
    );

    return headTeacher;
  } catch (err) {
    console.error("notifyHeadTeacherOfNewUpload error:", err);
    // Do not throw; best-effort notification
    return null;
  }
}

/**
 * Notify Principal that a new document was uploaded.
 *
 * - Inserts an in-system notification (via notifyUser) and attempts to email the principal.
 * - Transaction-aware: pass connection to perform insert within the same transaction as document creation.
 *
 * Parameters:
 * - documentId (int)
 * - uploader (object) { user_id, full_name, department, email } OR uploaderId (int)
 * - title (string)
 * - department (string)
 * - connection (optional) - mysql connection to use in same transaction
 *
 * Returns: principal object or null
 */
async function notifyPrincipalOfNewUpload(
  documentId,
  uploader,
  title,
  department,
  connection = null
) {
  const db = dbFor(connection);

  try {
    let uploaderInfo = uploader;
    if (typeof uploader === "number") {
      const [urows] = await db.query(
        "SELECT user_id, full_name, department, email FROM users WHERE user_id = ?",
        [uploader]
      );
      uploaderInfo = urows[0] || { user_id: uploader, full_name: "User" };
    }

    const principal = await findPrincipal(connection);

    if (!principal) {
      console.log(`notifyPrincipalOfNewUpload: No principal found`);
      return null;
    }

    // Avoid notifying the uploader themselves if they are the principal
    if (uploaderInfo.user_id === principal.user_id) {
      console.log("Uploader is the principal - skipping self-notification");
      return null;
    }

    const titleText = `New Document Submitted: ${title}`;
    const message = `${uploaderInfo.full_name} submitted a new document "${title}" for ${department}. It has been queued for approval.`;

    // Use notifyUser which inserts in-system notification and attempts email (best-effort)
    await notifyUser(
      principal.user_id,
      documentId,
      titleText,
      message,
      "info",
      connection || undefined
    );

    console.log(
      `✅ Principal notified (in-system + email if configured) - ${principal.full_name} (user_id=${principal.user_id})`
    );

    return principal;
  } catch (err) {
    console.error("notifyPrincipalOfNewUpload error:", err);
    return null;
  }
}

/**
 * Notify uploader (teacher) and optionally the principal when an approval action occurs.
 *
 * - action: 'approved' | 'rejected' | 'revision_requested'
 * - approver: { user_id, full_name } or approverId
 * - comments: optional string
 * - sendToPrincipal: boolean (default true) - whether to also notify principal
 */
async function notifyOnDecision(
  documentId,
  uploaderId,
  approver,
  action,
  comments = "",
  sendToPrincipal = true,
  connection = null
) {
  const db = dbFor(connection);

  try {
    // fetch uploader info
    const [urows] = await db.query(
      "SELECT user_id, full_name, email FROM users WHERE user_id = ?",
      [uploaderId]
    );
    const uploader = urows[0] || { user_id: uploaderId, full_name: "User" };

    let approverInfo = approver;
    if (typeof approver === "number") {
      const [arows] = await db.query(
        "SELECT user_id, full_name FROM users WHERE user_id = ?",
        [approver]
      );
      approverInfo = arows[0] || { user_id: approver, full_name: "Approver" };
    }

    let titleText = "";
    let message = "";
    let type = "info";

    switch (action) {
      case "approved":
        titleText = `Document Approved: ${documentId}`;
        message = `${approverInfo.full_name} approved your document${
          comments ? ` — "${comments}"` : ""
        }.`;
        type = "success";
        break;
      case "rejected":
        titleText = `Document Rejected: ${documentId}`;
        message = `${approverInfo.full_name} rejected your document. Reason: ${comments}`;
        type = "error";
        break;
      case "revision_requested":
        titleText = `Revision Requested: ${documentId}`;
        message = `${approverInfo.full_name} requested revisions: ${comments}`;
        type = "warning";
        break;
      default:
        titleText = `Update on Document: ${documentId}`;
        message = `${approverInfo.full_name} updated your document: ${action}`;
        type = "info";
    }

    // Notify uploader (in-system + email best-effort)
    await notifyUser(
      uploader.user_id,
      documentId,
      titleText,
      message,
      type,
      connection || undefined
    );

    console.log(
      `✅ Uploader notified (user_id=${uploader.user_id}) about ${action}`
    );

    // Also notify principal if requested
    if (sendToPrincipal) {
      const principal = await findPrincipal(connection);
      if (principal) {
        const pTitle = `Document ${action.toUpperCase()}: ${documentId}`;
        const pMessage = `${approverInfo.full_name} ${action} document "${documentId}" submitted by ${uploader.full_name}.`;
        await notifyUser(
          principal.user_id,
          documentId,
          pTitle,
          pMessage,
          "info",
          connection || undefined
        );
        console.log(
          `✅ Principal notified (user_id=${principal.user_id}) about ${action}`
        );
      } else {
        console.log("notifyOnDecision: No principal found to notify.");
      }
    }

    return true;
  } catch (err) {
    console.error("notifyOnDecision error:", err);
    return false;
  }
}

module.exports = {
  findHeadTeacherForDepartment,
  findPrincipal,
  notifyHeadTeacherOfNewUpload,
  notifyPrincipalOfNewUpload,
  notifyOnDecision,
};
