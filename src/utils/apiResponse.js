/**
 * Standard API response formatter
 */
class ApiResponse {
  /**
   * Success response
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {*} data - Response data
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  static success(res, message, data = null, statusCode = 200) {
    return res.status(statusCode).json({
      status: statusCode,
      success: true,
      message,
      data,
    });
  }

  /**
   * Error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} code - Error code (default: ERROR)
   * @param {*} details - Additional error details
   */
  static error(res, message, statusCode = 500, code = "ERROR", details = null) {
    return res.status(statusCode).json({
      status: statusCode,
      success: false,
      message,
      code,
      ...(details && { details }),
    });
  }

  /**
   * Created response (201)
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {*} data - Created resource data
   */
  static created(res, message, data) {
    return this.success(res, message, data, 201);
  }

  /**
   * Bad request response (400)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {*} details - Additional error details
   */
  static badRequest(res, message, details = null) {
    return this.error(res, message, 400, "BAD_REQUEST", details);
  }

  /**
   * Unauthorized response (401)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  static unauthorized(res, message = "Unauthorized") {
    return this.error(res, message, 401, "UNAUTHORIZED");
  }

  /**
   * Forbidden response (403)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  static forbidden(res, message = "Forbidden") {
    return this.error(res, message, 403, "FORBIDDEN");
  }

  /**
   * Not found response (404)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  static notFound(res, message = "Resource not found") {
    return this.error(res, message, 404, "NOT_FOUND");
  }

  /**
   * Conflict response (409)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {*} details - Additional error details
   */
  static conflict(res, message, details = null) {
    return this.error(res, message, 409, "CONFLICT", details);
  }
}

module.exports = ApiResponse;
