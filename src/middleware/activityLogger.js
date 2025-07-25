const Activity = require("../models/activity.model");
const logger = require("../config/logger");

/**
 * Activity logging middleware
 * Automatically logs user activities based on request patterns
 */

/**
 * Extract resource information from request
 * @param {Object} req - Express request object
 * @returns {Object} - Resource information
 */
const extractResourceInfo = (req) => {
  const { method, originalUrl, params, body } = req;

  // Extract resource type and ID from URL patterns
  const urlParts = originalUrl.split("/").filter((part) => part);

  let resourceType = null;
  let resourceId = null;

  // Common patterns: /api/items/:id, /api/folders/:id, etc.
  if (urlParts.length >= 3) {
    const resourcePath = urlParts[2]; // items, folders, etc.

    // Map URL paths to resource types
    const resourceTypeMap = {
      items: "Item",
      folders: "Folder",
      users: "User",
      alerts: "Alert",
      permissions: "Permission",
    };

    resourceType = resourceTypeMap[resourcePath];

    // Extract resource ID from params
    if (params.id) {
      resourceId = params.id;
    }
  }

  return { resourceType, resourceId };
};

/**
 * Determine action from HTTP method and URL
 * @param {Object} req - Express request object
 * @returns {String} - Action name
 */
const determineAction = (req) => {
  const { method, originalUrl } = req;

  // Special cases for specific endpoints
  if (originalUrl.includes("/login")) return "login";
  if (originalUrl.includes("/logout")) return "logout";
  if (originalUrl.includes("/register")) return "register";
  if (originalUrl.includes("/forgot-password")) return "forgot_password";
  if (originalUrl.includes("/reset-password")) return "reset_password";
  if (originalUrl.includes("/update-password")) return "update_password";
  if (originalUrl.includes("/quantity")) return "update_quantity";
  if (originalUrl.includes("/move")) return "move";
  if (originalUrl.includes("/images")) {
    return method === "POST" ? "add_image" : "remove_image";
  }
  if (originalUrl.includes("/bulk")) return "bulk_update";
  if (originalUrl.includes("/status")) return "update_status";

  // Default actions based on HTTP method
  switch (method) {
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
    case "GET":
      return "view";
    default:
      return "unknown";
  }
};

/**
 * Extract relevant details from request
 * @param {Object} req - Express request object
 * @returns {Object} - Activity details
 */
const extractDetails = (req) => {
  const { body, query, params, method } = req;
  const details = {};

  // Add relevant body fields (excluding sensitive data)
  const sensitiveFields = ["password", "token", "refreshToken"];
  Object.keys(body).forEach((key) => {
    if (!sensitiveFields.includes(key)) {
      details[key] = body[key];
    }
  });

  // Add query parameters for GET requests
  if (method === "GET" && Object.keys(query).length > 0) {
    details.query = query;
  }

  // Add request metadata
  details.method = method;
  details.userAgent = req.get("User-Agent");
  details.ip = req.ip || req.connection.remoteAddress;

  return details;
};

/**
 * Middleware to automatically log activities
 * @param {Object} options - Configuration options
 * @returns {Function} - Express middleware function
 */
const logActivity = (options = {}) => {
  const {
    skipRoutes = ["/health", "/api-docs"],
    skipMethods = ["GET"],
    skipSuccessOnly = true,
  } = options;

  return async (req, res, next) => {
    // Skip if route should be ignored
    if (skipRoutes.some((route) => req.originalUrl.includes(route))) {
      return next();
    }

    // Skip if method should be ignored
    if (skipMethods.includes(req.method)) {
      return next();
    }

    // Skip if user is not authenticated
    if (!req.user || !req.user.id) {
      return next();
    }

    // Store original res.json to intercept response
    const originalJson = res.json;

    res.json = function (data) {
      // Only log if response is successful (or if skipSuccessOnly is false)
      if (!skipSuccessOnly || (res.statusCode >= 200 && res.statusCode < 300)) {
        // Extract activity information
        const { resourceType, resourceId } = extractResourceInfo(req);
        const action = determineAction(req);
        const details = extractDetails(req);

        // Log activity asynchronously
        setImmediate(async () => {
          try {
            await Activity.create({
              userId: req.user.id,
              resourceId: resourceId || null,
              resourceType: resourceType || null,
              action,
              details,
              metadata: {
                statusCode: res.statusCode,
                responseTime: Date.now() - req.startTime,
              },
            });
          } catch (error) {
            logger.error("Error logging activity:", error);
          }
        });
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    // Store request start time
    req.startTime = Date.now();

    next();
  };
};

/**
 * Middleware to log specific activity with custom details
 * @param {String} action - Action name
 * @param {Object} customDetails - Custom details to log
 * @returns {Function} - Express middleware function
 */
const logCustomActivity = (action, customDetails = {}) => {
  return async (req, res, next) => {
    if (req.user && req.user.id) {
      try {
        const { resourceType, resourceId } = extractResourceInfo(req);
        const details = { ...extractDetails(req), ...customDetails };

        await Activity.create({
          userId: req.user.id,
          resourceId: resourceId || null,
          resourceType: resourceType || null,
          action,
          details,
        });
      } catch (error) {
        logger.error("Error logging custom activity:", error);
      }
    }
    next();
  };
};

/**
 * Middleware to log authentication activities
 * @param {String} action - Auth action (login, logout, register, etc.)
 * @returns {Function} - Express middleware function
 */
const logAuthActivity = (action) => {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;

    res.json = function (data) {
      // Only log if response is successful
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            const userId = req.user?.id || data?.user?.id;
            if (userId) {
              await Activity.create({
                userId,
                action,
                details: {
                  method: req.method,
                  userAgent: req.get("User-Agent"),
                  ip: req.ip || req.connection.remoteAddress,
                },
              });
            }
          } catch (error) {
            logger.error("Error logging auth activity:", error);
          }
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  logActivity,
  logCustomActivity,
  logAuthActivity,
  extractResourceInfo,
  determineAction,
  extractDetails,
};
