/**
 * Custom error class for API errors
 * @extends Error
 */
class CustomError extends Error {
  /**
   * Create a custom error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Error code
   */
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad request error (400)
 * @extends CustomError
 */
class BadRequestError extends CustomError {
  constructor(message = "Bad Request") {
    super(message, 400, "BAD_REQUEST");
  }
}

/**
 * Unauthorized error (401)
 * @extends CustomError
 */
class UnauthorizedError extends CustomError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

/**
 * Forbidden error (403)
 * @extends CustomError
 */
class ForbiddenError extends CustomError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

/**
 * Not found error (404)
 * @extends CustomError
 */
class NotFoundError extends CustomError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

/**
 * Conflict error (409)
 * @extends CustomError
 */
class ConflictError extends CustomError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT");
  }
}

/**
 * Validation error (422)
 * @extends CustomError
 */
class ValidationError extends CustomError {
  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {Object} errors - Validation errors
   */
  constructor(message = "Validation Error", errors = {}) {
    super(message, 422, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

module.exports = {
  CustomError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
};
