const express = require("express");
const router = express.Router();
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");
const { logActivity, ACTIONS } = require("../utils/auditLogger");

// Get user profile
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [users] = await pool.query(
      `SELECT user_id, full_name, email, department, subject, profile_picture, role_id
       FROM users WHERE user_id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
});

// Update profile picture
router.post("/upload-picture", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { profile_picture } = req.body;

    // Validate base64 image
    if (!profile_picture || !profile_picture.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format",
      });
    }

    // Check image size (limit to 5MB in base64)
    const sizeInBytes = (profile_picture.length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    if (sizeInMB > 5) {
      return res.status(400).json({
        success: false,
        message: "Image size too large. Maximum 5MB allowed.",
      });
    }

    // Update database
    await pool.query(`UPDATE users SET profile_picture = ? WHERE user_id = ?`, [
      profile_picture,
      userId,
    ]);

    await logActivity(
      userId,
      ACTIONS.PROFILE_UPDATED,
      null,
      "Updated profile picture",
      req.ip,
      req.get("user-agent")
    );

    res.json({
      success: true,
      message: "Profile picture updated successfully",
      profile_picture,
    });
  } catch (error) {
    console.error("Upload picture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload profile picture",
      error: error.message,
    });
  }
});

// Remove profile picture
router.delete("/remove-picture", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    await pool.query(
      `UPDATE users SET profile_picture = NULL WHERE user_id = ?`,
      [userId]
    );

    await logActivity(
      userId,
      ACTIONS.PROFILE_UPDATED,
      null,
      "Removed profile picture",
      req.ip,
      req.get("user-agent")
    );

    res.json({
      success: true,
      message: "Profile picture removed successfully",
    });
  } catch (error) {
    console.error("Remove picture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove profile picture",
      error: error.message,
    });
  }
});

module.exports = router;
