const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");
const { logActivity, ACTIONS } = require("../utils/auditLogger");

// Register new user - UPDATED with subject support for Head Teachers
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
      subject, // NEW: Subject field for Head Teachers
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

    // Validate role_id - Only allow Teacher (4) and Head Teacher (3)
    if (![3, 4].includes(parseInt(role_id))) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid role. Only Teacher and Head Teacher roles are allowed for registration.",
      });
    }

    // NEW: Validate subject for Head Teachers
    if (parseInt(role_id) === 3 && !subject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required for Head Teacher registration.",
      });
    }

    // Check if username (full name), email, or employee_id exists
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

    // NEW: Check if Head Teacher already exists for this department + subject
    if (parseInt(role_id) === 3) {
      const [existingHeadTeacher] = await pool.query(
        `SELECT user_id, full_name FROM users 
         WHERE role_id = 3 AND department = ? AND subject = ? AND status = 'active'`,
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

    // Insert user with subject field
    const [result] = await pool.query(
      `INSERT INTO users 
       (username, email, password_hash, full_name, role_id, department, employee_id, subject, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        username,
        email,
        password_hash,
        full_name,
        role_id,
        department,
        employee_id,
        parseInt(role_id) === 3 ? subject : null, // Only store subject for Head Teachers
      ]
    );

    const newUserId = result.insertId;

    // Log activity
    const actorUserId = req.user ? req.user.user_id : newUserId;
    const roleType =
      parseInt(role_id) === 3 ? `Head Teacher (${subject})` : "Teacher";

    await logActivity(
      actorUserId,
      ACTIONS.USER_CREATED,
      null,
      `New ${roleType} registered: ${username} (${full_name}) - ${department}`,
      req.ip,
      req.get("user-agent")
    );

    console.log(
      `✅ User created: ${username} (Employee ID: ${employee_id}) in ${department}${
        subject ? ` - Subject: ${subject}` : ""
      }`
    );

    res.status(201).json({
      success: true,
      message:
        parseInt(role_id) === 3
          ? `Head Teacher for ${subject} registered successfully.`
          : "User registered successfully.",
      userId: newUserId,
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

// Login - Modified to include subject in user data
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name and password are required.",
      });
    }

    // Get user with role information - UPDATED to include subject
    const [users] = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.password_hash, u.full_name, 
              u.department, u.subject, u.status, u.role_id, r.role_name
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

    // Generate JWT - UPDATED to include subject
    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role_name,
        roleId: user.role_id,
        department: user.department,
        subject: user.subject, // NEW: Include subject in token
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
        subject: user.subject, // NEW: Include subject in response
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

module.exports = router;

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

    // Get current password hash
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

    // Verify current password
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

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [
      newPasswordHash,
      userId,
    ]);

    // Log activity
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

    // Check if requester is admin
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

    // Get target user info
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

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update password
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

    // Log activity
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
    // Try to get user from token if available
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user info
        const [users] = await pool.query(
          "SELECT user_id, username FROM users WHERE user_id = ?",
          [decoded.userId]
        );

        if (users.length > 0) {
          const user = users[0];

          // Log logout activity
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
        console.log("Logout without valid token (token expired or invalid)");
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
