const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");
const { logActivity, ACTIONS } = require("../utils/auditLogger");

// Register new user - UPDATED with approval workflow
router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      full_name,
      role_id,
      department,
      employee_id,
      subject,
    } = req.body;

    // Validation
    if (
      !username ||
      !email ||
      !password ||
      !full_name ||
      !role_id ||
      !department ||
      !employee_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "All required fields must be provided (including department and employee ID).",
      });
    }

    // Check if request is from authenticated admin/principal
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    let isAdminRequest = false;
    let adminUser = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === "Admin" || decoded.role === "Principal") {
          isAdminRequest = true;
          adminUser = decoded;
        }
      } catch (error) {
        isAdminRequest = false;
      }
    }

    // Role validation
    if (!isAdminRequest) {
      if (![3, 4].includes(parseInt(role_id))) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid role. Only Teacher and Head Teacher roles are allowed for registration.",
        });
      }
    } else {
      if (![1, 2, 3, 4, 5].includes(parseInt(role_id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid role ID provided.",
        });
      }
    }

    // Validate subject for Head Teachers
    if (parseInt(role_id) === 3 && !subject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required for Head Teacher registration.",
      });
    }

    // Check if username, email, or employee_id exists
    const [existingUsers] = await pool.query(
      "SELECT user_id FROM users WHERE username = ? OR email = ? OR employee_id = ?",
      [username, email, employee_id]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "A user with this name, email, or employee ID already exists.",
      });
    }

    // Check if Head Teacher already exists for department + subject
    if (parseInt(role_id) === 3) {
      const [existingHeadTeacher] = await pool.query(
        `SELECT user_id, full_name FROM users 
         WHERE role_id = 3 AND department = ? AND subject = ? 
         AND approval_status = 'approved' AND status = 'active'`,
        [department, subject]
      );

      if (existingHeadTeacher.length > 0) {
        return res.status(400).json({
          success: false,
          message: `A Head Teacher for ${subject} in ${department} department already exists (${existingHeadTeacher[0].full_name}). Please contact the administrator.`,
        });
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Determine approval status
    // Admins/Principals creating users: auto-approve
    // Teachers/Head Teachers self-registering: pending approval
    const approvalStatus = isAdminRequest ? "approved" : "pending";
    const approvedBy = isAdminRequest ? adminUser.userId : null;
    const approvedAt = isAdminRequest ? new Date() : null;

    // Insert user with approval status
    const [result] = await pool.query(
      `INSERT INTO users 
       (username, email, password_hash, full_name, role_id, department, 
        employee_id, subject, status, approval_status, approved_by, approved_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [
        username,
        email,
        password_hash,
        full_name,
        role_id,
        department,
        employee_id,
        parseInt(role_id) === 3 ? subject : null,
        approvalStatus,
        approvedBy,
        approvedAt,
      ]
    );

    const newUserId = result.insertId;

    // Log activity
    const actorUserId =
      isAdminRequest && adminUser ? adminUser.userId : newUserId;
    const [roleInfo] = await pool.query(
      "SELECT role_name FROM roles WHERE role_id = ?",
      [role_id]
    );
    const roleName = roleInfo[0]?.role_name || "User";
    const roleType =
      parseInt(role_id) === 3 ? `${roleName} (${subject})` : roleName;

    const actionDesc = isAdminRequest
      ? `New ${roleType} created by admin: ${username} (${full_name}) - ${department}`
      : `New ${roleType} registered (pending approval): ${username} (${full_name}) - ${department}`;

    await logActivity(
      actorUserId,
      ACTIONS.USER_CREATED,
      null,
      actionDesc,
      req.ip,
      req.get("user-agent")
    );

    console.log(
      `✅ User ${approvalStatus}: ${username} (Employee ID: ${employee_id}) in ${department}${
        subject ? ` - Subject: ${subject}` : ""
      } - Role: ${roleName}`
    );

    res.status(201).json({
      success: true,
      message: isAdminRequest
        ? `${roleName} created successfully.`
        : `Registration submitted successfully! Your account is pending administrator approval. You will be notified once approved.`,
      userId: newUserId,
      requiresApproval: !isAdminRequest,
      approvalStatus: approvalStatus,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed.",
      error: error.message,
    });
  }
});

// Login - UPDATED to check approval status
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name and password are required.",
      });
    }

    // Get user with role information
    const [users] = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.password_hash, u.full_name, 
              u.department, u.subject, u.status, u.role_id, u.approval_status, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.full_name = ? OR u.username = ? OR u.email = ?`,
      [username, username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid credentials. Please check your full name and password.",
      });
    }

    const user = users[0];

    // Check approval status for teachers and head teachers
    if ([3, 4].includes(user.role_id)) {
      if (user.approval_status === "pending") {
        return res.status(403).json({
          success: false,
          message:
            "Your account is pending administrator approval. Please wait for approval before logging in.",
        });
      }

      if (user.approval_status === "rejected") {
        return res.status(403).json({
          success: false,
          message:
            "Your account registration was rejected. Please contact the administrator for more information.",
        });
      }
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await logActivity(
        user.user_id,
        ACTIONS.LOGIN_FAILED,
        null,
        "Failed login attempt - incorrect password",
        req.ip,
        req.get("user-agent")
      );

      return res.status(401).json({
        success: false,
        message:
          "Invalid credentials. Please check your full name and password.",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role_name,
        roleId: user.role_id,
        department: user.department,
        subject: user.subject,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    await logActivity(
      user.user_id,
      ACTIONS.LOGIN_SUCCESS,
      null,
      "User logged in successfully",
      req.ip,
      req.get("user-agent")
    );

    console.log(
      `✅ Successful login: ${user.full_name} (${user.department}${
        user.subject ? ` - ${user.subject}` : ""
      })`
    );

    delete user.password_hash;

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role_name: user.role_name,
        role_id: user.role_id,
        department: user.department,
        subject: user.subject,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Login failed.",
      error: error.message,
    });
  }
});

// Get pending users (Admin/Principal only)
router.get("/pending-users", authenticateToken, async (req, res) => {
  try {
    console.log("📋 Pending users request from:", req.user);
    console.log("User role:", req.user.role);
    console.log("User roleId:", req.user.roleId);

    // Check if user is Admin (role_id = 1) or Principal (role_id = 2)
    const isAdmin = req.user.roleId === 1 || req.user.role === "Admin";
    const isPrincipal = req.user.roleId === 2 || req.user.role === "Principal";

    if (!isAdmin && !isPrincipal) {
      console.log("❌ Access denied for role:", req.user.role);
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin or Principal privileges required.",
      });
    }

    const [pendingUsers] = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.full_name, u.department, 
              u.subject, u.employee_id, u.created_at, r.role_name, r.role_id
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.approval_status = 'pending'
       ORDER BY u.created_at ASC`
    );

    console.log(`✅ Found ${pendingUsers.length} pending users`);

    res.json({
      success: true,
      pendingUsers,
      count: pendingUsers.length,
    });
  } catch (error) {
    console.error("Get pending users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending users.",
      error: error.message,
    });
  }
});

// Approve user (Admin/Principal only)
router.post("/approve-user/:userId", authenticateToken, async (req, res) => {
  try {
    console.log("✅ Approve request from:", req.user);

    // Check if user is Admin or Principal
    const isAdmin = req.user.roleId === 1 || req.user.role === "Admin";
    const isPrincipal = req.user.roleId === 2 || req.user.role === "Principal";

    if (!isAdmin && !isPrincipal) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin or Principal privileges required.",
      });
    }

    const { userId } = req.params;

    // Get user info
    const [users] = await pool.query(
      `SELECT u.*, r.role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.role_id 
       WHERE u.user_id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = users[0];

    if (user.approval_status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `User is already ${user.approval_status}.`,
      });
    }

    // Update approval status
    await pool.query(
      `UPDATE users 
       SET approval_status = 'approved', 
           approved_by = ?, 
           approved_at = NOW(),
           is_approved = 1
       WHERE user_id = ?`,
      [req.user.userId, userId]
    );

    // Log activity
    await logActivity(
      req.user.userId,
      ACTIONS.USER_UPDATED,
      null,
      `Approved user registration: ${user.username} (${user.full_name}) - ${user.role_name}`,
      req.ip,
      req.get("user-agent")
    );

    console.log(`✅ User approved: ${user.username} by ${req.user.username}`);

    res.json({
      success: true,
      message: `User ${user.full_name} has been approved successfully.`,
    });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve user.",
      error: error.message,
    });
  }
});

// Reject user (Admin/Principal only)
router.post("/reject-user/:userId", authenticateToken, async (req, res) => {
  try {
    console.log("❌ Reject request from:", req.user);

    // Check if user is Admin or Principal
    const isAdmin = req.user.roleId === 1 || req.user.role === "Admin";
    const isPrincipal = req.user.roleId === 2 || req.user.role === "Principal";

    if (!isAdmin && !isPrincipal) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin or Principal privileges required.",
      });
    }

    const { userId } = req.params;
    const { reason } = req.body;

    // Get user info
    const [users] = await pool.query(
      `SELECT u.*, r.role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.role_id 
       WHERE u.user_id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = users[0];

    if (user.approval_status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `User is already ${user.approval_status}.`,
      });
    }

    // Update approval status to rejected
    await pool.query(
      `UPDATE users 
       SET approval_status = 'rejected', 
           rejected_by = ?, 
           rejected_at = NOW(),
           status = 'inactive'
       WHERE user_id = ?`,
      [req.user.userId, userId]
    );

    // Log activity
    await logActivity(
      req.user.userId,
      ACTIONS.USER_UPDATED,
      null,
      `Rejected user registration: ${user.username} (${user.full_name}) - ${
        user.role_name
      }${reason ? `. Reason: ${reason}` : ""}`,
      req.ip,
      req.get("user-agent")
    );

    console.log(`❌ User rejected: ${user.username} by ${req.user.username}`);

    res.json({
      success: true,
      message: `User ${user.full_name} has been rejected.`,
    });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject user.",
      error: error.message,
    });
  }
});

// Change password
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.user_id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long.",
      });
    }

    const [users] = await pool.query(
      "SELECT password_hash FROM users WHERE user_id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isValid = await bcrypt.compare(
      currentPassword,
      users[0].password_hash
    );
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [
      newPasswordHash,
      userId,
    ]);

    await logActivity(
      userId,
      ACTIONS.PASSWORD_CHANGED,
      null,
      "User changed their password",
      req.ip,
      req.get("user-agent")
    );

    console.log(`✅ Password changed for user ID: ${userId}`);

    res.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password.",
      error: error.message,
    });
  }
});

// Reset password (Admin only)
router.post("/reset-password", authenticateToken, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (req.user.role_name !== "Admin" && req.user.role_name !== "Principal") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "User ID and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    const [targetUser] = await pool.query(
      "SELECT username, full_name FROM users WHERE user_id = ?",
      [userId]
    );

    if (targetUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);

    const [result] = await pool.query(
      "UPDATE users SET password_hash = ? WHERE user_id = ?",
      [password_hash, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await logActivity(
      req.user.user_id,
      ACTIONS.PASSWORD_RESET,
      null,
      `Reset password for user: ${targetUser[0].username} (${targetUser[0].full_name})`,
      req.ip,
      req.get("user-agent")
    );

    console.log(
      `✅ Password reset by admin for user: ${targetUser[0].username}`
    );

    res.json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password.",
      error: error.message,
    });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [users] = await pool.query(
          "SELECT user_id, username FROM users WHERE user_id = ?",
          [decoded.userId]
        );

        if (users.length > 0) {
          const user = users[0];
          await logActivity(
            user.user_id,
            ACTIONS.LOGOUT,
            null,
            "User logged out",
            req.ip,
            req.get("user-agent")
          );
          console.log(`✅ User logged out: ${user.username}`);
        }
      } catch (error) {
        console.log("Logout without valid token");
      }
    }

    res.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.json({
      success: true,
      message: "Logged out successfully.",
    });
  }
});

module.exports = router;
