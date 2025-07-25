const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const { connectDB, isConnected } = require("./config/database");
const logger = require("./config/logger");
const errorHandler = require("./middleware/errorHandler");

// Create Express app
const app = express();

// Connect to MongoDB and initialize database
const initializeDatabase = require("./config/dbInit");
initializeDatabase().catch((err) => {
  logger.error(`Database initialization failed: ${err.message}`);
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../", config.uploadDir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Create temp directory for imports
const tempDir = path.join(uploadsDir, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Configure security middleware (helmet, cors, rate limiting)
const configureSecurity = require("./middleware/security");
configureSecurity(app);

// Basic middleware
const cookieParser = require("cookie-parser");
const passport = require("passport");
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
); // HTTP request logging

// Configure and initialize Passport
const configurePassport = require("./config/passport");
configurePassport();
app.use(passport.initialize());

// Configure Swagger documentation
const { specs, swaggerUi } = require("./config/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Serve static files from uploads directory
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../", config.uploadDir))
);

// Add specific route for serving images with CORS headers
app.use(
  "/uploads/items",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  },
  express.static(path.join(__dirname, "../", config.uploadDir, "items"))
);

// API Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/items", require("./routes/item.routes"));
app.use("/api/folders", require("./routes/folder.routes"));
app.use("/api/alerts", require("./routes/alert.routes"));
app.use("/api/activities", require("./routes/activity.routes"));
app.use("/api/permissions", require("./routes/permission.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/export", require("./routes/export.routes"));
app.use("/api/import", require("./routes/import.routes"));
app.use("/api/tags", require("./routes/tag.routes"));
app.use("/api/reports", require("./routes/report.routes"));
app.use("/api/onboarding", require("./routes/onboarding.routes"));
app.use("/api/trial", require("./routes/trial.routes"));
app.use("/api/settings", require("./routes/settings.routes"));
app.use("/api/enterprise-leads", require("./routes/enterpriseLead.routes"));
app.use("/api/contacts", require("./routes/contact.routes"));
app.use("/api/newsletter", require("./routes/newsletter.routes"));

// Health check endpoint
app.get("/health", (req, res) => {
  const dbStatus = isConnected() ? "connected" : "disconnected";
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Inventory Management API",
    version: "1.0.0",
    documentation: "/api-docs",
  });
});

// Error handling middleware
app.use(errorHandler);

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = { app, server };
