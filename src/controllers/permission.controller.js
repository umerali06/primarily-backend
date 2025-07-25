// const Permission = require("../models/permission.model");
const User = require("../models/user.model");
const Item = require("../models/item.model");
const Folder = require("../models/folder.model");
const Activity = require("../models/activity.model");
const { CustomError } = require("../utils/customError");
const ApiResponse = require("../utils/apiResponse");
const logger = require("../config/logger");

/**
 * @desc    Get permissions for a resource
 * @route   GET /api/permissions/:resourceType/:resourceId
 * @access  Private (requires admin permission or ownership)
 */
exports.getResourcePermissions = async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.params;

    // Validate resource type
    if (!["item", "folder"].includes(resourceType.toLowerCase())) {
      return next(new CustomError("Invalid resource type", 400));
    }

    const capitalizedType =
      resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

    // Get permissions for the resource
    // const permissions = await Permission.getResourcePermissions(
    //   resourceId,
    //   capitalizedType
    // );

    // For now, return empty permissions
    const permissions = [];

    return ApiResponse.success(
      res,
      permissions,
      `Permissions retrieved for ${resourceType}`
    );
  } catch (error) {
    logger.error(`Get resource permissions error: ${error.message}`);
    next(new CustomError("Error retrieving permissions", 500));
  }
};

/**
 * @desc    Get user's permissions
 * @route   GET /api/permissions/user
 * @access  Private
 */
exports.getUserPermissions = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // const permissions = await Permission.getUserPermissions(userId);

    // For now, return empty permissions
    const permissions = [];

    return ApiResponse.success(
      res,
      permissions,
      "User permissions retrieved successfully"
    );
  } catch (error) {
    logger.error(`Get user permissions error: ${error.message}`);
    next(new CustomError("Error retrieving user permissions", 500));
  }
};

/**
 * @desc    Grant permission to a user
 * @route   POST /api/permissions
 * @access  Private (requires admin permission or ownership)
 */
exports.grantPermission = async (req, res, next) => {
  try {
    const { resourceId, resourceType, userEmail, accessLevel, expiresAt } =
      req.body;

    // Validate required fields
    if (!resourceId || !resourceType || !userEmail || !accessLevel) {
      return next(
        new CustomError(
          "Resource ID, resource type, user email, and access level are required",
          400
        )
      );
    }

    // Validate resource type
    if (!["item", "folder"].includes(resourceType.toLowerCase())) {
      return next(new CustomError("Invalid resource type", 400));
    }

    // Validate access level
    if (!["view", "edit", "admin"].includes(accessLevel)) {
      return next(new CustomError("Invalid access level", 400));
    }

    const capitalizedType =
      resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

    // Find the user to grant permission to
    const targetUser = await User.findOne({ email: userEmail });
    if (!targetUser) {
      return next(new CustomError("User not found", 404));
    }

    // Check if resource exists
    let resource;
    if (resourceType.toLowerCase() === "item") {
      resource = await Item.findById(resourceId);
    } else {
      resource = await Folder.findById(resourceId);
    }

    if (!resource) {
      return next(new CustomError(`${capitalizedType} not found`, 404));
    }

    // Grant the permission
    const permission = await Permission.grantPermission(
      resourceId,
      capitalizedType,
      targetUser._id,
      accessLevel,
      req.user.id,
      expiresAt ? new Date(expiresAt) : null
    );

    // Log the activity
    await Activity.logUserActivity(
      req.user.id,
      targetUser._id,
      "grant_permission",
      {
        resourceId,
        resourceType: capitalizedType,
        accessLevel,
        expiresAt,
      }
    );

    return ApiResponse.success(
      res,
      permission,
      "Permission granted successfully",
      201
    );
  } catch (error) {
    logger.error(`Grant permission error: ${error.message}`);
    next(new CustomError("Error granting permission", 500));
  }
};

/**
 * @desc    Update permission
 * @route   PUT /api/permissions/:id
 * @access  Private (requires admin permission or ownership)
 */
exports.updatePermission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { accessLevel, expiresAt } = req.body;

    // Find the permission
    const permission = await Permission.findById(id);
    if (!permission) {
      return next(new CustomError("Permission not found", 404));
    }

    // Validate access level if provided
    if (accessLevel && !["view", "edit", "admin"].includes(accessLevel)) {
      return next(new CustomError("Invalid access level", 400));
    }

    // Update permission
    if (accessLevel) {
      permission.accessLevel = accessLevel;
    }
    if (expiresAt !== undefined) {
      permission.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    await permission.save();

    // Log the activity
    await Activity.logUserActivity(
      req.user.id,
      permission.userId,
      "update_permission",
      {
        permissionId: id,
        resourceId: permission.resourceId,
        resourceType: permission.resourceType,
        accessLevel: permission.accessLevel,
        expiresAt: permission.expiresAt,
      }
    );

    return ApiResponse.success(
      res,
      permission,
      "Permission updated successfully"
    );
  } catch (error) {
    logger.error(`Update permission error: ${error.message}`);
    next(new CustomError("Error updating permission", 500));
  }
};

/**
 * @desc    Revoke permission
 * @route   DELETE /api/permissions/:id
 * @access  Private (requires admin permission or ownership)
 */
exports.revokePermission = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the permission first to get details for logging
    const permission = await Permission.findById(id);
    if (!permission) {
      return next(new CustomError("Permission not found", 404));
    }

    // Delete the permission
    await Permission.findByIdAndDelete(id);

    // Log the activity
    await Activity.logUserActivity(
      req.user.id,
      permission.userId,
      "revoke_permission",
      {
        permissionId: id,
        resourceId: permission.resourceId,
        resourceType: permission.resourceType,
        accessLevel: permission.accessLevel,
      }
    );

    return ApiResponse.success(res, null, "Permission revoked successfully");
  } catch (error) {
    logger.error(`Revoke permission error: ${error.message}`);
    next(new CustomError("Error revoking permission", 500));
  }
};

/**
 * @desc    Revoke permission by resource and user
 * @route   DELETE /api/permissions/:resourceType/:resourceId/user/:userEmail
 * @access  Private (requires admin permission or ownership)
 */
exports.revokeUserPermission = async (req, res, next) => {
  try {
    const { resourceType, resourceId, userEmail } = req.params;

    // Validate resource type
    if (!["item", "folder"].includes(resourceType.toLowerCase())) {
      return next(new CustomError("Invalid resource type", 400));
    }

    const capitalizedType =
      resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

    // Find the user
    const targetUser = await User.findOne({ email: userEmail });
    if (!targetUser) {
      return next(new CustomError("User not found", 404));
    }

    // Revoke the permission
    const revoked = await Permission.revokePermission(
      resourceId,
      capitalizedType,
      targetUser._id
    );

    if (!revoked) {
      return next(new CustomError("Permission not found", 404));
    }

    // Log the activity
    await Activity.logUserActivity(
      req.user.id,
      targetUser._id,
      "revoke_permission",
      {
        resourceId,
        resourceType: capitalizedType,
      }
    );

    return ApiResponse.success(res, null, "Permission revoked successfully");
  } catch (error) {
    logger.error(`Revoke user permission error: ${error.message}`);
    next(new CustomError("Error revoking permission", 500));
  }
};

/**
 * @desc    Check if user has permission for a resource
 * @route   GET /api/permissions/check/:resourceType/:resourceId
 * @access  Private
 */
exports.checkPermission = async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { accessLevel = "view" } = req.query;
    const userId = req.user.id;

    // Validate resource type
    if (!["item", "folder"].includes(resourceType.toLowerCase())) {
      return next(new CustomError("Invalid resource type", 400));
    }

    // Validate access level
    if (!["view", "edit", "admin"].includes(accessLevel)) {
      return next(new CustomError("Invalid access level", 400));
    }

    const capitalizedType =
      resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

    // Check ownership first
    let resource;
    if (resourceType.toLowerCase() === "item") {
      resource = await Item.findById(resourceId);
    } else {
      resource = await Folder.findById(resourceId);
    }

    if (!resource) {
      return next(new CustomError(`${capitalizedType} not found`, 404));
    }

    const isOwner = resource.userId.toString() === userId;

    if (isOwner) {
      return ApiResponse.success(
        res,
        { hasPermission: true, reason: "owner" },
        "Permission check completed"
      );
    }

    // Check explicit permissions
    // const hasPermission = await Permission.hasPermission(
    //   userId,
    //   resourceId,
    //   capitalizedType,
    //   accessLevel
    // );

    // For now, only allow owners
    const hasPermission = false;

    return ApiResponse.success(
      res,
      {
        hasPermission,
        reason: hasPermission ? "explicit_permission" : "no_permission",
      },
      "Permission check completed"
    );
  } catch (error) {
    logger.error(`Check permission error: ${error.message}`);
    next(new CustomError("Error checking permission", 500));
  }
};
