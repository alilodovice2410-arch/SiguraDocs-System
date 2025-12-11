const express = require("express");
const cors = require("cors");
const path = require("path");

// Load .env located next to this file (backend/.env)
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const { testConnection } = require("./config/database");

// Import routes
const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");
const approvalRoutes = require("./routes/approvals");
const adminRoutes = require("./routes/admin");
const dashboardRoutes = require("./routes/dashboard");
const principalRoutes = require("./routes/principal");
const notificationsRoutes = require("./routes/notifications");
const clusteringRoutes = require("./routes/clustering");
const passwordResetRouter = require("./routes/passwordReset");
const analyticsRoutes = require("./routes/analytics");
const departmentHeadRoutes = require("./routes/departmentHead");
const profileRoutes = require("./routes/profile");

const app = express();

// Ready flag for health checks
let isReady = false;
let dbReady = false;

// CORS Configuration - Allow frontend domain
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://siguradocs-system-smnhs.up.railway.app",
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(null, true); // Allow in production, log warning
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// CRITICAL: Railway health check endpoint - must respond quickly
app.get("/health", (req, res) => {
  // Return 503 if not ready (Railway will retry)
  if (!isReady) {
    return res.status(503).json({
      status: "starting",
      message: "Server is initializing...",
      dbReady: dbReady,
    });
  }

  // Return 200 when ready
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: dbReady ? "connected" : "disconnected",
  });
});

// Also keep your API health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "SiguraDocs API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    ready: isReady,
  });
});

// IMPORTANT: Mount public password reset routes BEFORE the main authRoutes
app.use("/api/auth", passwordResetRouter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/principal", principalRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/clustering", clusteringRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/department-head", departmentHeadRoutes);
app.use("/api/profile", profileRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "SiguraDocs API",
    version: "1.0.0",
    status: isReady ? "running" : "initializing",
    endpoints: {
      health: "/health",
      apiHealth: "/api/health",
      auth: "/api/auth",
      documents: "/api/documents",
      approvals: "/api/approvals",
      admin: "/api/admin",
      dashboard: "/api/dashboard",
    },
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log("🚀 Starting SiguraDocs Backend...");
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`📍 PORT from env: ${process.env.PORT || "not set"}`);
    console.log(`📍 Will bind to port: ${PORT}`);

    // Start server FIRST (before database connection)
    // This allows Railway health checks to get a response immediately
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server listening on port ${PORT}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Allowed origins:`, allowedOrigins);

      // Now connect to database in background
      connectDatabase();
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      console.log(`⚠️ ${signal} received, starting graceful shutdown...`);
      isReady = false;

      server.close(() => {
        console.log("✅ Server closed gracefully");
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error("⚠️ Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      // Don't exit - let Railway restart if needed
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      // Don't exit - let Railway restart if needed
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    console.error("Error details:", error.message);
    process.exit(1);
  }
};

// Separate function to connect to database (non-blocking)
async function connectDatabase() {
  try {
    console.log("🔄 Connecting to database...");

    // Test database connection with retry logic
    let retries = 5;
    let connected = false;

    while (!connected && retries > 0) {
      try {
        await testConnection();
        connected = true;
        dbReady = true;
        console.log("✅ Database connected successfully");
        console.log(`💾 Memory usage:`, process.memoryUsage());

        // Mark application as ready
        isReady = true;
        console.log("✅ Application is READY to accept requests");
      } catch (error) {
        retries--;
        console.warn(`⚠️ Database connection failed. Retries left: ${retries}`);
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3s
        } else {
          console.error("❌ Database connection failed after all retries");
          console.error("⚠️ Server will continue without database");
          // Don't exit - let the server run for health checks
          isReady = true; // Mark as ready anyway to prevent Railway from killing it
        }
      }
    }
  } catch (error) {
    console.error("❌ Database connection error:", error.message);
    // Don't exit - mark as ready to keep server alive
    isReady = true;
  }
}

startServer();
