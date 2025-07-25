const logger = require("../config/logger");

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`${err.name}: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || "Server Error";
  let errorCode = err.code || "SERVER_ERROR";

  // Handle specific error types
  if (err.name === "ValidationError") {
    // Mongoose validation error
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    const errors = {};

    // Extract validation errors
    if (err.errors) {
      Object.keys(err.errors).forEach((key) => {
        errors[key] = err.errors[key].message;
      });
    }

    return res.status(statusCode).json({
      status: statusCode,
      message: "Validation failed",
      code: errorCode,
      details: errors,
    });
  }

  if (err.name === "CastError") {
    // Mongoose cast error (invalid ID)
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    errorCode = "INVALID_ID";
  }

  if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    message = "Duplicate field value entered";
    errorCode = "DUPLICATE_VALUE";

    // Extract the duplicate field
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];

    return res.status(statusCode).json({
      status: statusCode,
      message: `Duplicate value: ${field} already exists with value: ${value}`,
      code: errorCode,
      field,
    });
  }

  if (err.name === "JsonWebTokenError") {
    // JWT error
    statusCode = 401;
    message = "Invalid token";
    errorCode = "INVALID_TOKEN";
  }

  if (err.name === "TokenExpiredError") {
    // JWT expired
    statusCode = 401;
    message = "Token expired";
    errorCode = "TOKEN_EXPIRED";
  }

  // Send error response
  res.status(statusCode).json({
    status: statusCode,
    message,
    code: errorCode,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
