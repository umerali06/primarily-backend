const Activity = require("../models/activity.model");
const ApiResponse = require("../utils/apiResponse");
const mongoose = require("mongoose");

/**
 * @desc    Get activity history for the current user
 * @route   GET /api/activities
 * @access  Private
 */
exports.getActivities = async (req, res, next) => {
  try {
    // Build query
    const query = { userId: req.user.id };

    // Filter by resource type
    if (req.query.resourceType) {
      query.resourceType = req.query.resourceType;
    }

    // Filter by resource ID
    if (req.query.resourceId) {
      query.resourceId = req.query.resourceId;
    }

    // Filter by action
    if (req.query.action) {
      query.action = req.query.action;
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    } else if (req.query.startDate) {
      query.createdAt = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      query.createdAt = { $lte: new Date(req.query.endDate) };
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    // Execute query
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate("userId", "name");

    // Get total count
    const total = await Activity.countDocuments(query);

    return ApiResponse.success(res, "Activities retrieved successfully", {
      activities,
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
 * @desc    Get activity history for a specific item
 * @route   GET /api/activities/items/:itemId
 * @access  Private
 */
exports.getItemActivities = async (req, res, next) => {
  try {
    // Build query
    const query = {
      userId: req.user.id,
      resourceId: req.params.itemId,
      resourceType: "item",
    };

    // Filter by action
    if (req.query.action) {
      query.action = req.query.action;
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    } else if (req.query.startDate) {
      query.createdAt = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      query.createdAt = { $lte: new Date(req.query.endDate) };
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    // Execute query
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate("userId", "name");

    // Get total count
    const total = await Activity.countDocuments(query);

    return ApiResponse.success(res, "Item activities retrieved successfully", {
      activities,
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
 * @desc    Get activity history for a specific folder
 * @route   GET /api/activities/folders/:folderId
 * @access  Private
 */
exports.getFolderActivities = async (req, res, next) => {
  try {
    // Build query
    const query = {
      userId: req.user.id,
      resourceId: req.params.folderId,
      resourceType: "folder",
    };

    // Filter by action
    if (req.query.action) {
      query.action = req.query.action;
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    } else if (req.query.startDate) {
      query.createdAt = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      query.createdAt = { $lte: new Date(req.query.endDate) };
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    // Execute query
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate("userId", "name");

    // Get total count
    const total = await Activity.countDocuments(query);

    return ApiResponse.success(
      res,
      "Folder activities retrieved successfully",
      {
        activities,
        pagination: {
          page,
          limit,
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
 * @desc    Get activity summary
 * @route   GET /api/activities/summary
 * @access  Private
 */
exports.getActivitySummary = async (req, res, next) => {
  try {
    // Default to last 30 days if no date range provided
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date();
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get activity counts by type
    const activityCounts = await Activity.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(req.user.id),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            resourceType: "$resourceType",
            action: "$action",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.resourceType",
          actions: {
            $push: {
              action: "$_id.action",
              count: "$count",
            },
          },
          totalCount: { $sum: "$count" },
        },
      },
    ]);

    // Get daily activity counts
    const dailyActivity = await Activity.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(req.user.id),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    // Format the results
    const summary = {
      totalActivities: 0,
      byType: {},
      dailyActivity: {},
    };

    // Process activity counts
    activityCounts.forEach((item) => {
      summary.byType[item._id] = {
        total: item.totalCount,
        actions: {},
      };

      item.actions.forEach((action) => {
        summary.byType[item._id].actions[action.action] = action.count;
      });

      summary.totalActivities += item.totalCount;
    });

    // Process daily activity
    dailyActivity.forEach((item) => {
      summary.dailyActivity[item._id.date] = item.count;
    });

    return ApiResponse.success(
      res,
      "Activity summary retrieved successfully",
      summary
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a custom activity log
 * @route   POST /api/activities
 * @access  Private
 */
exports.createActivity = async (req, res, next) => {
  try {
    const { resourceId, resourceType, action, details } = req.body;

    // Create activity
    const activity = await Activity.create({
      userId: req.user.id,
      resourceId,
      resourceType,
      action: action || "custom",
      details: details || {},
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    return ApiResponse.created(res, "Activity logged successfully", {
      activity,
    });
  } catch (error) {
    next(error);
  }
};
