// backend/routes/analytics.js
const express = require("express");
const router = express.Router();
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");

// GET /api/analytics
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { range = "6months" } = req.query;

    // Build date condition & interval for trend/recent queries based on requested range
    let dateCondition = "";
    let intervalSql = "6 MONTH";

    switch (range) {
      case "1month":
        dateCondition =
          "WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
        intervalSql = "1 MONTH";
        break;
      case "3months":
        dateCondition =
          "WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
        intervalSql = "3 MONTH";
        break;
      case "6months":
        dateCondition =
          "WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)";
        intervalSql = "6 MONTH";
        break;
      case "1year":
        dateCondition =
          "WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
        intervalSql = "12 MONTH";
        break;
      case "all":
      default:
        dateCondition = "";
        intervalSql = "12 MONTH";
        break;
    }

    // total documents within selected time range
    const [totalDocs] = await pool.query(
      `SELECT COUNT(*) as count FROM documents d ${dateCondition}`
    );

    // status distribution: current statuses across the whole documents table
    const [statusDist] = await pool.query(
      `SELECT 
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_review,
        COUNT(CASE WHEN status = 'revision_requested' THEN 1 END) as revision_requested
       FROM documents d`
    );

    // approval rate (approved / (approved + rejected)) across all docs
    const totalProcessed =
      (statusDist[0].approved || 0) + (statusDist[0].rejected || 0);
    const approvalRate =
      totalProcessed > 0
        ? Math.round((statusDist[0].approved / totalProcessed) * 100)
        : 0;

    // average review time (approved documents within selected range)
    const [avgTime] = await pool.query(
      `SELECT AVG(DATEDIFF(updated_at, created_at)) as avg_days
       FROM documents d
       WHERE status = 'approved' AND updated_at IS NOT NULL
       ${dateCondition ? dateCondition.replace("WHERE", "AND") : ""}`
    );

    // Activity trend:
    // - use event_date = COALESCE(updated_at, created_at)
    // - aggregate month label using MIN(event_date) to satisfy ONLY_FULL_GROUP_BY
    const [activityTrend] = await pool.query(
      `SELECT 
         DATE_FORMAT(MIN(event_date), '%b') as month,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
         COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
       FROM (
         SELECT d.*, COALESCE(d.updated_at, d.created_at) as event_date
         FROM documents d
       ) as sub
       WHERE event_date >= DATE_SUB(NOW(), INTERVAL ${intervalSql})
       GROUP BY DATE_FORMAT(event_date, '%Y-%m')
       ORDER BY DATE_FORMAT(event_date, '%Y-%m') ASC`
    );

    // department stats limited by selected date range
    const [deptStats] = await pool.query(
      `SELECT 
        department as name,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
       FROM documents d
       WHERE department IS NOT NULL AND department != ''
       ${dateCondition ? dateCondition.replace("WHERE", "AND") : ""}
       GROUP BY department
       ORDER BY total DESC
       LIMIT 5`
    );

    // recent activity limited by selected date range
    const [recentActivity] = await pool.query(
      `SELECT 
        d.title as document,
        d.document_type as doc_type,
        d.department,
        d.status as status,
        d.created_at
       FROM documents d
       ${dateCondition}
       ORDER BY d.created_at DESC
       LIMIT 5`
    );

    const formattedActivity = recentActivity.map((item) => {
      const date = new Date(item.created_at);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      let dateStr;
      if (diffDays === 0) {
        dateStr = diffHours === 0 ? "Just now" : `${diffHours} hours ago`;
      } else if (diffDays === 1) {
        dateStr = "Yesterday";
      } else if (diffDays < 7) {
        dateStr = `${diffDays} days ago`;
      } else {
        dateStr = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
      return {
        type: item.status,
        document: item.document,
        department: item.department,
        date: dateStr,
      };
    });

    const responseBody = {
      success: true,
      data: {
        total: totalDocs[0].count,
        approvalRate,
        avgReviewTime: avgTime[0].avg_days
          ? parseFloat(avgTime[0].avg_days).toFixed(1)
          : 0,
        pending: statusDist[0].pending,
        activityTrend,
        statusDistribution: statusDist[0],
        departmentStats: deptStats,
        recentActivity: formattedActivity,
      },
    };

    console.log(
      "Analytics response:",
      JSON.stringify(responseBody.data, null, 2)
    );
    res.json(responseBody);
  } catch (error) {
    console.error("Analytics error:", error);
    if (error && error.sql) {
      console.error("Failed SQL:", error.sql);
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics data",
      error: error.message,
      stack: error.stack,
    });
  }
});

router.get("/department-head", authenticateToken, async (req, res) => {
  try {
    const { range = "month" } = req.query;
    const userId = req.user.user_id;
    const department = req.user.department;

    console.log(`📊 Department Head Analytics Request:`, {
      userId,
      department,
      range,
    });

    // Date condition based on range
    let dateCondition = "";
    let intervalSql = "6 MONTH";

    switch (range) {
      case "week":
        dateCondition =
          "WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)";
        intervalSql = "1 WEEK";
        break;
      case "month":
        dateCondition =
          "WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
        intervalSql = "1 MONTH";
        break;
      case "quarter":
        dateCondition =
          "WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
        intervalSql = "3 MONTH";
        break;
      case "year":
        dateCondition =
          "WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
        intervalSql = "12 MONTH";
        break;
      default:
        dateCondition =
          "WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
        intervalSql = "1 MONTH";
    }

    // Add department filter
    const deptCondition = dateCondition
      ? `${dateCondition} AND d.department = ?`
      : `WHERE d.department = ?`;

    // 1. Total documents in department
    const [totalDocs] = await pool.query(
      `SELECT COUNT(*) as count FROM documents d ${deptCondition}`,
      [department]
    );

    // 2. Status distribution for department
    const [statusDist] = await pool.query(
      `SELECT 
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_review
       FROM documents d
       WHERE department = ?`,
      [department]
    );

    // 3. Approval rate
    const totalProcessed =
      (statusDist[0].approved || 0) + (statusDist[0].rejected || 0);
    const approvalRate =
      totalProcessed > 0
        ? Math.round((statusDist[0].approved / totalProcessed) * 100)
        : 0;

    // 4. Average review time
    const [avgTime] = await pool.query(
      `SELECT AVG(DATEDIFF(updated_at, created_at)) as avg_days
       FROM documents d
       WHERE status = 'approved' 
       AND department = ?
       AND updated_at IS NOT NULL
       ${dateCondition ? dateCondition.replace("WHERE", "AND") : ""}`,
      [department]
    );

    // 5. Submission trends over time
    const [submissionTrends] = await pool.query(
      `SELECT 
         DATE_FORMAT(created_at, '%b') as month,
         COUNT(*) as submitted,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
         COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
       FROM documents d
       WHERE department = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL ${intervalSql})
       GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b')
       ORDER BY DATE_FORMAT(created_at, '%Y-%m') ASC`,
      [department]
    );

    // 6. Document type distribution
    const [docTypeData] = await pool.query(
      `SELECT 
         document_type as name,
         COUNT(*) as value
       FROM documents d
       WHERE department = ?
       ${dateCondition ? dateCondition.replace("WHERE", "AND") : ""}
       GROUP BY document_type
       ORDER BY value DESC
       LIMIT 5`,
      [department]
    );

    // 7. Average approval time by document type
    const [approvalTimeByType] = await pool.query(
      `SELECT 
         document_type as type,
         AVG(DATEDIFF(updated_at, created_at)) as avgDays
       FROM documents d
       WHERE status = 'approved'
       AND department = ?
       AND updated_at IS NOT NULL
       ${dateCondition ? dateCondition.replace("WHERE", "AND") : ""}
       GROUP BY document_type
       ORDER BY avgDays DESC
       LIMIT 5`,
      [department]
    );

    // 8. Teacher activity in department
    const [teacherActivity] = await pool.query(
      `SELECT 
         u.full_name as name,
         COUNT(*) as submitted,
         COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as approved,
         COUNT(CASE WHEN d.status = 'rejected' THEN 1 END) as rejected,
         AVG(CASE WHEN d.status = 'approved' THEN DATEDIFF(d.updated_at, d.created_at) END) as avgTime
       FROM documents d
       JOIN users u ON d.uploader_id = u.user_id
       WHERE d.department = ?
       ${dateCondition ? dateCondition.replace("WHERE", "AND") : ""}
       GROUP BY u.user_id, u.full_name
       ORDER BY submitted DESC
       LIMIT 5`,
      [department]
    );

    // 9. Weekly activity pattern
    const [weeklyPattern] = await pool.query(
      `SELECT 
         DAYNAME(created_at) as day,
         COUNT(*) as submissions,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) as approvals
       FROM documents d
       WHERE department = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
       GROUP BY DAYNAME(created_at), DAYOFWEEK(created_at)
       ORDER BY DAYOFWEEK(created_at)`,
      [department]
    );

    // 10. Status trends over time (weekly breakdown) - FIXED
    const [statusTrends] = await pool.query(
      `SELECT 
         CONCAT('Week ', WEEK(d.created_at, 1) - WEEK(DATE_SUB(NOW(), INTERVAL 1 MONTH), 1) + 1) as week,
         COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as approved,
         COUNT(CASE WHEN d.status = 'rejected' THEN 1 END) as rejected,
         COUNT(CASE WHEN d.status IN ('pending', 'in_review') THEN 1 END) as pending
       FROM documents d
       WHERE d.department = ?
       AND d.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
       GROUP BY WEEK(d.created_at, 1), 
                CONCAT('Week ', WEEK(d.created_at, 1) - WEEK(DATE_SUB(NOW(), INTERVAL 1 MONTH), 1) + 1)
       ORDER BY WEEK(d.created_at, 1)`,
      [department]
    );

    const responseData = {
      success: true,
      data: {
        // Summary stats
        totalDocuments: totalDocs[0].count,
        avgApprovalTime: avgTime[0].avg_days
          ? parseFloat(avgTime[0].avg_days).toFixed(1)
          : 0,
        approvalRate,
        pendingDocuments: statusDist[0].pending + statusDist[0].in_review,

        // Charts data
        submissionTrends: submissionTrends.map((row) => ({
          month: row.month,
          submitted: row.submitted,
          approved: row.approved,
          rejected: row.rejected,
        })),

        documentTypeData: docTypeData.map((row, idx) => ({
          name: row.name,
          value: row.value,
          color: ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"][idx],
        })),

        approvalTimeByType: approvalTimeByType.map((row) => ({
          type: row.type,
          avgDays: parseFloat(row.avgDays).toFixed(1),
        })),

        teacherActivity: teacherActivity.map((row) => ({
          name: row.name,
          submitted: row.submitted,
          approved: row.approved,
          rejected: row.rejected,
          avgTime: row.avgTime ? parseFloat(row.avgTime).toFixed(1) : 0,
        })),

        weeklyPattern: weeklyPattern.map((row) => ({
          day: row.day.substring(0, 3), // Mon, Tue, etc
          submissions: row.submissions,
          approvals: row.approvals,
        })),

        statusTrends: statusTrends.map((row) => ({
          week: row.week,
          approved: row.approved,
          rejected: row.rejected,
          pending: row.pending,
        })),
      },
    };

    console.log("✅ Analytics data prepared successfully");
    res.json(responseData);
  } catch (error) {
    console.error("❌ Department Head Analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics data",
      error: error.message,
    });
  }
});

module.exports = router;
