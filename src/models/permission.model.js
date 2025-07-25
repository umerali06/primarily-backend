const mongoose = require("mongoose");

/**
 * Permission Schema
 * Manages access control for resources (items and folders)
 */
const permissionSchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Resource ID is required"],
      refPath: "resourceType",
    },
    resourceType: {
      type: String,
      required: [true, "Resource type is required"],
      enum: ["Item", "Folder"],
      validate: {
        validator: function (value) {
          return ["Item", "Folder"].includes(value);
        },
        message: "Resource type must be either Item or Folder",
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    accessLevel: {
      type: String,
      required: [true, "Access level is required"],
      enum: ["view", "edit", "admin"],
      default: "view",
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Granted by user ID is required"],
    },
    expiresAt: {
      type: Date,
      default: null, // null means no expiration
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying
permissionSchema.index({ resourceId: 1, resourceType: 1 });
permissionSchema.index({ resourceId: 1, userId: 1 }, { unique: true });
permissionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if permission is expired
permissionSchema.virtual("isExpired").get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

/**
 * Static method to check if user has permission for a resource
 * @param {String} userId - User ID
 * @param {String} resourceId - Resource ID
 * @param {String} resourceType - Resource type (Item or Folder)
 * @param {String} requiredLevel - Required access level
 * @returns {Boolean} - Whether user has permission
 */
permissionSchema.statics.hasPermission = async function (
  userId,
  resourceId,
  resourceType,
  requiredLevel = "view"
) {
  const accessLevels = {
    view: 1,
    edit: 2,
    admin: 3,
  };

  const permission = await this.findOne({
    userId,
    resourceId,
    resourceType,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });

  if (!permission) {
    return false;
  }

  return accessLevels[permission.accessLevel] >= accessLevels[requiredLevel];
};

/**
 * Static method to get user permissions for a resource
 * @param {String} resourceId - Resource ID
 * @param {String} resourceType - Resource type
 * @returns {Array} - Array of permissions
 */
permissionSchema.statics.getResourcePermissions = async function (
  resourceId,
  resourceType
) {
  return this.find({
    resourceId,
    resourceType,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })
    .populate("userId", "name email")
    .populate("grantedBy", "name email");
};

/**
 * Static method to get all permissions for a user
 * @param {String} userId - User ID
 * @returns {Array} - Array of permissions
 */
permissionSchema.statics.getUserPermissions = async function (userId) {
  return this.find({
    userId,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).populate("resourceId");
};

/**
 * Static method to grant permission
 * @param {String} resourceId - Resource ID
 * @param {String} resourceType - Resource type
 * @param {String} userId - User to grant permission to
 * @param {String} accessLevel - Access level to grant
 * @param {String} grantedBy - User granting the permission
 * @param {Date} expiresAt - Optional expiration date
 * @returns {Object} - Created permission
 */
permissionSchema.statics.grantPermission = async function (
  resourceId,
  resourceType,
  userId,
  accessLevel,
  grantedBy,
  expiresAt = null
) {
  // Check if permission already exists
  const existingPermission = await this.findOne({
    resourceId,
    resourceType,
    userId,
  });

  if (existingPermission) {
    // Update existing permission
    existingPermission.accessLevel = accessLevel;
    existingPermission.grantedBy = grantedBy;
    existingPermission.expiresAt = expiresAt;
    return existingPermission.save();
  }

  // Create new permission
  return this.create({
    resourceId,
    resourceType,
    userId,
    accessLevel,
    grantedBy,
    expiresAt,
  });
};

/**
 * Static method to revoke permission
 * @param {String} resourceId - Resource ID
 * @param {String} resourceType - Resource type
 * @param {String} userId - User to revoke permission from
 * @returns {Boolean} - Whether permission was revoked
 */
permissionSchema.statics.revokePermission = async function (
  resourceId,
  resourceType,
  userId
) {
  const result = await this.deleteOne({
    resourceId,
    resourceType,
    userId,
  });

  return result.deletedCount > 0;
};

/**
 * Instance method to check if permission is valid
 * @returns {Boolean} - Whether permission is valid
 */
permissionSchema.methods.isValid = function () {
  return !this.isExpired;
};

const Permission = mongoose.model("Permission", permissionSchema);

module.exports = Permission;
