const User = require("../models/user.model");
// const Permission = require("../models/permission.model");
const Activity = require("../models/activity.model");
const mongoose = require("mongoose");
const { CustomError } = require("../utils/customError");
const ApiResponse = require("../utils/apiResponse");
const logger = require("../config/logger");

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Private (Admin only)
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = "", status } = req.query;

    // Build query
    const query = {};

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get users
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await User.countDocuments(query);

    return ApiResponse.success(res, "Users retrieved successfully", {
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user details
 * @route   GET /api/admin/users/:id
 * @access  Private (Admin only)
 */
exports.getUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get user
    const user = await User.findById(id).select("-password");
    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    // Get user's permissions
    // const permissions = await Permission.find({
    //   userId: id,
    //   isActive: true,
    // }).populate("resourceId", "name");

    // For now, return empty permissions
    const permissions = [];

    // Get user's activities
    const activities = await Activity.find({
      userId: id,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return ApiResponse.success(res, "User details retrieved successfully", {
      user,
      permissions,
      activities,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user status
 * @route   PUT /api/admin/users/:id/status
 * @access  Private (Admin only)
 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["active", "inactive"].includes(status)) {
      return next(new BadRequestError("Invalid status"));
    }

    // Get user
    const user = await User.findById(id);
    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    // Don't allow deactivating self
    if (user._id.toString() === req.user.id) {
      return next(new BadRequestError("Cannot update your own status"));
    }

    // Update status
    user.status = status;
    await user.save();

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: user._id,
      resourceType: "User",
      action: "update_user_status",
      details: {
        status,
      },
    });

    return ApiResponse.success(res, "User status updated successfully", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset user password
 * @route   POST /api/admin/users/:id/reset-password
 * @access  Private (Admin only)
 */
exports.resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get user
    const user = await User.findById(id);
    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/auth/reset-password/${resetToken}`;

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: user._id,
      resourceType: "User",
      action: "reset_user_password",
      details: {},
    });

    return ApiResponse.success(res, "Password reset link generated", {
      resetUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get system metrics
 * @route   GET /api/admin/metrics
 * @access  Private (Admin only)
 */
exports.getSystemMetrics = async (req, res, next) => {
  try {
    // Get counts
    const userCount = await User.countDocuments();
    const itemCount = await mongoose.model("Item").countDocuments();
    const folderCount = await mongoose.model("Folder").countDocuments();
    const alertCount = await mongoose.model("Alert").countDocuments();
    const activityCount = await Activity.countDocuments();

    // Get recent activities
    const recentActivities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email");

    // Get active users (users with activity in the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUsers = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
          lastActivity: { $max: "$createdAt" },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Get user IDs
    const userIds = activeUsers.map((user) => user._id);

    // Get user details
    const userDetails = await User.find({
      _id: { $in: userIds },
    }).select("name email");

    // Map user details to active users
    const activeUsersWithDetails = activeUsers.map((user) => {
      const userDetail = userDetails.find(
        (detail) => detail._id.toString() === user._id.toString()
      );
      return {
        id: user._id,
        name: userDetail?.name || "Unknown",
        email: userDetail?.email || "Unknown",
        activityCount: user.count,
        lastActivity: user.lastActivity,
      };
    });

    return ApiResponse.success(res, "System metrics retrieved successfully", {
      counts: {
        users: userCount,
        items: itemCount,
        folders: folderCount,
        alerts: alertCount,
        activities: activityCount,
      },
      activeUsers: activeUsersWithDetails,
      recentActivities,
    });
  } catch (error) {
    next(error);
  }
};
