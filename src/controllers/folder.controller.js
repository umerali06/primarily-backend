const Folder = require("../models/folder.model");
const Item = require("../models/item.model");
const Activity = require("../models/activity.model");
const notificationService = require("../services/notificationService");
const mongoose = require("mongoose");
const { CustomError } = require("../utils/customError");
const ApiResponse = require("../utils/apiResponse");
const logger = require("../config/logger");

/**
 * @desc    Create a new folder
 * @route   POST /api/folders
 * @access  Private
 */
exports.createFolder = async (req, res, next) => {
  try {
    const { name, description, tags, color, parentId } = req.body;
    const userId = req.user.id;

    // Check if folder with same name exists for this user
    const existingFolder = await Folder.findOne({
      name,
      userId,
      parentId: parentId || null,
    });

    if (existingFolder) {
      return next(new CustomError("Folder with this name already exists", 400));
    }

    // Create folder
    const folder = await Folder.create({
      name,
      description,
      tags: tags || [],
      color: color || "#16A34A",
      parentId: parentId || null,
      userId,
    });

    // Emit notification event
    notificationService.emitFolderEvent("created", {
      folder,
      userId,
    });

    return ApiResponse.success(res, "Folder created successfully", {
      folder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all folders for user
 * @route   GET /api/folders
 * @access  Private
 */
exports.getFolders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 50,
      search,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    // Build query
    const query = { userId };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const folders = await Folder.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("parentId", "name");

    // Get total count
    const total = await Folder.countDocuments(query);

    // Get item counts for each folder
    const foldersWithItemCounts = await Promise.all(
      folders.map(async (folder) => {
        const itemCount = await Item.countDocuments({ folderId: folder._id });
        return {
          ...folder.toObject(),
          itemCount,
        };
      })
    );

    return ApiResponse.success(res, "Folders retrieved successfully", {
      folders: foldersWithItemCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get folder hierarchy
 * @route   GET /api/folders/hierarchy
 * @access  Private
 */
exports.getFolderHierarchy = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get all folders for user
    const folders = await Folder.find({ userId }).sort({ name: 1 });

    // Build hierarchy
    const buildHierarchy = (parentId = null) => {
      return folders
        .filter((folder) => {
          if (parentId === null) {
            return !folder.parentId;
          }
          return (
            folder.parentId &&
            folder.parentId.toString() === parentId.toString()
          );
        })
        .map((folder) => ({
          ...folder.toObject(),
          children: buildHierarchy(folder._id),
        }));
    };

    const hierarchy = buildHierarchy();

    return ApiResponse.success(res, "Folder hierarchy retrieved successfully", {
      hierarchy,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get folder by ID
 * @route   GET /api/folders/:id
 * @access  Private
 */
exports.getFolderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const folder = await Folder.findOne({ _id: id, userId }).populate(
      "parentId",
      "name"
    );

    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Get item count
    const itemCount = await Item.countDocuments({ folderId: id });

    return ApiResponse.success(res, "Folder retrieved successfully", {
      folder: {
        ...folder.toObject(),
        itemCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update folder
 * @route   PUT /api/folders/:id
 * @access  Private
 */
exports.updateFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Find folder
    const folder = await Folder.findOne({ _id: id, userId });

    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Validate parentId if provided
    if (updates.parentId !== undefined) {
      // Handle null/empty parentId (root folder)
      if (
        updates.parentId === null ||
        updates.parentId === "" ||
        updates.parentId === "all"
      ) {
        updates.parentId = null;
      } else {
        // Validate parent folder exists and belongs to user
        const parentFolder = await Folder.findOne({
          _id: updates.parentId,
          userId,
        });

        if (!parentFolder) {
          return next(new CustomError("Parent folder not found", 404));
        }

        // Prevent circular reference - folder cannot be its own parent
        if (updates.parentId === id) {
          return next(new CustomError("Cannot move folder into itself", 400));
        }

        // Check if moving to a descendant folder (would create circular reference)
        const isDescendant = async (folderId, targetId) => {
          const targetFolder = await Folder.findOne({ _id: targetId, userId });
          if (!targetFolder) return false;

          if (
            targetFolder.parentId &&
            targetFolder.parentId.toString() === folderId
          ) {
            return true;
          }

          if (targetFolder.parentId) {
            return await isDescendant(
              folderId,
              targetFolder.parentId.toString()
            );
          }

          return false;
        };

        const wouldCreateCircular = await isDescendant(id, updates.parentId);
        if (wouldCreateCircular) {
          return next(
            new CustomError("Cannot move folder into its own descendant", 400)
          );
        }
      }
    }

    // Check if name change conflicts with existing folder in the same parent
    if (updates.name && updates.name !== folder.name) {
      const targetParentId =
        updates.parentId !== undefined ? updates.parentId : folder.parentId;

      const existingFolder = await Folder.findOne({
        name: updates.name,
        userId,
        parentId: targetParentId,
        _id: { $ne: id },
      });

      if (existingFolder) {
        return next(
          new CustomError(
            "A folder with this name already exists in the selected parent folder",
            400
          )
        );
      }
    }

    // Track changes for activity logging
    const changes = {};
    Object.keys(updates).forEach((key) => {
      if (JSON.stringify(folder[key]) !== JSON.stringify(updates[key])) {
        changes[key] = { from: folder[key], to: updates[key] };
      }
    });

    // Update folder
    const updatedFolder = await Folder.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate("parentId", "name");

    // Emit notification event if there were changes
    if (Object.keys(changes).length > 0) {
      notificationService.emitFolderEvent("updated", {
        folder: updatedFolder,
        userId,
        changes,
      });
    }

    return ApiResponse.success(res, "Folder updated successfully", {
      folder: updatedFolder,
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = {};
      Object.keys(error.errors).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });

      return next(new CustomError("Validation failed", 400, validationErrors));
    }

    next(error);
  }
};

/**
 * @desc    Clone folder
 * @route   POST /api/folders/:id/clone
 * @access  Private
 */
exports.cloneFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, includeItems = true } = req.body;

    // Find source folder
    const sourceFolder = await Folder.findOne({ _id: id, userId });

    if (!sourceFolder) {
      return next(new CustomError("Source folder not found", 404));
    }

    // Generate clone name if not provided
    const cloneName = name || `${sourceFolder.name} (Copy)`;

    // Check if folder with clone name already exists
    const existingFolder = await Folder.findOne({
      name: cloneName,
      userId,
      parentId: sourceFolder.parentId,
    });

    if (existingFolder) {
      return next(new CustomError("Folder with this name already exists", 400));
    }

    // Create cloned folder
    const clonedFolder = new Folder({
      name: cloneName,
      description: sourceFolder.description,
      parentId: sourceFolder.parentId,
      path: sourceFolder.path,
      level: sourceFolder.level,
      tags: [...sourceFolder.tags],
      color: sourceFolder.color,
      images: [...sourceFolder.images],
      notes: sourceFolder.notes,
      userId,
      customFields: new Map(sourceFolder.customFields),
    });

    await clonedFolder.save();

    // Clone items if requested
    if (includeItems) {
      const Item = require("../models/item.model");
      const sourceItems = await Item.find({ folderId: id, userId });

      if (sourceItems.length > 0) {
        const clonedItems = sourceItems.map((item) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          minLevel: item.minLevel,
          tags: [...item.tags],
          images: [...item.images],
          notes: item.notes,
          folderId: clonedFolder._id,
          userId,
          customFields: new Map(item.customFields),
        }));

        await Item.insertMany(clonedItems);
      }
    }

    // Log activity
    await Activity.create({
      userId,
      resourceId: clonedFolder._id,
      resourceType: "folder",
      action: "clone",
      details: {
        sourceId: id,
        sourceName: sourceFolder.name,
        includeItems,
      },
    });

    return ApiResponse.success(res, "Folder cloned successfully", {
      folder: clonedFolder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete folder
 * @route   DELETE /api/folders/:id
 * @access  Private
 */
exports.deleteFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find folder
    const folder = await Folder.findOne({ _id: id, userId });

    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Check if folder has subfolders
    const subfolders = await Folder.find({ parentId: id });
    if (subfolders.length > 0) {
      return next(
        new CustomError(
          "Cannot delete folder with subfolders. Please move or delete subfolders first.",
          400
        )
      );
    }

    // Check if folder has items
    const itemCount = await Item.countDocuments({ folderId: id });
    if (itemCount > 0) {
      return next(
        new CustomError(
          "Cannot delete folder with items. Please move or delete items first.",
          400
        )
      );
    }

    // Delete folder
    await Folder.findByIdAndDelete(id);

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "delete",
      details: { name: folder.name },
    });

    return ApiResponse.success(res, "Folder deleted successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Move folder
 * @route   PUT /api/folders/:id/move
 * @access  Private
 */
exports.moveFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { parentId } = req.body;
    const userId = req.user.id;

    // Find folder
    const folder = await Folder.findOne({ _id: id, userId });

    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Check if moving to a valid parent folder
    if (parentId) {
      const parentFolder = await Folder.findOne({ _id: parentId, userId });
      if (!parentFolder) {
        return next(new CustomError("Parent folder not found", 404));
      }

      // Prevent circular reference
      if (parentId === id) {
        return next(new CustomError("Cannot move folder to itself", 400));
      }

      // Check if target folder would create a circular reference
      const checkCircular = async (targetId, currentId) => {
        const target = await Folder.findById(targetId);
        if (!target) return false;
        if (
          target.parentId &&
          target.parentId.toString() === currentId.toString()
        ) {
          return true;
        }
        if (target.parentId) {
          return await checkCircular(target.parentId, currentId);
        }
        return false;
      };

      const isCircular = await checkCircular(parentId, id);
      if (isCircular) {
        return next(
          new CustomError(
            "Cannot move folder: would create circular reference",
            400
          )
        );
      }
    }

    // Update folder
    const updatedFolder = await Folder.findByIdAndUpdate(
      id,
      { parentId: parentId || null },
      { new: true }
    );

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "move",
      details: {
        name: folder.name,
        from: folder.parentId,
        to: parentId,
      },
    });

    return ApiResponse.success(res, "Folder moved successfully", {
      folder: updatedFolder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get items in folder
 * @route   GET /api/folders/:id/items
 * @access  Private
 */
exports.getFolderItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get items in folder
    const items = await Item.find({ folderId: id, userId })
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get total count
    const total = await Item.countDocuments({ folderId: id, userId });

    return ApiResponse.success(res, "Folder items retrieved successfully", {
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get folder activities
 * @route   GET /api/folders/:id/activities
 * @access  Private
 */
exports.getFolderActivities = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Get activities for this folder
    const activities = await Activity.find({
      resourceId: id,
      resourceType: "folder",
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("userId", "name email")
      .lean();

    // Get total count
    const total = await Activity.countDocuments({
      resourceId: id,
      resourceType: "folder",
    });

    return ApiResponse.success(
      res,
      "Folder activities retrieved successfully",
      {
        activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get folder permissions
 * @route   GET /api/folders/:id/permissions
 * @access  Private
 */
exports.getFolderPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // For now, return mock permissions data since we don't have a permissions model yet
    // In a real implementation, you would query a permissions table/collection
    const mockPermissions = [
      {
        id: "1",
        userId: userId,
        userEmail: req.user.email,
        userName: req.user.name,
        role: "owner",
        inherited: false,
        createdAt: folder.createdAt,
      },
    ];

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "view_permissions",
      details: { name: folder.name },
    });

    return ApiResponse.success(
      res,
      "Folder permissions retrieved successfully",
      {
        permissions: mockPermissions,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Set folder permissions
 * @route   PUT /api/folders/:id/permissions
 * @access  Private
 */
exports.setFolderPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Validate permissions array
    if (!Array.isArray(permissions)) {
      return next(new CustomError("Permissions must be an array", 400));
    }

    // Validate each permission
    for (const permission of permissions) {
      if (!permission.userEmail || !permission.role) {
        return next(
          new CustomError("Each permission must have userEmail and role", 400)
        );
      }

      if (!["owner", "editor", "viewer"].includes(permission.role)) {
        return next(
          new CustomError("Invalid role. Must be owner, editor, or viewer", 400)
        );
      }
    }

    // For now, we'll just simulate saving permissions
    // In a real implementation, you would save to a permissions table/collection
    const savedPermissions = permissions.map((permission, index) => ({
      id: permission.id || (Date.now() + index).toString(),
      userEmail: permission.userEmail,
      userName: permission.userName || null,
      role: permission.role,
      inherited: permission.inherited || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "update_permissions",
      details: {
        name: folder.name,
        permissionsCount: savedPermissions.length,
      },
    });

    return ApiResponse.success(res, "Folder permissions updated successfully", {
      permissions: savedPermissions,
    });
  } catch (error) {
    next(error);
  }
};
/**
 * @desc    Get folder alerts
 * @route   GET /api/folders/:id/alerts
 * @access  Private
 */
exports.getFolderAlerts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // For now, return mock alerts data since we don't have an alerts model yet
    // In a real implementation, you would query an alerts table/collection
    const mockAlerts = [
      {
        id: "1",
        name: "Low Stock Alert",
        type: "low_stock",
        condition: {
          field: "quantity",
          operator: "less_than",
          threshold: 5,
        },
        recipients: ["admin@example.com"],
        notificationMethods: ["email"],
        enabled: true,
        createdAt: new Date().toISOString(),
        lastTriggered: null,
      },
    ];

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "view_alerts",
      details: { name: folder.name },
    });

    return ApiResponse.success(res, "Folder alerts retrieved successfully", {
      alerts: mockAlerts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Set folder alert
 * @route   POST /api/folders/:id/alerts
 * @access  Private
 */
exports.setFolderAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, condition, recipients, notificationMethods, enabled } =
      req.body;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Validate required fields
    if (!name || !type) {
      return next(new CustomError("Alert name and type are required", 400));
    }

    // Validate alert type
    const validTypes = [
      "low_stock",
      "high_value",
      "item_added",
      "item_removed",
    ];
    if (!validTypes.includes(type)) {
      return next(new CustomError("Invalid alert type", 400));
    }

    // Validate recipients
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return next(new CustomError("At least one recipient is required", 400));
    }

    // Validate email format for recipients
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const recipient of recipients) {
      if (!emailRegex.test(recipient)) {
        return next(new CustomError(`Invalid email format: ${recipient}`, 400));
      }
    }

    // Validate notification methods
    if (
      !Array.isArray(notificationMethods) ||
      notificationMethods.length === 0
    ) {
      return next(
        new CustomError("At least one notification method is required", 400)
      );
    }

    const validMethods = ["email", "sms"];
    for (const method of notificationMethods) {
      if (!validMethods.includes(method)) {
        return next(
          new CustomError(`Invalid notification method: ${method}`, 400)
        );
      }
    }

    // Validate condition for threshold-based alerts
    if ((type === "low_stock" || type === "high_value") && condition) {
      if (
        !condition.field ||
        !condition.operator ||
        condition.threshold === undefined
      ) {
        return next(
          new CustomError(
            "Condition field, operator, and threshold are required for threshold-based alerts",
            400
          )
        );
      }

      const validFields = ["quantity", "value", "item_count"];
      const validOperators = [
        "less_than",
        "less_than_equal",
        "greater_than",
        "greater_than_equal",
        "equal",
      ];

      if (!validFields.includes(condition.field)) {
        return next(new CustomError("Invalid condition field", 400));
      }

      if (!validOperators.includes(condition.operator)) {
        return next(new CustomError("Invalid condition operator", 400));
      }

      if (typeof condition.threshold !== "number" || condition.threshold < 0) {
        return next(
          new CustomError("Threshold must be a non-negative number", 400)
        );
      }
    }

    // Create alert object (in a real implementation, save to database)
    const alert = {
      id: Date.now().toString(),
      name: name.trim(),
      type,
      condition: condition || null,
      recipients: recipients.filter((r) => r.trim()),
      notificationMethods,
      enabled: enabled !== false,
      folderId: id,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastTriggered: null,
    };

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "create_alert",
      details: {
        name: folder.name,
        alertName: alert.name,
        alertType: alert.type,
      },
    });

    return ApiResponse.success(res, "Folder alert created successfully", {
      alert,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update folder alert
 * @route   PUT /api/folders/:id/alerts/:alertId
 * @access  Private
 */
exports.updateFolderAlert = async (req, res, next) => {
  try {
    const { id, alertId } = req.params;
    const { name, type, condition, recipients, notificationMethods, enabled } =
      req.body;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // In a real implementation, you would find and update the alert in the database
    // For now, we'll simulate the update
    const updatedAlert = {
      id: alertId,
      name: name?.trim() || "Updated Alert",
      type: type || "low_stock",
      condition: condition || null,
      recipients: recipients?.filter((r) => r.trim()) || ["admin@example.com"],
      notificationMethods: notificationMethods || ["email"],
      enabled: enabled !== false,
      folderId: id,
      userId,
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updatedAt: new Date().toISOString(),
      lastTriggered: null,
    };

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "update_alert",
      details: {
        name: folder.name,
        alertId,
        alertName: updatedAlert.name,
      },
    });

    return ApiResponse.success(res, "Folder alert updated successfully", {
      alert: updatedAlert,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete folder alert
 * @route   DELETE /api/folders/:id/alerts/:alertId
 * @access  Private
 */
exports.deleteFolderAlert = async (req, res, next) => {
  try {
    const { id, alertId } = req.params;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // In a real implementation, you would find and delete the alert from the database
    // For now, we'll simulate the deletion

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "delete_alert",
      details: {
        name: folder.name,
        alertId,
      },
    });

    return ApiResponse.success(res, "Folder alert deleted successfully");
  } catch (error) {
    next(error);
  }
};
/**
 * @desc    Export folder
 * @route   POST /api/folders/:id/export
 * @access  Private
 */
exports.exportFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = "csv", options = {} } = req.body;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Validate export format
    const validFormats = ["csv", "excel", "pdf", "json"];
    if (!validFormats.includes(format)) {
      return next(new CustomError("Invalid export format", 400));
    }

    // Get folder items for export
    const Item = require("../models/item.model");
    const items = await Item.find({ folderId: id, userId });

    // Prepare export data
    const exportData = {
      folder: {
        name: folder.name,
        description: folder.description,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      },
      items: items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        minLevel: item.minLevel,
        tags: item.tags,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.email,
      format,
    };

    // Generate export content based on format
    let exportContent;
    let contentType;
    let filename;

    switch (format) {
      case "csv":
        exportContent = generateCSV(exportData);
        contentType = "text/csv";
        filename = `${folder.name.replace(/[^a-zA-Z0-9]/g, "_")}_export.csv`;
        break;
      case "json":
        exportContent = JSON.stringify(exportData, null, 2);
        contentType = "application/json";
        filename = `${folder.name.replace(/[^a-zA-Z0-9]/g, "_")}_export.json`;
        break;
      case "excel":
      case "pdf":
        // For now, fallback to JSON for these formats
        exportContent = JSON.stringify(exportData, null, 2);
        contentType = "application/json";
        filename = `${folder.name.replace(/[^a-zA-Z0-9]/g, "_")}_export.json`;
        break;
      default:
        exportContent = JSON.stringify(exportData, null, 2);
        contentType = "application/json";
        filename = `${folder.name.replace(/[^a-zA-Z0-9]/g, "_")}_export.json`;
    }

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "export",
      details: {
        name: folder.name,
        format,
        itemCount: items.length,
      },
    });

    // Set response headers for file download
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", Buffer.byteLength(exportContent));

    return res.send(exportContent);
  } catch (error) {
    next(error);
  }
};

// Helper function to generate CSV content
function generateCSV(data) {
  const headers = [
    "Name",
    "Description",
    "Quantity",
    "Unit",
    "Price",
    "Min Level",
    "Tags",
    "Created At",
  ];
  const csvRows = [headers.join(",")];

  data.items.forEach((item) => {
    const row = [
      `"${item.name || ""}"`,
      `"${item.description || ""}"`,
      item.quantity || 0,
      `"${item.unit || ""}"`,
      item.price || 0,
      item.minLevel || 0,
      `"${(item.tags || []).join("; ")}"`,
      `"${item.createdAt || ""}"`,
    ];
    csvRows.push(row.join(","));
  });

  return csvRows.join("\n");
}

/**
 * @desc    Get folder labels
 * @route   GET /api/folders/:id/labels
 * @access  Private
 */
exports.getFolderLabels = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // For now, return mock labels data since we don't have a labels model yet
    // In a real implementation, you would query a labels table/collection
    const mockLabels = [
      {
        id: "1",
        name: "Important",
        color: "#EF4444",
        icon: "star",
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Archive",
        color: "#6B7280",
        icon: "bookmark",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "view_labels",
      details: { name: folder.name },
    });

    return ApiResponse.success(res, "Folder labels retrieved successfully", {
      labels: mockLabels,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create folder label
 * @route   POST /api/folders/:id/labels
 * @access  Private
 */
exports.createFolderLabel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // Validate required fields
    if (!name) {
      return next(new CustomError("Label name is required", 400));
    }

    // Validate name length
    if (name.length > 50) {
      return next(
        new CustomError("Label name cannot be more than 50 characters", 400)
      );
    }

    // Validate color format (hex color)
    if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
      return next(
        new CustomError(
          "Invalid color format. Use hex format like #FF0000",
          400
        )
      );
    }

    // Validate icon
    const validIcons = [
      "tag",
      "star",
      "heart",
      "flag",
      "bookmark",
      "diamond",
      "fire",
      "lightning",
      "crown",
      "trophy",
    ];
    if (icon && !validIcons.includes(icon)) {
      return next(new CustomError("Invalid icon", 400));
    }

    // Create label object (in a real implementation, save to database)
    const label = {
      id: Date.now().toString(),
      name: name.trim(),
      color: color || "#3B82F6",
      icon: icon || "",
      folderId: id,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "create_label",
      details: {
        name: folder.name,
        labelName: label.name,
        labelColor: label.color,
      },
    });

    return ApiResponse.success(res, "Folder label created successfully", {
      label,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update folder label
 * @route   PUT /api/folders/:id/labels/:labelId
 * @access  Private
 */
exports.updateFolderLabel = async (req, res, next) => {
  try {
    const { id, labelId } = req.params;
    const { name, color, icon } = req.body;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // In a real implementation, you would find and update the label in the database
    // For now, we'll simulate the update
    const updatedLabel = {
      id: labelId,
      name: name?.trim() || "Updated Label",
      color: color || "#3B82F6",
      icon: icon || "",
      folderId: id,
      userId,
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updatedAt: new Date().toISOString(),
    };

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "update_label",
      details: {
        name: folder.name,
        labelId,
        labelName: updatedLabel.name,
      },
    });

    return ApiResponse.success(res, "Folder label updated successfully", {
      label: updatedLabel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete folder label
 * @route   DELETE /api/folders/:id/labels/:labelId
 * @access  Private
 */
exports.deleteFolderLabel = async (req, res, next) => {
  try {
    const { id, labelId } = req.params;
    const userId = req.user.id;

    // Verify folder exists and user has access
    const folder = await Folder.findOne({ _id: id, userId });
    if (!folder) {
      return next(new CustomError("Folder not found", 404));
    }

    // In a real implementation, you would find and delete the label from the database
    // For now, we'll simulate the deletion

    // Log activity
    await Activity.create({
      userId,
      resourceId: folder._id,
      resourceType: "folder",
      action: "delete_label",
      details: {
        name: folder.name,
        labelId,
      },
    });

    return ApiResponse.success(res, "Folder label deleted successfully");
  } catch (error) {
    next(error);
  }
};
