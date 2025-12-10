const express = require("express");
const router = express.Router();
const { pool } = require("../config/database");
const authenticateToken = require("../middleware/auth");

/**
 * GET /api/notifications
 * Get all notifications for the current user
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log(`📬 Fetching notifications for user ${userId}`);

    const [notifications] = await pool.query(
      `SELECT 
        n.notification_id as id,
        n.title,
        n.message,
        n.type,
        n.is_read as \`read\`,
        n.created_at as timestamp,
        n.document_id,
        d.title as document_title
      FROM notifications n
      LEFT JOIN documents d ON n.document_id = d.document_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50`,
      [userId]
    );

    console.log(
      `✅ Found ${notifications.length} notifications for user ${userId}`
    );

    // Count unread notifications
    const [unreadCount] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM notifications 
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    console.log(`📊 Unread count: ${unreadCount[0].count}`);

    res.json({
      success: true,
      notifications,
      unreadCount: unreadCount[0].count,
    });
  } catch (error) {
    console.error("❌ Fetch notifications error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications.",
      error: error.message,
      details: error.sqlMessage || error.message,
    });
  }
});

/**
 * POST /api/notifications/:notificationId/read
 * Mark a notification as read
 */
router.post("/:notificationId/read", authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.user_id;

    console.log(
      `📖 Marking notification ${notificationId} as read for user ${userId}`
    );

    await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW() 
       WHERE notification_id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    console.log(`✅ Notification ${notificationId} marked as read`);

    res.json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("❌ Mark notification as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read.",
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
router.post("/mark-all-read", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log(`📖 Marking all notifications as read for user ${userId}`);

    const [result] = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW() 
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    console.log(`✅ Marked ${result.affectedRows} notifications as read`);

    res.json({
      success: true,
      message: "All notifications marked as read.",
      count: result.affectedRows,
    });
  } catch (error) {
    console.error("❌ Mark all notifications as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read.",
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/clear-all
 * Delete all read notifications for current user
 */
router.post("/clear-all", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log(`🗑️ Clearing all read notifications for user ${userId}`);

    const [result] = await pool.query(
      `DELETE FROM notifications 
       WHERE user_id = ? AND is_read = TRUE`,
      [userId]
    );

    console.log(`✅ Cleared ${result.affectedRows} notifications`);

    res.json({
      success: true,
      message: "All read notifications cleared.",
      count: result.affectedRows,
    });
  } catch (error) {
    console.error("❌ Clear notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear notifications.",
      error: error.message,
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get("/unread-count", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [result] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM notifications 
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    res.json({
      success: true,
      count: result[0].count,
    });
  } catch (error) {
    console.error("❌ Fetch unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count.",
      error: error.message,
    });
  }
});

/**
 * Helper function to create a notification
 */
async function createNotification(
  userId,
  documentId,
  title,
  message,
  type,
  connection = null
) {
  const db = connection || pool;

  try {
    // Validate type matches database ENUM: 'info', 'warning', 'success', 'error'
    const validTypes = ["info", "warning", "success", "error"];
    const notificationType = validTypes.includes(type) ? type : "info";

    await db.query(
      `INSERT INTO notifications (user_id, document_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
      [userId, documentId, title, message, notificationType]
    );
    console.log(`✅ Notification created for user ${userId}: ${title}`);
  } catch (error) {
    console.error("❌ Error creating notification:", error);
    console.error("Notification details:", { userId, documentId, title, type });
  }
}

/**
 * POST /api/notifications/create-test
 * Create test notifications for debugging
 */
router.post("/create-test", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log(`🧪 Creating test notifications for user ${userId}`);

    // Get a document_id from user's documents (if any)
    const [docs] = await pool.query(
      "SELECT document_id FROM documents WHERE uploader_id = ? LIMIT 1",
      [userId]
    );

    const documentId = docs.length > 0 ? docs[0].document_id : null;

    // Create test notifications with all types
    const testNotifications = [
      {
        title: "Test Success Notification 🎉",
        message:
          "This is a test success notification - your document was approved!",
        type: "success",
      },
      {
        title: "Test Info Notification ℹ️",
        message:
          "This is a test info notification - your document is progressing.",
        type: "info",
      },
      {
        title: "Test Warning Notification ⚠️",
        message: "This is a test warning notification - revision requested.",
        type: "warning",
      },
      {
        title: "Test Error Notification ❌",
        message:
          "This is a test error notification - your document was rejected.",
        type: "error",
      },
    ];

    for (const notif of testNotifications) {
      await pool.query(
        `INSERT INTO notifications (user_id, document_id, title, message, type, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
        [userId, documentId, notif.title, notif.message, notif.type]
      );
      console.log(`✅ Created test notification: ${notif.title}`);
    }

    res.json({
      success: true,
      message: `Created ${testNotifications.length} test notifications`,
      userId: userId,
      documentId: documentId,
    });
  } catch (error) {
    console.error("❌ Error creating test notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create test notifications",
      error: error.message,
      sqlError: error.sqlMessage,
    });
  }
});

// Export the helper function
router.createNotification = createNotification;

module.exports = router;
