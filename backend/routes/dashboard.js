const express = require("express");
const router = express.Router();
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");

// Get dashboard statistics based on user role
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const userRole = req.user.role_name;
    const department = req.user.department;

    let stats = {};

    // ============================================
    // ADMIN DASHBOARD STATS
    // ============================================
    if (userRole === "Admin") {
      // Total Users
      const [totalUsers] = await pool.query(
        "SELECT COUNT(*) as count FROM users WHERE status = 'active'"
      );

      // Active Documents
      const [activeDocuments] = await pool.query(
        "SELECT COUNT(*) as count FROM documents"
      );

      // Pending Approvals
      const [pendingApprovals] = await pool.query(
        "SELECT COUNT(*) as count FROM approvals WHERE status = 'pending'"
      );

      // Completed Today
      const [completedToday] = await pool.query(
        `SELECT COUNT(*) as count FROM documents 
         WHERE status = 'approved' AND DATE(updated_at) = CURDATE()`
      );

      // Recent Activities
      const [recentActivities] = await pool.query(
        `SELECT al.*, u.full_name, d.title as document_title
         FROM audit_logs al
         JOIN users u ON al.user_id = u.user_id
         LEFT JOIN documents d ON al.document_id = d.document_id
         ORDER BY al.created_at DESC
         LIMIT 5`
      );

      stats = {
        totalUsers: totalUsers[0].count,
        activeDocuments: activeDocuments[0].count,
        pendingApprovals: pendingApprovals[0].count,
        completedToday: completedToday[0].count,
        recentActivities: recentActivities.map((activity) => ({
          title: activity.action.replace(/_/g, " "),
          description: `by ${activity.full_name}`,
          timestamp: formatTimestamp(activity.created_at),
          document: activity.document_title,
          type: activity.action,
        })),
      };
    }

    // ============================================
    // PRINCIPAL DASHBOARD STATS
    // ============================================
    else if (userRole === "Principal") {
      // Pending Your Approval
      const [pendingYourApproval] = await pool.query(
        `SELECT COUNT(*) as count FROM approvals 
         WHERE approver_id = ? AND status = 'pending'`,
        [userId]
      );

      // Approved This Week
      const [approvedThisWeek] = await pool.query(
        `SELECT COUNT(*) as count FROM approvals 
         WHERE approver_id = ? AND status = 'approved' 
         AND WEEK(decision_date) = WEEK(CURDATE())`,
        [userId]
      );

      // Urgent Documents
      const [urgentDocuments] = await pool.query(
        `SELECT COUNT(DISTINCT d.document_id) as count 
         FROM documents d
         JOIN approvals a ON d.document_id = a.document_id
         WHERE a.approver_id = ? AND a.status = 'pending' 
         AND d.priority = 'urgent'`,
        [userId]
      );

      // Total Departments
      const [totalDepartments] = await pool.query(
        "SELECT COUNT(DISTINCT department) as count FROM users WHERE department IS NOT NULL"
      );

      // Recent Activities
      const [recentActivities] = await pool.query(
        `SELECT d.title, d.document_type, d.status, d.updated_at, u.full_name
         FROM documents d
         JOIN users u ON d.uploader_id = u.user_id
         ORDER BY d.updated_at DESC
         LIMIT 5`
      );

      stats = {
        pendingYourApproval: pendingYourApproval[0].count,
        approvedThisWeek: approvedThisWeek[0].count,
        urgentDocuments: urgentDocuments[0].count,
        totalDepartments: totalDepartments[0].count,
        recentActivities: recentActivities.map((activity) => ({
          title: activity.title,
          description: `${activity.document_type} by ${activity.full_name}`,
          timestamp: formatTimestamp(activity.updated_at),
          document: activity.title,
          type: activity.status === "approved" ? "APPROVED" : "UPLOADED",
        })),
      };
    }

    // ============================================
    // DEPARTMENT HEAD DASHBOARD STATS
    // ============================================
    else if (userRole === "Department Head") {
      // Pending Your Approval
      const [pendingYourApproval] = await pool.query(
        `SELECT COUNT(*) as count FROM approvals 
         WHERE approver_id = ? AND status = 'pending'`,
        [userId]
      );

      // Department Documents
      const [departmentDocuments] = await pool.query(
        `SELECT COUNT(*) as count FROM documents WHERE department = ?`,
        [department]
      );

      // Approved This Month
      const [approvedThisMonth] = await pool.query(
        `SELECT COUNT(*) as count FROM approvals 
         WHERE approver_id = ? AND status = 'approved' 
         AND MONTH(decision_date) = MONTH(CURDATE())`,
        [userId]
      );

      // Rejected
      const [rejected] = await pool.query(
        `SELECT COUNT(*) as count FROM approvals 
         WHERE approver_id = ? AND status = 'rejected'`,
        [userId]
      );

      // Recent Activities
      const [recentActivities] = await pool.query(
        `SELECT d.title, d.document_type, d.status, d.updated_at, u.full_name
         FROM documents d
         JOIN users u ON d.uploader_id = u.user_id
         WHERE d.department = ?
         ORDER BY d.updated_at DESC
         LIMIT 5`,
        [department]
      );

      stats = {
        pendingYourApproval: pendingYourApproval[0].count,
        departmentDocuments: departmentDocuments[0].count,
        approvedThisMonth: approvedThisMonth[0].count,
        rejected: rejected[0].count,
        recentActivities: recentActivities.map((activity) => ({
          title: activity.title,
          description: `${activity.document_type} by ${activity.full_name}`,
          timestamp: formatTimestamp(activity.updated_at),
          document: activity.title,
          type: activity.status === "approved" ? "APPROVED" : "UPLOADED",
        })),
      };
    }

    // ============================================
    // FACULTY/STAFF DASHBOARD STATS
    // ============================================
    else if (userRole === "Faculty" || userRole === "Staff") {
      // Total Documents
      const [totalDocuments] = await pool.query(
        "SELECT COUNT(*) as count FROM documents WHERE uploader_id = ?",
        [userId]
      );

      // Pending
      const [pending] = await pool.query(
        "SELECT COUNT(*) as count FROM documents WHERE uploader_id = ? AND status = 'pending'",
        [userId]
      );

      // Approved
      const [approved] = await pool.query(
        "SELECT COUNT(*) as count FROM documents WHERE uploader_id = ? AND status = 'approved'",
        [userId]
      );

      // Rejected
      const [rejected] = await pool.query(
        "SELECT COUNT(*) as count FROM documents WHERE uploader_id = ? AND status = 'rejected'",
        [userId]
      );

      // Recent Documents
      const [recentDocuments] = await pool.query(
        `SELECT document_id as id, title, document_type as type, status, 
                DATE_FORMAT(created_at, '%M %d, %Y') as date
         FROM documents 
         WHERE uploader_id = ?
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId]
      );

      stats = {
        totalDocuments: totalDocuments[0].count,
        pending: pending[0].count,
        approved: approved[0].count,
        rejected: rejected[0].count,
        recentDocuments: recentDocuments,
      };
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics.",
      error: error.message,
    });
  }
});

// Helper function to format timestamps
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
