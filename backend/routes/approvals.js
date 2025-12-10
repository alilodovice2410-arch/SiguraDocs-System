const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");
const { logActivity, ACTIONS } = require("../utils/auditLogger");

// Local createNotification (kept for notifying next approver)
// Helper: Create notification (transaction-aware when connection provided)
async function createNotification(
  userId,
  documentId,
  title,
  message,
  type,
  connection
) {
  try {
    await (connection || pool).query(
      `INSERT INTO notifications (user_id, document_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
      [userId, documentId, title, message, type]
    );
    console.log(`✅ Notification created for user ${userId}: ${title}`);
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

// NEW: centralized notifier helpers
const {
  notifyOnDecision,
  findPrincipal,
  notifyHeadTeacherOfNewUpload,
} = require("../utils/roleNotifier");

/**
 * AUTO-SIGNATURE FUNCTION - STORES SIGNATURE IMAGE
 * ✅ FIXED: Now properly stores all approver signatures
 */
async function createDigitalSignature(
  documentId,
  approverId,
  approvalLevel,
  signatureImage,
  connection
) {
  try {
    console.log(`\n🔍 ===== CREATING DIGITAL SIGNATURE =====`);
    console.log(`📋 Document ID: ${documentId}`);
    console.log(`👤 Approver ID: ${approverId}`);
    console.log(`📊 Approval Level: ${approvalLevel}`);
    console.log(`🖼️  Has Signature Image: ${!!signatureImage}`);

    // Get approver details
    const [approverRows] = await connection.query(
      `SELECT u.full_name, u.department, u.subject, r.role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.role_id 
       WHERE u.user_id = ?`,
      [approverId]
    );

    if (!approverRows || approverRows.length === 0) {
      throw new Error(`Approver not found for user_id: ${approverId}`);
    }

    const { full_name, department, subject, role_name } = approverRows[0];
    console.log(
      `✅ Found approver: ${full_name} (${role_name}) from ${department}`
    );

    const signedAt = new Date();

    // Generate unique signature hash
    const signatureData = `${documentId}-${approverId}-${signedAt.getTime()}-${crypto
      .randomBytes(16)
      .toString("hex")}`;
    const signatureHash = crypto
      .createHash("sha256")
      .update(signatureData)
      .digest("hex");

    console.log(
      `🔐 Generated signature hash: ${signatureHash.substring(0, 16)}...`
    );

    // Validate signature image format
    if (signatureImage && !signatureImage.startsWith("data:image/")) {
      console.error("❌ Invalid signature image format!");
      throw new Error("Invalid signature image format");
    }

    // Insert into signatures table
    const [insertResult] = await connection.query(
      `INSERT INTO document_signatures 
       (document_id, signer_id, signer_name, signer_role, signer_department, 
        signer_subject, approval_level, signature_hash, signature_image, signed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        documentId,
        approverId,
        full_name,
        role_name,
        department,
        subject || null,
        approvalLevel,
        signatureHash,
        signatureImage || null,
        signedAt,
      ]
    );

    console.log(`✅ Signature inserted with ID: ${insertResult.insertId}`);

    // Verify insertion
    const [verifyResult] = await connection.query(
      `SELECT signature_id, signer_name, signer_role, 
              LENGTH(signature_image) as img_length
       FROM document_signatures 
       WHERE signature_id = ?`,
      [insertResult.insertId]
    );

    if (verifyResult.length > 0) {
      console.log(`✅ VERIFICATION SUCCESS:`);
      console.log(`   - Signature ID: ${verifyResult[0].signature_id}`);
      console.log(
        `   - Signer: ${verifyResult[0].signer_name} (${verifyResult[0].signer_role})`
      );
      console.log(
        `   - Image stored: ${
          verifyResult[0].img_length
            ? "YES (" + verifyResult[0].img_length + " chars)"
            : "NO"
        }`
      );
    }

    // Append signature info to document remarks
    const signatureTimestamp = signedAt
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);
    await connection.query(
      `UPDATE documents 
       SET remarks = CONCAT(IFNULL(remarks, ''), '\n[SIGNED by ', ?, ' (', ?, ') on ', ?, ' | Hash: ', SUBSTRING(?, 1, 16), '...]')
       WHERE document_id = ?`,
      [full_name, role_name, signatureTimestamp, signatureHash, documentId]
    );

    console.log(`=====================================\n`);

    return {
      signature_id: insertResult.insertId,
      document_id: documentId,
      signer_id: approverId,
      signer_name: full_name,
      signer_role: role_name,
      signer_department: department,
      signer_subject: subject,
      approval_level: approvalLevel,
      signature_hash: signatureHash,
      signature_image: signatureImage,
      signed_at: signedAt,
    };
  } catch (error) {
    console.error("❌ Digital signature error:", error);
    console.error("Stack:", error.stack);
    throw error;
  }
}

// Get pending approvals for current user
router.get("/pending", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [approvals] = await pool.query(
      `SELECT 
        a.approval_id,
        a.document_id,
        a.approval_level,
        a.status,
        a.created_at,
        d.title,
        d.document_type,
        d.priority,
        d.department,
        d.file_name,
        d.status as document_status,
        d.current_approver_id,
        u.full_name as submitter_name,
        u.email as submitter_email,
        u.department as submitter_department,
        cu.full_name as approver_name,
        DATEDIFF(CURDATE(), a.created_at) as days_pending
      FROM approvals a
      JOIN documents d ON a.document_id = d.document_id
      JOIN users u ON d.uploader_id = u.user_id
      LEFT JOIN users cu ON a.approver_id = cu.user_id
      WHERE a.approver_id = ? 
      AND a.status = 'pending'
      AND d.current_approver_id = ?
      ORDER BY 
        CASE d.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        a.created_at ASC`,
      [userId, userId]
    );

    res.json({
      success: true,
      approvals,
      count: approvals.length,
    });
  } catch (error) {
    console.error("Fetch pending approvals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending approvals.",
      error: error.message,
    });
  }
});

// ✅ APPROVE document with AUTO-SIGNATURE
router.post("/:approvalId/approve", authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { approvalId } = req.params;
    const { comments, signature_image } = req.body;
    const approverId = req.user.user_id;

    console.log("\n🖊️ ===== SIGNATURE APPROVAL DEBUG (BACKEND) =====");
    console.log("📋 Approval request:", {
      approvalId,
      approverId,
      comments: comments || "No comments",
      has_signature: !!signature_image,
    });

    // Validate signature image
    if (signature_image) {
      console.log("📊 Signature Image Details:");
      console.log("   - Type:", typeof signature_image);
      console.log("   - Length:", signature_image.length, "characters");
      console.log("   - Starts with:", signature_image.substring(0, 50));

      if (!signature_image.startsWith("data:image/")) {
        console.error("❌ INVALID signature format!");
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid signature image format",
        });
      }
    } else {
      console.warn("⚠️ NO SIGNATURE IMAGE PROVIDED!");
    }

    // Get approval details
    const [approvals] = await connection.query(
      `SELECT a.*, d.title, d.document_type, d.uploader_id, d.department
       FROM approvals a 
       JOIN documents d ON a.document_id = d.document_id
       WHERE a.approval_id = ? AND a.approver_id = ?`,
      [approvalId, approverId]
    );

    if (approvals.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Approval not found or unauthorized.",
      });
    }

    const approval = approvals[0];
    console.log("📄 Processing approval for:", approval.title);

    if (approval.status !== "pending") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `This approval has already been ${approval.status}.`,
      });
    }

    // Update approval status
    await connection.query(
      `UPDATE approvals 
       SET status = 'approved', 
           comments = ?,
           decision_date = NOW()
       WHERE approval_id = ?`,
      [comments || "Approved", approvalId]
    );

    // ✅ CREATE DIGITAL SIGNATURE
    console.log("🖊️ Creating digital signature...");
    const signature = await createDigitalSignature(
      approval.document_id,
      approverId,
      approval.approval_level,
      signature_image,
      connection
    );
    console.log("✅ Signature created successfully!");

    // Check for next approval level
    const [nextApproval] = await connection.query(
      `SELECT * FROM approvals 
       WHERE document_id = ? AND approval_level > ? AND status = 'pending'
       ORDER BY approval_level ASC LIMIT 1`,
      [approval.document_id, approval.approval_level]
    );

    let isFinalApproval = nextApproval.length === 0;
    let nextApproverName = null;

    if (isFinalApproval) {
      await connection.query(
        `UPDATE documents 
         SET status = 'approved', 
             updated_at = NOW(),
             current_approver_id = NULL
         WHERE document_id = ?`,
        [approval.document_id]
      );

      console.log("✅ FINAL APPROVAL - Document approved");

      // Notify uploader and principal (centralized). Do not notify principal if approver is principal (avoid self-notify)
      try {
        const principal = await findPrincipal(connection);
        const sendToPrincipal = !(
          principal && principal.user_id === approverId
        ); // don't notify principal about their own action
        await notifyOnDecision(
          approval.document_id,
          approval.uploader_id,
          approverId,
          "approved",
          comments || `Approved (Level ${approval.approval_level})`,
          sendToPrincipal,
          connection
        );
      } catch (notifErr) {
        console.error("notifyOnDecision error (final approve):", notifErr);
      }
    } else {
      await connection.query(
        `UPDATE documents 
         SET status = 'in_review', 
             current_approver_id = ?, 
             updated_at = NOW() 
         WHERE document_id = ?`,
        [nextApproval[0].approver_id, approval.document_id]
      );

      const [nextApproverInfo] = await connection.query(
        "SELECT full_name, role_id FROM users WHERE user_id = ?",
        [nextApproval[0].approver_id]
      );
      nextApproverName = nextApproverInfo[0]?.full_name || "Next Approver";
      const nextApproverRoleId = nextApproverInfo[0]?.role_id || null;

      console.log(`➡️ Forwarded to: ${nextApproverName}`);

      // Notify uploader about progress.
      try {
        await notifyOnDecision(
          approval.document_id,
          approval.uploader_id,
          approverId,
          "approved",
          `Your document "${approval.title}" has been approved and forwarded to ${nextApproverName}.`,
          false, // do not notify principal here by default
          connection
        );
      } catch (notifErr) {
        console.error("notifyOnDecision error (forward):", notifErr);
      }

      // If the next approver is the Principal (role_id === 2), use notifyOnDecision
      // so Principal receives both in-system notification and email.
      try {
        const principal = await findPrincipal(connection);
        const nextApproverId = nextApproval[0].approver_id;

        if (principal && principal.user_id === nextApproverId) {
          // Use centralized notifier to notify Principal (in-system + email)
          // Approver param is the current approver (who approved), so principal sees who forwarded it.
          await notifyOnDecision(
            approval.document_id,
            approval.uploader_id,
            approverId,
            "forwarded",
            `A document "${approval.title}" has been forwarded to you for approval.`,
            true, // notify principal
            connection
          );
          console.log("✅ Principal notified (forwarded) via notifyOnDecision");
        } else {
          // For non-principal next-approver, create local in-system notification only (existing behavior)
          await createNotification(
            nextApproval[0].approver_id,
            approval.document_id,
            "📋 New Document for Review",
            `A document "${approval.title}" requires your approval.`,
            "info",
            connection
          );
        }
      } catch (err) {
        console.error(
          "Failed to notify next approver/principal on forward:",
          err
        );
      }
    }

    await connection.commit();
    console.log("✅ Transaction committed");
    console.log("=====================================\n");

    await logActivity(
      approverId,
      ACTIONS.DOCUMENT_APPROVED,
      approval.document_id,
      `Approved and signed: ${approval.title} (Level ${approval.approval_level})`,
      req.ip,
      req.get("user-agent")
    );

    res.json({
      success: true,
      message: isFinalApproval
        ? "Document approved and fully signed!"
        : `Document approved and forwarded to ${nextApproverName}`,
      signature: {
        hash: signature.signature_hash.substring(0, 16) + "...",
        signed_at: signature.signed_at,
        signer: signature.signer_name,
        has_image: !!signature.signature_image,
      },
      isFinalApproval,
      nextApprover: nextApproverName,
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Approve document error:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to approve document.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

// REJECT document
router.post("/:approvalId/reject", authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { approvalId } = req.params;
    const { comments } = req.body;
    const approverId = req.user.user_id;

    if (!comments || comments.trim() === "") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Comments are required when rejecting a document.",
      });
    }

    const [approvals] = await connection.query(
      `SELECT a.*, d.title, d.document_type, d.uploader_id
       FROM approvals a 
       JOIN documents d ON a.document_id = d.document_id
       WHERE a.approval_id = ? AND a.approver_id = ?`,
      [approvalId, approverId]
    );

    if (approvals.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Approval not found or unauthorized.",
      });
    }

    const approval = approvals[0];

    await connection.query(
      `UPDATE approvals 
       SET status = 'rejected', 
           comments = ?,
           decision_date = NOW()
       WHERE approval_id = ?`,
      [comments, approvalId]
    );

    await connection.query(
      `UPDATE documents 
       SET status = 'rejected', 
           remarks = ?,
           updated_at = NOW(),
           current_approver_id = NULL
       WHERE document_id = ?`,
      [`Rejected: ${comments}`, approval.document_id]
    );

    // Centralized notification for uploader (and principal)
    try {
      await notifyOnDecision(
        approval.document_id,
        approval.uploader_id,
        approverId,
        "rejected",
        comments,
        true,
        connection
      );
    } catch (notifErr) {
      console.error("notifyOnDecision error (reject):", notifErr);
    }

    await connection.commit();

    await logActivity(
      approverId,
      ACTIONS.DOCUMENT_REJECTED,
      approval.document_id,
      `Rejected: ${approval.title} - ${comments}`,
      req.ip,
      req.get("user-agent")
    );

    res.json({
      success: true,
      message: "Document rejected. The submitter has been notified.",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Reject document error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject document.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

// REQUEST REVISION
router.post(
  "/:approvalId/request-revision",
  authenticateToken,
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { approvalId } = req.params;
      const { comments } = req.body;
      const approverId = req.user.user_id;

      if (!comments || comments.trim() === "") {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Comments are required when requesting revision.",
        });
      }

      const [approvals] = await connection.query(
        `SELECT a.*, d.title, d.document_type, d.uploader_id
       FROM approvals a 
       JOIN documents d ON a.document_id = d.document_id
       WHERE a.approval_id = ? AND a.approver_id = ?`,
        [approvalId, approverId]
      );

      if (approvals.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: "Approval not found or unauthorized.",
        });
      }

      const approval = approvals[0];

      await connection.query(
        `UPDATE approvals 
       SET status = 'revision_requested', 
           comments = ?,
           decision_date = NOW()
       WHERE approval_id = ?`,
        [comments, approvalId]
      );

      await connection.query(
        `UPDATE documents 
       SET status = 'revision_requested', 
           remarks = ?,
           updated_at = NOW()
       WHERE document_id = ?`,
        [`Revision needed: ${comments}`, approval.document_id]
      );

      // Centralized notification for uploader and principal
      try {
        await notifyOnDecision(
          approval.document_id,
          approval.uploader_id,
          approverId,
          "revision_requested",
          comments,
          true,
          connection
        );
      } catch (notifErr) {
        console.error("notifyOnDecision error (revision):", notifErr);
      }

      await connection.commit();

      await logActivity(
        approverId,
        ACTIONS.REVISION_REQUESTED,
        approval.document_id,
        `Revision requested: ${approval.title} - ${comments}`,
        req.ip,
        req.get("user-agent")
      );

      res.json({
        success: true,
        message: "Revision requested. The submitter has been notified.",
      });
    } catch (error) {
      await connection.rollback();
      console.error("Request revision error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to request revision.",
        error: error.message,
      });
    } finally {
      connection.release();
    }
  }
);

// Get document signatures
router.get("/signatures/:documentId", authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    const [signatures] = await pool.query(
      `SELECT * FROM document_signatures 
       WHERE document_id = ? 
       ORDER BY approval_level ASC`,
      [documentId]
    );

    res.json({
      success: true,
      signatures,
    });
  } catch (error) {
    console.error("Fetch signatures error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch signatures.",
      error: error.message,
    });
  }
});

// Get approval history
router.get("/history/:documentId", authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    const [history] = await pool.query(
      `SELECT 
        a.approval_id,
        a.approval_level,
        a.status,
        a.comments,
        a.decision_date,
        a.created_at,
        u.full_name as approver_name,
        u.department as approver_department,
        r.role_name as approver_role,
        ds.signature_hash,
        ds.signature_image,
        ds.signed_at
      FROM approvals a
      JOIN users u ON a.approver_id = u.user_id
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN document_signatures ds ON a.document_id = ds.document_id 
        AND a.approver_id = ds.signer_id
      WHERE a.document_id = ?
      ORDER BY a.approval_level ASC`,
      [documentId]
    );

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Fetch approval history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch approval history.",
      error: error.message,
    });
  }
});

module.exports = router;
