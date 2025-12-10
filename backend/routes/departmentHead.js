const express = require("express");
const router = express.Router();
const { pool } = require("../config/database"); // ✅ Use pool instead of creating new connections
const authenticateToken = require("../middleware/auth");

// Middleware to verify Department Head role
const verifyDepartmentHead = (req, res, next) => {
  console.log("🔍 Verifying Department Head role...");
  console.log("User:", req.user);
  console.log("Role:", req.user?.role_name);

  if (req.user && req.user.role_name === "Department Head") {
    console.log("✅ Department Head verified");
    next();
  } else {
    console.log("❌ Access denied - not a Department Head");
    res.status(403).json({
      success: false,
      message: "Access denied. Department Head role required.",
    });
  }
};

// ✅ Apply authenticateToken FIRST, then verifyDepartmentHead
router.use(authenticateToken);
router.use(verifyDepartmentHead);

// Get Department Head's approval history
router.get("/approval-history", async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user.user_id;

    console.log("📋 Fetching approval history for user:", userId);

    let query = `
      SELECT 
        a.approval_id,
        a.document_id,
        a.approval_level,
        a.status,
        a.comments,
        a.decision_date,
        a.created_at,
        d.title,
        d.document_type,
        u.full_name as submitted_by,
        approver.full_name as approved_by
      FROM approvals a
      INNER JOIN documents d ON a.document_id = d.document_id
      INNER JOIN users u ON d.uploader_id = u.user_id
      LEFT JOIN users approver ON a.approver_id = approver.user_id
      WHERE a.approver_id = ?
        AND a.status != 'pending'
    `;

    const params = [userId];

    // Add status filter if provided
    if (status && status !== "all") {
      query += " AND a.status = ?";
      params.push(status);
    }

    query += " ORDER BY a.decision_date DESC";

    // ✅ Use pool.query instead of creating new connection
    const [history] = await pool.query(query, params);

    console.log(`✅ Found ${history.length} approval records`);

    res.json({
      success: true,
      history: history,
    });
  } catch (error) {
    console.error("❌ Error fetching approval history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching approval history",
      error: error.message,
    });
  }
});

// Get statistics for the dashboard
router.get("/statistics", async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log("📊 Fetching statistics for user:", userId);

    // ✅ Use pool.query instead of creating new connection
    const [stats] = await pool.query(
      `
      SELECT 
        COUNT(CASE WHEN a.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN a.status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN a.status = 'pending' THEN 1 END) as pending_count,
        COUNT(*) as total_processed
      FROM approvals a
      WHERE a.approver_id = ?
    `,
      [userId]
    );

    console.log("✅ Statistics fetched:", stats[0]);

    res.json({
      success: true,
      statistics: stats[0],
    });
  } catch (error) {
    console.error("❌ Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
});

module.exports = router;
