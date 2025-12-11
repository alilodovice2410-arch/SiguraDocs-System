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

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "SiguraDocs API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

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
    // Test database connection
    await testConnection();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`🌐 Allowed origins:`, allowedOrigins);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
