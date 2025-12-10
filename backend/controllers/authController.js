// backend/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/database");
const { logActivity } = require("../middleware/auth");

/**
 * Register a new user with hashed password
 */
const register = async (req, res) => {
  try {
    const { username, email, password, full_name, role_id, department } =
      req.body;

    // Validate input
    if (!username || !email || !password || !full_name || !role_id) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Check if username already exists
    const checkUserSql =
      "SELECT user_id FROM users WHERE username = ? OR email = ?";
    const existingUsers = await query(checkUserSql, [username, email]);

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    // Hash password with bcrypt (salt rounds: 10)
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const insertSql = `
      INSERT INTO users (username, email, password_hash, full_name, role_id, department, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `;

    const result = await query(insertSql, [
      username,
      email,
      password_hash,
      full_name,
      role_id,
      department || null,
    ]);

    // Get the created user (without password)
    const getUserSql = `
      SELECT u.user_id, u.username, u.email, u.full_name, u.department,
             r.role_name, r.role_id
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE u.user_id = ?
    `;
    const newUser = await query(getUserSql, [result.insertId]);

    // Log activity
    await logActivity(
      result.insertId,
      "USER_REGISTERED",
      null,
      `New user registered: ${username}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: newUser[0],
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

/**
 * Login user with password verification
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide username and password",
      });
    }

    // Get user from database (including password hash)
    const sql = `
      SELECT u.user_id, u.username, u.email, u.password_hash, u.full_name, 
             u.department, u.status, u.role_id, r.role_name, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE u.username = ? OR u.email = ?
    `;

    const users = await query(sql, [username, username]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const user = users[0];

    // Check if user is active
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Log failed login attempt
      await logActivity(
        user.user_id,
        "LOGIN_FAILED",
        null,
        "Failed login attempt - incorrect password",
        req.ip
      );

      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    // Remove password hash from response
    delete user.password_hash;

    // Log successful login
    await logActivity(
      user.user_id,
      "LOGIN_SUCCESS",
      null,
      "User logged in successfully",
      req.ip
    );

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};

/**
 * Change user password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.user_id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    // Get current password hash
    const getUserSql = "SELECT password_hash FROM users WHERE user_id = ?";
    const users = await query(getUserSql, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      users[0].password_hash
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const updateSql = "UPDATE users SET password_hash = ? WHERE user_id = ?";
    await query(updateSql, [newPasswordHash, userId]);

    // Log activity
    await logActivity(
      userId,
      "PASSWORD_CHANGED",
      null,
      "User changed their password",
      req.ip
    );

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password. Please try again.",
    });
  }
};

/**
 * Reset password (for admin use)
 */
const resetPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const adminId = req.user.user_id;

    // Check if requester is admin
    if (req.user.role_name !== "Admin" && req.user.role_name !== "Principal") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    // Validate input
    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide user ID and new password",
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Hash new password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const updateSql = "UPDATE users SET password_hash = ? WHERE user_id = ?";
    const result = await query(updateSql, [password_hash, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Log activity
    await logActivity(
      adminId,
      "PASSWORD_RESET",
      null,
      `Admin reset password for user ID: ${userId}`,
      req.ip
    );

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password. Please try again.",
    });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const sql = `
      SELECT u.user_id, u.username, u.email, u.full_name, u.department,
             u.status, u.created_at, r.role_name, r.role_id
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE u.user_id = ?
    `;

    const users = await query(sql, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user: users[0],
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get profile",
    });
  }
};

/**
 * Logout user (client-side should clear token)
 */
const logout = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Log activity
    await logActivity(userId, "LOGOUT", null, "User logged out", req.ip);

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

module.exports = {
  register,
  login,
  changePassword,
  resetPassword,
  getProfile,
  logout,
};
