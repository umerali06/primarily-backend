const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from .env file
dotenv.config();

module.exports = {
  // Server configuration
  port: process.env.PORT || 5003,
  nodeEnv: process.env.NODE_ENV || "development",

  // MongoDB configuration
  mongoURI: process.env.MONGODB_URI,

  // JWT configuration
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // Google OAuth configuration
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackURL: process.env.GOOGLE_CALLBACK_URL,

  // File storage configuration
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || 5242880, 10), // 5MB in bytes

  // Logging configuration
  logLevel: process.env.LOG_LEVEL || "info",

  // Cors configuration
  corsOrigin: process.env.CORS_ORIGIN || "*",

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};
