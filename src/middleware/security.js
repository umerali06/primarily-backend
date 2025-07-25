const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const config = require("../config");

/**
 * Configure security middleware
 * @param {Express} app - Express application
 */
const configureSecurity = (app) => {
  // Set security headers with Helmet - configured to allow images
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:", "http:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    })
  );

  // Configure CORS with more permissive settings for development
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
          "http://localhost:3000",
          "http://localhost:5173",
          "http://localhost:5174",
          "http://localhost:5175",
          "http://localhost:5176",
          "http://localhost:5177",
          "http://localhost:5178",
          "http://localhost:5179",
          "http://localhost:5180",
          "http://localhost:5000",
          "http://localhost:5001",
          "http://localhost:5002",
          "http://localhost:5003",
          "http://localhost:5004",
          "http://localhost:5005",
        ];

        if (
          allowedOrigins.includes(origin) ||
          config.nodeEnv === "development"
        ) {
          return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["Content-Disposition"],
    })
  );

  // Rate limiting - More lenient for development
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // Limit each IP to 1000 requests per minute (very generous for dev)
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: "Too many requests, please try again later.",
    },
    skip: (req) => {
      // Skip rate limiting in development for localhost
      return config.nodeEnv === "development" && req.ip === "::1";
    },
  });

  // Apply rate limiting to all routes
  app.use("/api/", apiLimiter);

  // More lenient rate limiting for auth routes in development
  const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 auth requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: "Too many authentication attempts, please try again later.",
    },
    skip: (req) => {
      // Skip rate limiting in development for localhost
      return config.nodeEnv === "development" && req.ip === "::1";
    },
  });

  // Apply rate limiting to auth routes
  app.use("/api/auth/", authLimiter);
};

module.exports = configureSecurity;
