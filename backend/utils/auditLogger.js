const { pool } = require("../config/database");

// Define all action types
const ACTIONS = {
  // Authentication
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_RESET: "PASSWORD_RESET",

  // User Management
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  USER_ACTIVATED: "USER_ACTIVATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  PROFILE_UPDATED: "PROFILE_UPDATED",

  // Document Management
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  DOCUMENT_UPDATED: "DOCUMENT_UPDATED",
  DOCUMENT_DELETED: "DOCUMENT_DELETED",
  DOCUMENT_VIEWED: "DOCUMENT_VIEWED",
  DOCUMENT_DOWNLOADED: "DOCUMENT_DOWNLOADED",

  // Approval Actions
  DOCUMENT_APPROVED: "DOCUMENT_APPROVED",
  DOCUMENT_REJECTED: "DOCUMENT_REJECTED",
  REVISION_REQUESTED: "REVISION_REQUESTED",
  APPROVAL_FORWARDED: "APPROVAL_FORWARDED",

  // System Actions
  STATUS_CHANGE: "STATUS_CHANGE",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  MATRIX_UPDATED: "MATRIX_UPDATED",
};

/**
 * Log system activity
 * @param {number} userId - The user performing the action
 * @param {string} action - Action type from ACTIONS constant
 * @param {number|null} documentId - Document ID if applicable
 * @param {string} details - Additional details about the action
 * @param {string} ipAddress - IP address of the user
 * @param {string} userAgent - User agent string
 */
const logActivity = async (
  userId,
  action,
  documentId = null,
  details = "",
  ipAddress = "",
  userAgent = ""
) => {
  // Fire and forget - don't block the caller
  setImmediate(async () => {
    try {
      const query = `
        INSERT INTO audit_logs 
        (user_id, document_id, action, details, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await pool.query(query, [
        userId,
        documentId,
        action,
        details,
        ipAddress || null,
        userAgent || null,
      ]);

      console.log(`Audit log created: ${action} by user ${userId}`);
    } catch (error) {
      console.error("Failed to create audit log:", error);
      // Don't throw - logging failure shouldn't break main operations
    }
  });
};

/**
 * Get audit logs with filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} Array of audit logs
 */
const getAuditLogs = async (filters = {}) => {
  try {
    let query = `
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
        u.username,
        r.role_name,
        d.title as document_title
      FROM audit_logs al
      JOIN users u ON al.user_id = u.user_id
      JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN documents d ON al.document_id = d.document_id
      WHERE 1=1
    `;

    const params = [];

    if (filters.userId) {
      query += " AND al.user_id = ?";
      params.push(filters.userId);
    }

    if (filters.documentId) {
      query += " AND al.document_id = ?";
      params.push(filters.documentId);
    }

    if (filters.action) {
      query += " AND al.action = ?";
      params.push(filters.action);
    }

    if (filters.startDate) {
      query += " AND al.created_at >= ?";
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += " AND al.created_at <= ?";
      params.push(filters.endDate);
    }

    query += " ORDER BY al.created_at DESC";

    if (filters.limit) {
      query += " LIMIT ?";
      params.push(parseInt(filters.limit));
    }

    const [logs] = await pool.query(query, params);
    return logs;
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    throw error;
  }
};

/**
 * Get audit log statistics
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Statistics object
 */
const getAuditStats = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        action,
        COUNT(*) as count
      FROM audit_logs
      WHERE 1=1
    `;

    const params = [];

    if (filters.startDate) {
      query += " AND created_at >= ?";
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += " AND created_at <= ?";
      params.push(filters.endDate);
    }

    query += " GROUP BY action ORDER BY count DESC";

    const [stats] = await pool.query(query, params);
    return stats;
  } catch (error) {
    console.error("Failed to fetch audit stats:", error);
    throw error;
  }
};

module.exports = {
  logActivity,
  getAuditLogs,
  getAuditStats,
  ACTIONS,
};
