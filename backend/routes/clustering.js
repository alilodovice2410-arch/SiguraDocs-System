// backend/routes/clustering.js
// Create this new file in your backend/routes folder

const express = require("express");
const router = express.Router();
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");
const { logActivity, ACTIONS } = require("../utils/auditLogger");

/**
 * GET /api/clustering/analyze
 * Main endpoint for document clustering analysis
 */
router.get("/analyze", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const whereClause = userId ? "WHERE uploader_id = ?" : "";
    const params = userId ? [userId] : [];

    // 1. Cluster by Document Type
    const [typeRows] = await pool.query(
      `SELECT 
        document_type as cluster_name,
        COUNT(*) as document_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_review_count,
        AVG(DATEDIFF(COALESCE(updated_at, NOW()), created_at)) as avg_processing_days
      FROM documents
      ${whereClause}
      GROUP BY document_type
      ORDER BY document_count DESC`,
      params
    );

    // 2. Cluster by Department
    const [deptRows] = await pool.query(
      `SELECT 
        department as cluster_name,
        COUNT(*) as document_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
      FROM documents
      WHERE department IS NOT NULL AND department != ''
      ${userId ? "AND uploader_id = ?" : ""}
      GROUP BY department
      ORDER BY document_count DESC`,
      params
    );

    // 3. Cluster by Priority
    const [priorityRows] = await pool.query(
      `SELECT 
        priority as cluster_name,
        COUNT(*) as document_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
      FROM documents
      ${whereClause}
      GROUP BY priority
      ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END`,
      params
    );

    // 4. Cluster by Time Period (Last 6 months)
    const [timeRows] = await pool.query(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as cluster_name,
        COUNT(*) as document_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
      FROM documents
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      ${userId ? "AND uploader_id = ?" : ""}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY cluster_name DESC`,
      params
    );

    // 5. Smart Clustering - Documents needing attention
    const [attentionRows] = await pool.query(
      `SELECT 
        CASE
          WHEN priority = 'urgent' AND status = 'pending' THEN 'Urgent Pending'
          WHEN DATEDIFF(NOW(), created_at) > 7 AND status IN ('pending', 'in_review') THEN 'Overdue Review'
          WHEN status = 'revision_requested' THEN 'Needs Revision'
          WHEN status = 'rejected' AND DATEDIFF(NOW(), updated_at) < 30 THEN 'Recently Rejected'
          ELSE 'Normal Processing'
        END as cluster_name,
        COUNT(*) as document_count
      FROM documents
      WHERE status IN ('pending', 'in_review', 'revision_requested', 'rejected')
      ${userId ? "AND uploader_id = ?" : ""}
      GROUP BY cluster_name
      HAVING cluster_name != 'Normal Processing'
      ORDER BY 
        CASE cluster_name
          WHEN 'Urgent Pending' THEN 1
          WHEN 'Overdue Review' THEN 2
          WHEN 'Needs Revision' THEN 3
          ELSE 4
        END`,
      params
    );

    // 6. Overall Statistics
    const [stats] = await pool.query(
      `SELECT 
        COUNT(DISTINCT document_type) as total_types,
        COUNT(DISTINCT department) as total_departments,
        COUNT(*) as total_documents,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as total_approved,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as total_pending,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as total_rejected,
        COUNT(CASE WHEN status = 'in_review' THEN 1 END) as total_in_review
      FROM documents
      ${whereClause}`,
      params
    );

    res.json({
      success: true,
      clusters: {
        byType: typeRows,
        byDepartment: deptRows,
        byPriority: priorityRows,
        byTimePeriod: timeRows,
        needsAttention: attentionRows,
      },
      statistics: stats[0] || {},
    });
  } catch (error) {
    console.error("Clustering analysis error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze document clusters",
      error: error.message,
    });
  }
});

/**
 * GET /api/clustering/:clusterType/:clusterName
 * Get detailed documents in a specific cluster
 */
router.get(
  "/:clusterType/:clusterName",
  authenticateToken,
  async (req, res) => {
    try {
      const { clusterType, clusterName } = req.params;
      const decodedName = decodeURIComponent(clusterName);

      let query = "";
      let params = [];

      switch (clusterType) {
        case "type":
          query = `
          SELECT d.*, u.full_name as uploader_name, u.department as uploader_department
          FROM documents d
          JOIN users u ON d.uploader_id = u.user_id
          WHERE d.document_type = ?
          ORDER BY d.created_at DESC
        `;
          params = [decodedName];
          break;

        case "department":
          query = `
          SELECT d.*, u.full_name as uploader_name
          FROM documents d
          JOIN users u ON d.uploader_id = u.user_id
          WHERE d.department = ?
          ORDER BY d.created_at DESC
        `;
          params = [decodedName];
          break;

        case "priority":
          query = `
          SELECT d.*, u.full_name as uploader_name
          FROM documents d
          JOIN users u ON d.uploader_id = u.user_id
          WHERE d.priority = ?
          ORDER BY d.created_at DESC
        `;
          params = [decodedName];
          break;

        case "attention":
          // Handle attention clusters
          if (decodedName === "Urgent Pending") {
            query = `
            SELECT d.*, u.full_name as uploader_name
            FROM documents d
            JOIN users u ON d.uploader_id = u.user_id
            WHERE d.priority = 'urgent' AND d.status = 'pending'
            ORDER BY d.created_at DESC
          `;
          } else if (decodedName === "Overdue Review") {
            query = `
            SELECT d.*, u.full_name as uploader_name,
                   DATEDIFF(NOW(), d.created_at) as days_pending
            FROM documents d
            JOIN users u ON d.uploader_id = u.user_id
            WHERE DATEDIFF(NOW(), d.created_at) > 7 
            AND d.status IN ('pending', 'in_review')
            ORDER BY d.created_at ASC
          `;
          } else if (decodedName === "Needs Revision") {
            query = `
            SELECT d.*, u.full_name as uploader_name
            FROM documents d
            JOIN users u ON d.uploader_id = u.user_id
            WHERE d.status = 'revision_requested'
            ORDER BY d.updated_at DESC
          `;
          } else {
            return res.status(400).json({
              success: false,
              message: "Invalid attention cluster name",
            });
          }
          params = [];
          break;

        default:
          return res.status(400).json({
            success: false,
            message:
              "Invalid cluster type. Use: type, department, priority, or attention",
          });
      }

      const [documents] = await pool.query(query, params);

      res.json({
        success: true,
        clusterType,
        clusterName: decodedName,
        documentCount: documents.length,
        documents,
      });
    } catch (error) {
      console.error("Fetch cluster documents error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch cluster documents",
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/clustering/create-manual
 * Create a manual cluster/tag for documents
 */
router.post("/create-manual", authenticateToken, async (req, res) => {
  try {
    const { clusterName, documentIds } = req.body;

    if (!clusterName || !documentIds || !Array.isArray(documentIds)) {
      return res.status(400).json({
        success: false,
        message: "Cluster name and document IDs array are required",
      });
    }

    // Validate cluster name
    if (clusterName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Cluster name must be 50 characters or less",
      });
    }

    // Store manual cluster metadata in remarks
    const clusterTag = `[CLUSTER:${clusterName}]`;

    for (const docId of documentIds) {
      await pool.query(
        `UPDATE documents 
         SET remarks = CONCAT(IFNULL(remarks, ''), ' ', ?)
         WHERE document_id = ?`,
        [clusterTag, docId]
      );
    }

    // Log activity
    await logActivity(
      req.user.user_id,
      "MANUAL_CLUSTER_CREATED",
      null,
      `Created manual cluster "${clusterName}" with ${documentIds.length} documents`,
      req.ip,
      req.get("user-agent")
    );

    console.log(
      `✅ Manual cluster created: ${clusterName} (${documentIds.length} docs)`
    );

    res.json({
      success: true,
      message: "Manual cluster created successfully",
      clusterName,
      documentCount: documentIds.length,
    });
  } catch (error) {
    console.error("Create manual cluster error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create manual cluster",
      error: error.message,
    });
  }
});

/**
 * GET /api/clustering/statistics
 * Get overall clustering statistics
 */
router.get("/statistics", authenticateToken, async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_documents,
        COUNT(DISTINCT document_type) as unique_types,
        COUNT(DISTINCT department) as unique_departments,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_count,
        AVG(CASE 
          WHEN status = 'approved' AND updated_at IS NOT NULL 
          THEN DATEDIFF(updated_at, created_at) 
        END) as avg_approval_time_days
      FROM documents
    `);

    res.json({
      success: true,
      statistics: stats[0],
    });
  } catch (error) {
    console.error("Fetch statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
});

module.exports = router;
