const User = require("../models/user.model");
const Activity = require("../models/activity.model");
const ApiResponse = require("../utils/apiResponse");
const {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} = require("../utils/customError");

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res, next) => {
  try {
    // Implement pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    // Get users
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    // Get total count
    const total = await User.countDocuments();

    return ApiResponse.success(res, "Users retrieved successfully", {
      users,
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
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    return ApiResponse.success(res, "User retrieved successfully", { user });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, status } = req.body;

    // Find user
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    // Check if email is already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return next(new BadRequestError("Email already in use"));
      }
    }

    // Update user
    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    user.status = status || user.status;

    const updatedUser = await user.save();

    return ApiResponse.success(res, "User updated successfully", {
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    // Prevent deleting self
    if (user._id.toString() === req.user.id) {
      return next(new ForbiddenError("Cannot delete your own account"));
    }

    await user.deleteOne();

    return ApiResponse.success(res, "User deleted successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get own profile
 * @route   GET /api/users/profile
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    return ApiResponse.success(res, "Profile retrieved successfully", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update own profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    // Find user
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    // Track changes for activity log
    const changes = {};
    if (name && name !== user.name) {
      changes.name = { from: user.name, to: name };
    }

    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return next(new BadRequestError("Email already in use"));
      }
      changes.email = { from: user.email, to: email };
    }

    // Update user
    user.name = name || user.name;
    user.email = email || user.email;

    const updatedUser = await user.save();

    // Log activity if there were changes
    if (Object.keys(changes).length > 0) {
      await Activity.create({
        userId: user._id,
        action: "update_profile",
        details: { changes },
      });
    }

    return ApiResponse.success(res, "Profile updated successfully", {
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        lastLogin: updatedUser.lastLogin,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
