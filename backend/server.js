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

// IMPORTANT: Add Railway health check endpoint FIRST (before any middleware)
// Railway checks this endpoint to verify your service is running
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Also keep your API health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "SiguraDocs API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// IMPORTANT: Mount public password reset routes BEFORE the main authRoutes
// so router-level auth middleware inside authRoutes won't block reset endpoints.
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
    status: "running",
    endpoints: {
      health: "/api/health",
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
    console.log(`📍 Port: ${PORT}`);

    // Test database connection with retry logic
    let dbConnected = false;
    let retries = 5;

    while (!dbConnected && retries > 0) {
      try {
        await testConnection();
        dbConnected = true;
        console.log("✅ Database connected successfully");
      } catch (error) {
        retries--;
        console.warn(
          `⚠️ Database connection attempt failed. Retries left: ${retries}`
        );
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s before retry
        } else {
          throw error;
        }
      }
    }

    // Start the server
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Allowed origins:`, allowedOrigins);
      console.log(`💾 Memory usage:`, process.memoryUsage());
    });

    // Graceful shutdown handling
    process.on("SIGTERM", () => {
      console.log("⚠️ SIGTERM received, starting graceful shutdown...");
      server.close(() => {
        console.log("✅ Server closed gracefully");
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error("⚠️ Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    });

    process.on("SIGINT", () => {
      console.log("⚠️ SIGINT received, starting graceful shutdown...");
      server.close(() => {
        console.log("✅ Server closed gracefully");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    console.error("Error details:", error.message);
    process.exit(1);
  }
};

startServer();
