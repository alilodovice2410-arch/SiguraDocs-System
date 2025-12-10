const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");
const checkRole = require("../middleware/roleCheck");
const { logActivity, ACTIONS } = require("../utils/auditLogger");

// Centralized notifier helpers
const { notifyOnDecision, findPrincipal } = require("../utils/roleNotifier");

/**
 * ✅ ADDED: Digital Signature Function for Principal
 */
async function createDigitalSignature(
  documentId,
  approverId,
  approvalLevel,
  signatureImage,
  connection
) {
  try {
    console.log(`\n🖊️ ===== CREATING PRINCIPAL DIGITAL SIGNATURE =====`);
    console.log(`📋 Document ID: ${documentId}`);
    console.log(`👤 Principal ID: ${approverId}`);
    console.log(`📊 Approval Level: ${approvalLevel}`);
    console.log(`🖼️ Has Signature Image: ${!!signatureImage}`);

    // Get principal details
    const [principalRows] = await connection.query(
      `SELECT u.full_name, u.department, u.subject, r.role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.role_id 
       WHERE u.user_id = ?`,
      [approverId]
    );

    if (!principalRows || principalRows.length === 0) {
      throw new Error(`Principal not found for user_id: ${approverId}`);
    }

    const { full_name, department, subject, role_name } = principalRows[0];
    console.log(`✅ Found principal: ${full_name} (${role_name})`);

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
      `🔒 Generated signature hash: ${signatureHash.substring(0, 16)}...`
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
        department || "Administration",
        subject || null,
        approvalLevel,
        signatureHash,
        signatureImage || null,
        signedAt,
      ]
    );

    console.log(
      `✅ Principal signature inserted with ID: ${insertResult.insertId}`
    );

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
    console.error("❌ Principal digital signature error:", error);
    console.error("Stack:", error.stack);
    throw error;
  }
}

/**
 * GET /api/principal/dashboard/stats
 * Get comprehensive dashboard statistics for Principal
 */
router.get(
  "/dashboard/stats",
  authenticateToken,
  checkRole("Principal"),
  async (req, res) => {
    try {
      const userId = req.user.user_id;

      console.log("📊 Fetching dashboard stats for Principal ID:", userId);

      const [
        [pendingYourApproval],
        [approvedThisWeek],
        [approvedTotal],
        [urgentDocuments],
        [totalDocuments],
        [rejectedTotal],
        [recentActivities],
        [weeklyTrend],
      ] = await Promise.all([
        // Pending approvals for principal
        pool.query(
          `SELECT COUNT(*) as count FROM approvals 
           WHERE approver_id = ? AND status = 'pending'`,
          [userId]
        ),
        // Approved this week
        pool.query(
          `SELECT COUNT(*) as count FROM approvals 
           WHERE approver_id = ? AND status = 'approved' 
           AND YEARWEEK(decision_date, 1) = YEARWEEK(CURDATE(), 1)`,
          [userId]
        ),
        // Total approved by principal (all time)
        pool.query(
          `SELECT COUNT(*) as count FROM approvals 
           WHERE approver_id = ? AND status = 'approved'`,
          [userId]
        ),
        // Urgent documents pending principal approval
        pool.query(
          `SELECT COUNT(DISTINCT d.document_id) as count 
           FROM documents d
           JOIN approvals a ON d.document_id = a.document_id
           WHERE a.approver_id = ? AND a.status = 'pending' 
           AND d.priority = 'urgent'`,
          [userId]
        ),
        // Total documents in the system
        pool.query(`SELECT COUNT(*) as count FROM documents`),
        // Total rejected by principal
        pool.query(
          `SELECT COUNT(*) as count FROM approvals 
           WHERE approver_id = ? AND status = 'rejected'`,
          [userId]
        ),
        // Recent activities
        pool.query(
          `SELECT 
            al.action,
            al.details,
            al.created_at,
            u.full_name,
            d.title as document_title,
            d.document_type
           FROM audit_logs al
           JOIN users u ON al.user_id = u.user_id
           LEFT JOIN documents d ON al.document_id = d.document_id
           WHERE al.action IN ('DOCUMENT_UPLOADED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED')
           ORDER BY al.created_at DESC
           LIMIT 5`
        ),
        // Weekly approval trend
        pool.query(
          `SELECT 
            DATE(decision_date) as date,
            COUNT(*) as count
           FROM approvals
           WHERE approver_id = ? 
           AND status = 'approved'
           AND decision_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           GROUP BY DATE(decision_date)
           ORDER BY date ASC`,
          [userId]
        ),
      ]);

      console.log("📈 Stats Results:");
      console.log("  - Pending:", pendingYourApproval[0].count);
      console.log("  - Approved This Week:", approvedThisWeek[0].count);
      console.log("  - Approved Total:", approvedTotal[0].count);
      console.log("  - Rejected Total:", rejectedTotal[0].count);
      console.log("  - Urgent:", urgentDocuments[0].count);
      console.log("  - Total Documents:", totalDocuments[0].count);

      const formattedActivities = recentActivities.map((activity) => {
        let title, description, type;

        switch (activity.action) {
          case "DOCUMENT_APPROVED":
            title = "Document Approved";
            description = `${activity.document_type || "Document"} by ${
              activity.full_name
            }`;
            type = "APPROVED";
            break;
          case "DOCUMENT_UPLOADED":
            title = "New Document Submitted";
            description = `${activity.document_type || "Document"} - ${
              activity.full_name
            }`;
            type = "UPLOADED";
            break;
          case "DOCUMENT_REJECTED":
            title = "Document Rejected";
            description = `${activity.document_type || "Document"} by ${
              activity.full_name
            }`;
            type = "REJECTED";
            break;
          default:
            title = activity.action.replace(/_/g, " ");
            description = activity.details;
            type = "OTHER";
        }

        return {
          title,
          description,
          timestamp: formatTimestamp(activity.created_at),
          document: activity.document_title,
          type,
        };
      });

      res.json({
        success: true,
        data: {
          pendingYourApproval: pendingYourApproval[0].count,
          approvedThisWeek: approvedThisWeek[0].count,
          approvedTotal: approvedTotal[0].count,
          rejectedTotal: rejectedTotal[0].count,
          urgentDocuments: urgentDocuments[0].count,
          totalDocuments: totalDocuments[0].count,
          recentActivities: formattedActivities,
          weeklyTrend,
        },
      });
    } catch (error) {
      console.error("Principal dashboard stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard statistics.",
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/principal/approvals/pending
 */
router.get(
  "/approvals/pending",
  authenticateToken,
  checkRole("Principal"),
  async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { priority, department, sortBy = "created_at" } = req.query;

      let query = `
        SELECT 
          a.approval_id,
          a.document_id,
          a.approval_level,
          a.status,
          a.created_at,
          d.title,
          d.document_type,
          d.priority,
          d.department,
          d.description,
          d.file_name,
          d.status as document_status,
          u.full_name as submitter_name,
          u.email as submitter_email,
          u.department as submitter_department,
          DATEDIFF(CURDATE(), a.created_at) as days_pending
        FROM approvals a
        JOIN documents d ON a.document_id = d.document_id
        JOIN users u ON d.uploader_id = u.user_id
        WHERE a.approver_id = ? AND a.status = 'pending'
      `;

      const params = [userId];

      if (priority) {
        query += " AND d.priority = ?";
        params.push(priority);
      }

      if (department) {
        query += " AND d.department = ?";
        params.push(department);
      }

      const validSortFields = ["created_at", "priority", "title"];
      const sortField = validSortFields.includes(sortBy)
        ? sortBy
        : "created_at";

      if (sortField === "priority") {
        query += ` ORDER BY 
          CASE d.priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            ELSE 4 
          END, a.created_at ASC`;
      } else {
        query += ` ORDER BY a.${sortField} DESC`;
      }

      const [approvals] = await pool.query(query, params);

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
  }
);

/**
 * ✅ UPDATED: POST /api/principal/approvals/:approvalId/approve
 * NOW USES notifyOnDecision for uploader/principal notifications
 */
router.post(
  "/approvals/:approvalId/approve",
  authenticateToken,
  checkRole("Principal"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { approvalId } = req.params;
      const { comments, signature_image } = req.body;
      const approverId = req.user.user_id;

      console.log("\n🖊️ ===== PRINCIPAL SIGNATURE APPROVAL =====");
      console.log("📋 Approval ID:", approvalId);
      console.log("👤 Principal ID:", approverId);
      console.log("💬 Comments:", comments || "No comments");
      console.log("🖼️ Has Signature:", !!signature_image);

      // Validate signature image
      if (signature_image && !signature_image.startsWith("data:image/")) {
        console.error("❌ INVALID signature format!");
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid signature image format",
        });
      }

      // Get approval details including uploader_id
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
      console.log("📄 Processing:", approval.title);

      // Check for next approval level
      const [nextApproval] = await connection.query(
        `SELECT * FROM approvals 
         WHERE document_id = ? AND approval_level > ? AND status = 'pending'
         ORDER BY approval_level ASC LIMIT 1`,
        [approval.document_id, approval.approval_level]
      );

      const isFinalApproval = nextApproval.length === 0;

      // Update approval status
      await connection.query(
        `UPDATE approvals 
         SET status = 'approved', 
             comments = ?,
             decision_date = NOW()
         WHERE approval_id = ?`,
        [comments || "Approved by Principal", approvalId]
      );

      // ✅ CREATE DIGITAL SIGNATURE FOR PRINCIPAL
      console.log("🖊️ Creating Principal digital signature...");
      const signature = await createDigitalSignature(
        approval.document_id,
        approverId,
        approval.approval_level,
        signature_image,
        connection
      );
      console.log("✅ Principal signature created successfully!");

      // Update document status
      if (isFinalApproval) {
        await connection.query(
          `UPDATE documents 
           SET status = 'approved', 
               updated_at = NOW(),
               current_approver_id = NULL
           WHERE document_id = ?`,
          [approval.document_id]
        );

        console.log("✅ FINAL APPROVAL - Document fully approved");

        // Notify uploader (do not notify principal about their own action)
        try {
          await notifyOnDecision(
            approval.document_id,
            approval.uploader_id,
            approverId,
            "approved",
            `Your document "${approval.title}" has been approved by the Principal and is now fully signed.`,
            false, // principal performed action; avoid self-notify
            connection
          );
        } catch (notifErr) {
          console.error("notifyOnDecision error (principal final):", notifErr);
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

        // Notify uploader that principal approved and document progressed
        try {
          await notifyOnDecision(
            approval.document_id,
            approval.uploader_id,
            approverId,
            "approved",
            `Your document "${approval.title}" has been approved by the Principal.`,
            false,
            connection
          );
        } catch (notifErr) {
          console.error(
            "notifyOnDecision error (principal forward):",
            notifErr
          );
        }
      }

      await logActivity(
        approverId,
        ACTIONS.DOCUMENT_APPROVED,
        approval.document_id,
        `Principal approved and signed: ${approval.title}${
          comments ? ` - ${comments}` : ""
        }`,
        req.ip,
        req.get("user-agent")
      );

      await connection.commit();
      console.log("✅ Transaction committed");
      console.log("=====================================\n");

      res.json({
        success: true,
        message: isFinalApproval
          ? "Document approved and fully signed!"
          : "Document approved and signed by Principal",
        signature: {
          hash: signature.signature_hash.substring(0, 16) + "...",
          signed_at: signature.signed_at,
          signer: signature.signer_name,
          has_image: !!signature.signature_image,
        },
        isFinalApproval,
        updatedApproval: {
          approval_id: approvalId,
          status: "approved",
          decision_date: new Date(),
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Principal approve error:", error);
      console.error("Stack:", error.stack);
      res.status(500).json({
        success: false,
        message: "Failed to approve document.",
        error: error.message,
      });
    } finally {
      connection.release();
    }
  }
);

/**
 * POST /api/principal/approvals/:approvalId/reject
 */
router.post(
  "/approvals/:approvalId/reject",
  authenticateToken,
  checkRole("Principal"),
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
          message: "Rejection reason is required.",
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

      await Promise.all([
        connection.query(
          `UPDATE approvals 
           SET status = 'rejected', 
               comments = ?,
               decision_date = NOW()
           WHERE approval_id = ?`,
          [comments, approvalId]
        ),
        connection.query(
          `UPDATE documents 
           SET status = 'rejected', 
               remarks = ?,
               updated_at = NOW(),
               current_approver_id = NULL
           WHERE document_id = ?`,
          [comments, approval.document_id]
        ),
        logActivity(
          approverId,
          ACTIONS.DOCUMENT_REJECTED,
          approval.document_id,
          `Principal rejected: ${approval.title} - ${comments}`,
          req.ip,
          req.get("user-agent")
        ),
      ]);

      // Centralized notification for uploader (do not notify principal about their own rejection)
      try {
        await notifyOnDecision(
          approval.document_id,
          approval.uploader_id,
          approverId,
          "rejected",
          comments,
          false, // principal performed action; avoid self-notify
          connection
        );
      } catch (notifErr) {
        console.error("notifyOnDecision error (principal reject):", notifErr);
      }

      await connection.commit();

      res.json({
        success: true,
        message: "Document rejected.",
        updatedApproval: {
          approval_id: approvalId,
          status: "rejected",
          decision_date: new Date(),
        },
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
  }
);

/**
 * GET /api/principal/departments/overview
 */
router.get(
  "/departments/overview",
  authenticateToken,
  checkRole("Principal"),
  async (req, res) => {
    try {
      const [departments] = await pool.query(`
        SELECT 
          d.department as name,
          COUNT(CASE WHEN d.status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN d.status = 'rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN d.status = 'in_review' THEN 1 END) as in_review,
          COUNT(*) as total,
          AVG(CASE 
            WHEN d.status = 'approved' AND d.updated_at IS NOT NULL 
            THEN DATEDIFF(d.updated_at, d.created_at) 
          END) as avg_approval_days
        FROM documents d
        WHERE d.department IS NOT NULL AND d.department != ''
        GROUP BY d.department
        ORDER BY total DESC
      `);

      res.json({
        success: true,
        departments,
      });
    } catch (error) {
      console.error("Department overview error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch department overview.",
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/principal/analytics
 */
router.get(
  "/analytics",
  authenticateToken,
  checkRole("Principal"),
  async (req, res) => {
    try {
      const [submissionTrend] = await pool.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM documents
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      const [departmentApprovalRate] = await pool.query(`
        SELECT 
          d.department,
          COUNT(*) as total,
          SUM(CASE WHEN d.status = 'approved' THEN 1 ELSE 0 END) as approved,
          ROUND(SUM(CASE WHEN d.status = 'approved' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as approval_rate
        FROM documents d
        WHERE d.department IS NOT NULL
        GROUP BY d.department
        ORDER BY approval_rate DESC
      `);

      const [typeDistribution] = await pool.query(`
        SELECT 
          document_type,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM documents), 2) as percentage
        FROM documents
        GROUP BY document_type
        ORDER BY count DESC
        LIMIT 10
      `);

      const [processingTime] = await pool.query(`
        SELECT 
          AVG(DATEDIFF(updated_at, created_at)) as avg_days
        FROM documents
        WHERE status = 'approved' AND updated_at IS NOT NULL
      `);

      res.json({
        success: true,
        analytics: {
          submissionTrend,
          departmentApprovalRate,
          typeDistribution,
          avgProcessingDays: processingTime[0]?.avg_days || 0,
        },
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch analytics data.",
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/principal/reports/summary
 */
router.get(
  "/reports/summary",
  authenticateToken,
  checkRole("Principal"),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      let dateFilter = "";
      const params = [];

      if (startDate && endDate) {
        dateFilter = "WHERE d.created_at BETWEEN ? AND ?";
        params.push(startDate, endDate);
      }

      const [summary] = await pool.query(
        `
        SELECT 
          COUNT(*) as total_documents,
          COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN d.status = 'rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN d.status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN d.priority = 'urgent' THEN 1 END) as urgent_documents,
          AVG(CASE 
            WHEN d.status = 'approved' AND d.updated_at IS NOT NULL 
            THEN DATEDIFF(d.updated_at, d.created_at) 
          END) as avg_processing_days
        FROM documents d
        ${dateFilter}
      `,
        params
      );

      res.json({
        success: true,
        summary: summary[0],
      });
    } catch (error) {
      console.error("Summary report error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate summary report.",
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/principal/approval-history
 * ✅ FIXED: Now includes the actual approver's name
 */
router.get(
  "/approval-history",
  authenticateToken,
  checkRole("Principal"),
  async (req, res) => {
    try {
      const principalId = req.user.user_id;
      const { status } = req.query;

      let statusFilter = "";
      if (status && status !== "all") {
        statusFilter = "AND a.status = ?";
      }

      const [history] = await pool.query(
        `SELECT 
        a.approval_id,
        a.status,
        a.comments,
        a.decision_date,
        d.document_id,
        d.title,
        d.document_type,
        d.priority,
        d.department,
        u.full_name as submitted_by,
        approver.full_name as approved_by
      FROM approvals a
      JOIN documents d ON a.document_id = d.document_id
      JOIN users u ON d.uploader_id = u.user_id
      JOIN users approver ON a.approver_id = approver.user_id
      WHERE a.approver_id = ? 
      AND a.status IN ('approved', 'rejected', 'revision_requested')
      ${statusFilter}
      ORDER BY a.decision_date DESC
      LIMIT 100`,
        status && status !== "all" ? [principalId, status] : [principalId]
      );

      res.json({
        success: true,
        history,
        count: history.length,
      });
    } catch (error) {
      console.error("Fetch approval history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch approval history",
      });
    }
  }
);

function formatTimestamp(date) {
  const now = new Date();
  const timestamp = new Date(date);
  const diffInSeconds = Math.floor((now - timestamp) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return timestamp.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

module.exports = router;
