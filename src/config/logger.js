const winston = require("winston");

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    logFormat
  ),
  defaultMeta: { service: "inventory-api" },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// If we're not in production, also log to the console
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    })
  );
}

module.exports = logger;
