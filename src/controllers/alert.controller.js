const mongoose = require("mongoose");
const Alert = require("../models/alert.model");
const Item = require("../models/item.model");
const Activity = require("../models/activity.model");
const ApiResponse = require("../utils/apiResponse");
const { NotFoundError, BadRequestError } = require("../utils/customError");

/**
 * @desc    Get all alerts for the current user
 * @route   GET /api/alerts
 * @access  Private
 */
exports.getAlerts = async (req, res, next) => {
  try {
    // Build query
    const query = { userId: req.user.id };

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Filter by item
    if (req.query.itemId) {
      query.itemId = req.query.itemId;
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    // Execute query
    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate("itemId", "name images");

    // Get total count
    const total = await Alert.countDocuments(query);

    return ApiResponse.success(res, "Alerts retrieved successfully", {
      alerts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get alert by ID
 * @route   GET /api/alerts/:id
 * @access  Private
 */
exports.getAlertById = async (req, res, next) => {
  try {
    const alert = await Alert.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate("itemId", "name images folderId");

    if (!alert) {
      return next(new NotFoundError("Alert not found"));
    }

    return ApiResponse.success(res, "Alert retrieved successfully", { alert });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a custom alert
 * @route   POST /api/alerts
 * @access  Private
 */
exports.createAlert = async (req, res, next) => {
  try {
    const { itemId, type, threshold, message } = req.body;

    // Check if item exists and belongs to user
    const item = await Item.findOne({
      _id: itemId,
      userId: req.user.id,
    });

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Create alert
    const alert = await Alert.create({
      itemId,
      userId: req.user.id,
      type: type || "custom",
      threshold: threshold || 0,
      currentValue: item.quantity,
      message: message || `Custom alert for ${item.name}`,
    });

    // Log activity
    await Activity.logAlertActivity(req.user.id, alert._id, "create", {
      itemId: item._id,
      itemName: item.name,
    });

    return ApiResponse.created(res, "Alert created successfully", { alert });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update alert status (mark as read or resolved)
 * @route   PUT /api/alerts/:id/status
 * @access  Private
 */
exports.updateAlertStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !["read", "resolved"].includes(status)) {
      return next(
        new BadRequestError('Invalid status. Must be "read" or "resolved"')
      );
    }

    // Find alert
    const alert = await Alert.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!alert) {
      return next(new NotFoundError("Alert not found"));
    }

    // Update status
    if (status === "read") {
      await alert.markAsRead();
    } else if (status === "resolved") {
      await alert.resolve();
    }

    // Log activity
    await Activity.logAlertActivity(req.user.id, alert._id, "status_change", {
      oldStatus: alert.status,
      newStatus: status,
    });

    return ApiResponse.success(res, `Alert marked as ${status}`, { alert });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete alert
 * @route   DELETE /api/alerts/:id
 * @access  Private
 */
exports.deleteAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!alert) {
      return next(new NotFoundError("Alert not found"));
    }

    await alert.deleteOne();

    // Log activity
    await Activity.logAlertActivity(req.user.id, alert._id, "delete", {
      itemId: alert.itemId,
    });

    return ApiResponse.success(res, "Alert deleted successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all alerts as read
 * @route   PUT /api/alerts/mark-all-read
 * @access  Private
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    const result = await Alert.updateMany(
      { userId: req.user.id, status: "active" },
      { status: "read", readAt: Date.now() }
    );

    // Log activity
    await Activity.logUserActivity(req.user.id, req.user.id, "custom", {
      action: "mark_all_alerts_read",
      count: result.modifiedCount,
    });

    return ApiResponse.success(res, "All alerts marked as read", {
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get alert count by status
 * @route   GET /api/alerts/count
 * @access  Private
 */
exports.getAlertCount = async (req, res, next) => {
  try {
    const counts = await Alert.aggregate([
      { $match: { userId: new mongoose.mongo.ObjectId(req.user.id) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Format counts
    const result = {
      active: 0,
      read: 0,
      resolved: 0,
      total: 0,
    };

    counts.forEach((item) => {
      result[item._id] = item.count;
      result.total += item.count;
    });

    return ApiResponse.success(
      res,
      "Alert counts retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};
