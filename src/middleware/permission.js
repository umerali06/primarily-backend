const Item = require("../models/item.model");
const Folder = require("../models/folder.model");
const { CustomError } = require("../utils/customError");
const logger = require("../config/logger");

/**
 * Middleware to check if user has permission to access a resource
 * @param {String} resourceType - Type of resource (item, folder)
 * @param {String} accessLevel - Required access level (view, edit, admin)
 * @param {String} resourceIdParam - Parameter name for resource ID (default: 'id')
 * @returns {Function} - Express middleware function
 */
const checkPermission = (
  resourceType,
  accessLevel = "view",
  resourceIdParam = "id"
) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;
      const resourceId = req.params[resourceIdParam];

      console.log("🔍 Permission check debug:");
      console.log("  - User ID:", userId);
      console.log("  - Resource ID:", resourceId);
      console.log("  - Resource Type:", resourceType);
      console.log("  - Access Level:", accessLevel);
      console.log("  - req.user:", req.user);

      if (!resourceId) {
        const error = new Error("Resource ID is required");
        error.statusCode = 400;
        return next(error);
      }

      if (!userId) {
        const error = new Error("User ID is required");
        error.statusCode = 401;
        return next(error);
      }

      // First check if user owns the resource
      const isOwner = await checkResourceOwnership(
        userId,
        resourceId,
        resourceType
      );
      console.log("  - Is owner?", isOwner);

      if (isOwner) {
        console.log("  ✅ User is owner, allowing access");
        return next(); // Owner has all permissions
      }

      // For now, skip explicit permission checks and just allow owners
      // TODO: Implement explicit permission system later
      console.log("  ❌ User is not owner, denying access");
      const error = new Error(
        "Insufficient permissions to access this resource"
      );
      error.statusCode = 403;
      return next(error);
    } catch (error) {
      logger.error(`Permission check error: ${error.message}`);
      // Use a standard Error instead of CustomError to prevent crashes
      const permissionError = new Error("Error checking permissions");
      permissionError.statusCode = 500;
      next(permissionError);
    }
  };
};

/**
 * Check if user owns a resource
 * @param {String} userId - User ID
 * @param {String} resourceId - Resource ID
 * @param {String} resourceType - Resource type (item, folder)
 * @returns {Boolean} - Whether user owns the resource
 */
const checkResourceOwnership = async (userId, resourceId, resourceType) => {
  try {
    let resource;

    // Validate ObjectId format
    if (
      !resourceId ||
      typeof resourceId !== "string" ||
      resourceId.length !== 24
    ) {
      console.log("  ❌ Invalid resource ID format:", resourceId);
      return false;
    }

    if (resourceType === "item") {
      resource = await Item.findById(resourceId);
    } else if (resourceType === "folder") {
      resource = await Folder.findById(resourceId);
    }

    console.log("  🔍 Resource ownership check:");
    console.log("    - Resource:", resource);
    console.log("    - Resource userId:", resource?.userId);
    console.log("    - Request userId:", userId);
    console.log(
      "    - Comparison:",
      resource && resource.userId.toString() === userId.toString()
    );

    return resource && resource.userId.toString() === userId.toString();
  } catch (error) {
    logger.error(`Error checking resource ownership: ${error.message}`);
    console.log("  ❌ Error checking resource ownership:", error.message);
    return false;
  }
};

/**
 * Middleware to check item permissions
 */
const checkItemPermission = (accessLevel = "view") => {
  return checkPermission("item", accessLevel);
};

/**
 * Middleware to check folder permissions
 */
const checkFolderPermission = (accessLevel = "view") => {
  return checkPermission("folder", accessLevel);
};

/**
 * Middleware to check if user can manage permissions for a resource
 * Only resource owners and users with admin access can manage permissions
 */
const checkPermissionManagement = (
  resourceType,
  resourceIdParam = "resourceId"
) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const resourceId = req.params[resourceIdParam] || req.body.resourceId;

      if (!resourceId) {
        const error = new Error("Resource ID is required");
        error.statusCode = 400;
        return next(error);
      }

      // Check if user owns the resource
      const isOwner = await checkResourceOwnership(
        userId,
        resourceId,
        resourceType
      );
      if (isOwner) {
        return next();
      }

      // Check if user has admin permission
      // const hasAdminPermission = await Permission.hasPermission(
      //   userId,
      //   resourceId,
      //   resourceType.charAt(0).toUpperCase() + resourceType.slice(1),
      //   "admin"
      // );

      // if (!hasAdminPermission) {
      const error = new Error(
        "Insufficient permissions to manage access for this resource"
      );
      error.statusCode = 403;
      return next(error);
      // }

      next();
    } catch (error) {
      logger.error(`Permission management check error: ${error.message}`);
      const permissionError = new Error(
        "Error checking permission management rights"
      );
      permissionError.statusCode = 500;
      next(permissionError);
    }
  };
};

/**
 * Helper function to filter resources based on user permissions
 * @param {String} userId - User ID
 * @param {Array} resources - Array of resources to filter
 * @param {String} resourceType - Type of resources
 * @param {String} accessLevel - Required access level
 * @returns {Array} - Filtered resources
 */
const filterResourcesByPermission = async (
  userId,
  resources,
  resourceType,
  accessLevel = "view"
) => {
  const filteredResources = [];

  for (const resource of resources) {
    // Check ownership first
    const isOwner = resource.userId.toString() === userId;
    if (isOwner) {
      filteredResources.push(resource);
      continue;
    }

    // Check explicit permissions
    // const hasPermission = await Permission.hasPermission(
    //   userId,
    //   resource._id,
    //   resourceType.charAt(0).toUpperCase() + resourceType.slice(1),
    //   accessLevel
    // );

    // if (hasPermission) {
    filteredResources.push(resource);
    // }
  }

  return filteredResources;
};

/**
 * Middleware for bulk operations that don't require individual resource ID checks
 * This middleware ensures the user is authenticated and has the required role/permissions
 * for bulk operations, but doesn't check individual resource ownership (handled in controller)
 */
const checkBulkPermission = (resourceType, accessLevel = "admin") => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id;

      console.log("🔍 Bulk permission check debug:");
      console.log("  - User ID:", userId);
      console.log("  - Resource Type:", resourceType);
      console.log("  - Access Level:", accessLevel);
      console.log("  - req.user:", req.user);

      if (!userId) {
        const error = new Error("User ID is required");
        error.statusCode = 401;
        return next(error);
      }

      // For bulk operations, we just ensure the user is authenticated
      // Individual resource ownership is checked in the controller
      console.log("  ✅ User authenticated for bulk operation");
      return next();
    } catch (error) {
      logger.error(`Bulk permission check error: ${error.message}`);
      const permissionError = new Error("Error checking bulk permissions");
      permissionError.statusCode = 500;
      next(permissionError);
    }
  };
};

/**
 * Helper function to get accessible resource IDs for a user
 * @param {String} userId - User ID
 * @param {String} resourceType - Type of resources
 * @param {String} accessLevel - Required access level
 * @returns {Array} - Array of accessible resource IDs
 */
const getAccessibleResourceIds = async (
  userId,
  resourceType,
  accessLevel = "view"
) => {
  try {
    // Get resources owned by user
    let ownedResources;
    if (resourceType === "item") {
      ownedResources = await Item.find({ userId }).select("_id");
    } else if (resourceType === "folder") {
      ownedResources = await Folder.find({ userId }).select("_id");
    }

    const ownedIds = ownedResources.map((r) => r._id.toString());

    // Get resources with explicit permissions
    // const permissions = await Permission.find({
    //   userId,
    //   resourceType:
    //     resourceType.charAt(0).toUpperCase() + resourceType.slice(1),
    //   $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    // });

    // const accessLevels = {
    //   view: 1,
    //   edit: 2,
    //   admin: 3,
    // };

    // const permittedIds = permissions
    //   .filter((p) => accessLevels[p.accessLevel] >= accessLevels[accessLevel])
    //   .map((p) => p.resourceId.toString());

    // Combine and deduplicate
    return [...new Set([...ownedIds])];
  } catch (error) {
    logger.error(`Error getting accessible resource IDs: ${error.message}`);
    return [];
  }
};

/**
 * Middleware to add accessible resource IDs to request
 * Useful for filtering queries based on permissions
 */
const addAccessibleResources = (resourceType, accessLevel = "view") => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const accessibleIds = await getAccessibleResourceIds(
        userId,
        resourceType,
        accessLevel
      );
      req.accessibleResourceIds = accessibleIds;
      next();
    } catch (error) {
      logger.error(`Error adding accessible resources: ${error.message}`);
      next(new CustomError("Error determining accessible resources", 500));
    }
  };
};

module.exports = {
  checkPermission,
  checkItemPermission,
  checkFolderPermission,
  checkBulkPermission,
  checkPermissionManagement,
  checkResourceOwnership,
  filterResourcesByPermission,
  getAccessibleResourceIds,
  addAccessibleResources,
};
