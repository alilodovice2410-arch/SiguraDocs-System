const express = require("express");
const router = express.Router();
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");
const checkRole = require("../middleware/roleCheck");
const bcrypt = require("bcryptjs");
const { logActivity, ACTIONS } = require("../utils/auditLogger");

// Get all users (Admin only)
router.get(
  "/users",
  authenticateToken,
  checkRole("Admin", "Principal"),
  async (req, res) => {
    try {
      const [users] = await pool.query(`
        SELECT u.user_id, u.username, u.email, u.full_name, u.department, 
               u.role_id, r.role_name, u.status, u.created_at
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        ORDER BY u.created_at DESC
      `);

      res.json({
        success: true,
        users,
      });
    } catch (error) {
      console.error("Fetch users error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch users.",
        error: error.message,
      });
    }
  }
);

// Get all roles
router.get("/roles", authenticateToken, async (req, res) => {
  try {
    const [roles] = await pool.query(
      "SELECT role_id, role_name FROM roles ORDER BY role_name"
    );
    res.json({
      success: true,
      roles,
    });
  } catch (error) {
    console.error("Fetch roles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch roles.",
      error: error.message,
    });
  }
});

// Get all departments
router.get("/departments", authenticateToken, async (req, res) => {
  try {
    const [departments] = await pool.query(
      "SELECT department_id, department_name FROM departments ORDER BY department_name"
    );
    res.json({
      success: true,
      departments,
    });
  } catch (error) {
    console.error("Fetch departments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch departments.",
      error: error.message,
    });
  }
});

// Update user
router.put(
  "/users/:userId",
  authenticateToken,
  checkRole("Admin", "Principal"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { email, password, full_name, role_id, department } = req.body;

      // Get user info before update for logging
      const [userBefore] = await pool.query(
        "SELECT username, full_name, email, role_id, department FROM users WHERE user_id = ?",
        [userId]
      );

      if (userBefore.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // Build update query dynamically
      let updateFields = [];
      let updateValues = [];
      let changes = [];

      if (email && email !== userBefore[0].email) {
        updateFields.push("email = ?");
        updateValues.push(email);
        changes.push(`email from ${userBefore[0].email} to ${email}`);
      }

      if (full_name && full_name !== userBefore[0].full_name) {
        updateFields.push("full_name = ?");
        updateValues.push(full_name);
        changes.push(`name from ${userBefore[0].full_name} to ${full_name}`);
      }

      if (role_id && role_id !== userBefore[0].role_id) {
        updateFields.push("role_id = ?");
        updateValues.push(role_id);
        changes.push(`role changed`);
      }

      if (department !== undefined && department !== userBefore[0].department) {
        updateFields.push("department = ?");
        updateValues.push(department || null);
        changes.push(`department updated`);
      }

      if (password) {
        const password_hash = await bcrypt.hash(password, 10);
        updateFields.push("password_hash = ?");
        updateValues.push(password_hash);
        changes.push(`password reset`);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No fields to update.",
        });
      }

      updateValues.push(userId);
      const query = `UPDATE users SET ${updateFields.join(
        ", "
      )} WHERE user_id = ?`;

      const [result] = await pool.query(query, updateValues);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // ⭐ Log the update activity
      await logActivity(
        req.user.user_id,
        ACTIONS.USER_UPDATED,
        null,
        `Updated user ${userBefore[0].username}: ${changes.join(", ")}`,
        req.ip,
        req.get("user-agent")
      );

      console.log(`✅ User updated: ${userBefore[0].username}`);

      res.json({
        success: true,
        message: "User updated successfully.",
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update user.",
        error: error.message,
      });
    }
  }
);

// Delete user
router.delete(
  "/users/:userId",
  authenticateToken,
  checkRole("Admin"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Prevent deleting own account
      if (parseInt(userId) === req.user.user_id) {
        return res.status(400).json({
          success: false,
          message: "You cannot delete your own account.",
        });
      }

      // Get user info before deletion for logging
      const [user] = await pool.query(
        "SELECT username, full_name FROM users WHERE user_id = ?",
        [userId]
      );

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // Instead of hard delete, we'll set status to 'inactive'
      const [result] = await pool.query(
        "UPDATE users SET status = 'inactive' WHERE user_id = ?",
        [userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // ⭐ Log activity
      await logActivity(
        req.user.user_id,
        ACTIONS.USER_DELETED,
        null,
        `Deleted user: ${user[0].username} (${user[0].full_name})`,
        req.ip,
        req.get("user-agent")
      );

      console.log(`✅ User deleted: ${user[0].username}`);

      res.json({
        success: true,
        message: "User deleted successfully.",
      });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete user.",
        error: error.message,
      });
    }
  }
);

// Get dashboard statistics
router.get("/statistics", authenticateToken, async (req, res) => {
  try {
    // Total documents
    const [totalDocs] = await pool.query(
      "SELECT COUNT(*) as count FROM Documents"
    );

    // Documents by status
    const [byStatus] = await pool.query(`
      SELECT current_status, COUNT(*) as count 
      FROM Documents 
      GROUP BY current_status
    `);

    // Recent documents
    const [recentDocs] = await pool.query(`
      SELECT d.document_id, d.title, d.current_status, d.submission_date,
             u.first_name, u.last_name, dt.type_name
      FROM Documents d
      JOIN Users u ON d.submitted_by_user_id = u.user_id
      JOIN DocumentTypes dt ON d.doc_type_id = dt.doc_type_id
      ORDER BY d.submission_date DESC
      LIMIT 10
    `);

    // Total users by role
    const [usersByRole] = await pool.query(`
      SELECT role, COUNT(*) as count 
      FROM Users 
      GROUP BY role
    `);

    res.json({
      success: true,
      statistics: {
        totalDocuments: totalDocs[0].count,
        documentsByStatus: byStatus,
        recentDocuments: recentDocs,
        usersByRole,
      },
    });
  } catch (error) {
    console.error("Fetch statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics.",
      error: error.message,
    });
  }
});

// Get approval matrix
router.get(
  "/approval-matrix",
  authenticateToken,
  checkRole("Admin", "Principal"),
  async (req, res) => {
    try {
      const [matrix] = await pool.query(`
        SELECT am.*, dt.type_name, d.department_name
        FROM ApprovalMatrix am
        JOIN DocumentTypes dt ON am.doc_type_id = dt.doc_type_id
        LEFT JOIN Departments d ON am.target_department_id = d.department_id
        ORDER BY dt.type_name, am.step_order
      `);

      res.json({
        success: true,
        matrix,
      });
    } catch (error) {
      console.error("Fetch approval matrix error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch approval matrix.",
        error: error.message,
      });
    }
  }
);

// Create approval matrix step
router.post(
  "/approval-matrix",
  authenticateToken,
  checkRole("Admin"),
  async (req, res) => {
    try {
      const { doc_type_id, step_order, approver_role, target_department_id } =
        req.body;

      if (!doc_type_id || !step_order || !approver_role) {
        return res.status(400).json({
          success: false,
          message: "Document type, step order, and approver role are required.",
        });
      }

      const [result] = await pool.query(
        "INSERT INTO ApprovalMatrix (doc_type_id, step_order, approver_role, target_department_id) VALUES (?, ?, ?, ?)",
        [doc_type_id, step_order, approver_role, target_department_id || null]
      );

      // ⭐ Log activity
      await logActivity(
        req.user.user_id,
        ACTIONS.MATRIX_UPDATED,
        null,
        `Created approval matrix step for document type ${doc_type_id}`,
        req.ip,
        req.get("user-agent")
      );

      console.log(`✅ Approval matrix step created`);

      res.status(201).json({
        success: true,
        message: "Approval matrix step created.",
        matrix_id: result.insertId,
      });
    } catch (error) {
      console.error("Create approval matrix error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create approval matrix step.",
        error: error.message,
      });
    }
  }
);

// Get audit logs (Admin and Principal only)
router.get(
  "/audit-logs",
  authenticateToken,
  checkRole("Admin", "Principal"),
  async (req, res) => {
    try {
      const [logs] = await pool.query(`
        SELECT 
          al.log_id,
          al.user_id,
          al.document_id,
          al.action,
          al.details,
          al.ip_address,
          al.user_agent,
          al.created_at,
          u.full_name,
          r.role_name,
          d.title as document_title
        FROM audit_logs al
        JOIN users u ON al.user_id = u.user_id
        JOIN roles r ON u.role_id = r.role_id
        LEFT JOIN documents d ON al.document_id = d.document_id
        ORDER BY al.created_at DESC
        LIMIT 1000
      `);

      res.json({
        success: true,
        logs,
      });
    } catch (error) {
      console.error("Fetch audit logs error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch audit logs.",
        error: error.message,
      });
    }
  }
);

// Get all documents (Admin and Principal only)
router.get(
  "/documents",
  authenticateToken,
  checkRole("Admin", "Principal"),
  async (req, res) => {
    try {
      const [documents] = await pool.query(`
        SELECT 
          d.document_id,
          d.title,
          d.description,
          d.document_type,
          d.file_path,
          d.file_size,
          d.file_name,
          d.uploader_id,
          d.department,
          d.priority,
          d.status,
          d.current_approver_id,
          d.remarks,
          d.approval_deadline,
          d.created_at,
          d.updated_at,
          u.full_name AS uploader_name,
          u.email AS uploader_email,
          r.role_name AS uploader_role,
          u.department AS uploader_department
        FROM documents d
        JOIN users u ON d.uploader_id = u.user_id
        JOIN roles r ON u.role_id = r.role_id
        ORDER BY d.created_at DESC
      `);

      res.json({
        success: true,
        documents,
      });
    } catch (error) {
      console.error("Fetch documents error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch documents.",
        error: error.message,
      });
    }
  }
);

module.exports = router;
