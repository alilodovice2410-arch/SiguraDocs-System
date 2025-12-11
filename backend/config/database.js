// backend/config/database.js
const mysql = require("mysql2");
require("dotenv").config();

// Create connection pool with Railway-optimized settings
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Railway-specific timeout - IMPORTANT for cloud deployments
  connectTimeout: 60000, // 60 seconds - Railway needs longer timeout
});

// Convert pool to use promises
const promisePool = pool.promise();

// Test database connection with detailed error handling and retry logic
const testConnection = async () => {
  let attempts = 0;
  const maxAttempts = 5;
  const retryDelay = 2000; // 2 seconds

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(
        `🔄 Testing database connection (attempt ${attempts}/${maxAttempts})...`
      );
      console.log(`📍 Host: ${process.env.DB_HOST}`);
      console.log(`📍 Database: ${process.env.DB_NAME}`);
      console.log(`📍 Port: ${process.env.DB_PORT || 3306}`);
      console.log(`📍 User: ${process.env.DB_USER}`);

      const connection = await promisePool.getConnection();

      // Test with a simple query
      const [rows] = await connection.query("SELECT 1 as test");
      console.log("✅ Database connection successful!");
      console.log(`✅ Test query result:`, rows[0]);

      connection.release();
      return true;
    } catch (error) {
      console.error(`❌ Database connection attempt ${attempts} failed!`);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);

      // Specific error messages for common issues
      if (error.code === "ECONNREFUSED") {
        console.error("💡 Connection refused. Possible causes:");
        console.error(
          "   - DB_HOST is incorrect (check Railway MySQL private network URL)"
        );
        console.error("   - MySQL service is not running");
        console.error("   - Port 3306 is not accessible");
      } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
        console.error("💡 Access denied. Check:");
        console.error("   - DB_USER and DB_PASSWORD are correct");
        console.error("   - User has proper database permissions");
      } else if (error.code === "ENOTFOUND") {
        console.error("💡 Host not found. Check:");
        console.error("   - DB_HOST environment variable");
        console.error(
          "   - Use Railway private network URL (e.g., mysql.railway.internal)"
        );
        console.error("   - NOT localhost or 127.0.0.1 in production");
      } else if (error.code === "ETIMEDOUT") {
        console.error("💡 Connection timeout. Check:");
        console.error("   - Network connectivity between services");
        console.error("   - MySQL service is running and healthy");
        console.error("   - Firewall/security group settings");
      } else if (error.code === "ECONNRESET") {
        console.error("💡 Connection reset. Check:");
        console.error("   - MySQL max_connections limit");
        console.error("   - Network stability");
      }

      // If not last attempt, wait and retry
      if (attempts < maxAttempts) {
        console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        console.error(`❌ Failed to connect after ${maxAttempts} attempts`);
        console.error("🔍 Debug info:");
        console.error("   - Ensure MySQL service is deployed and running");
        console.error(
          "   - Check all DB_* environment variables are set correctly"
        );
        console.error("   - Verify network connectivity between services");
        throw error;
      }
    }
  }
};

// Helper query function
const query = async (sql, params) => {
  try {
    const [results] = await promisePool.query(sql, params);
    return results;
  } catch (error) {
    console.error("❌ Query error:", error.message);
    console.error("SQL:", sql);
    throw error;
  }
};

// Graceful pool shutdown
const closePool = async () => {
  try {
    await promisePool.end();
    console.log("✅ Database pool closed gracefully");
  } catch (error) {
    console.error("❌ Error closing database pool:", error);
  }
};

// Handle process termination - important for Railway deployments
process.on("SIGTERM", async () => {
  console.log("⚠️ SIGTERM received - closing database pool...");
  await closePool();
});

process.on("SIGINT", async () => {
  console.log("⚠️ SIGINT received - closing database pool...");
  await closePool();
});

module.exports = {
  pool: promisePool,
  testConnection,
  query,
  closePool,
};
