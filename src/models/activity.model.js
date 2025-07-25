const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ActivitySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: [true, "Resource ID is required"],
    },
    resourceType: {
      type: String,
      enum: ["item", "folder", "user", "alert"],
      required: [true, "Resource type is required"],
    },
    action: {
      type: String,
      enum: [
        "create",
        "update",
        "delete",
        "move",
        "clone",
        "quantity_change",
        "status_change",
        "bulk_update",
        "login",
        "logout",
        "register",
        "forgot_password",
        "reset_password",
        "update_password",
        "custom",
      ],
      required: [true, "Action is required"],
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for efficient querying
ActivitySchema.index({ userId: 1, createdAt: -1 });
ActivitySchema.index({ resourceId: 1, resourceType: 1, createdAt: -1 });
ActivitySchema.index({ createdAt: -1 });

// Static method to log item activity
ActivitySchema.statics.logItemActivity = async function (
  userId,
  itemId,
  action,
  details = {}
) {
  return await this.create({
    userId,
    resourceId: itemId,
    resourceType: "item",
    action,
    details,
  });
};

// Static method to log folder activity
ActivitySchema.statics.logFolderActivity = async function (
  userId,
  folderId,
  action,
  details = {}
) {
  return await this.create({
    userId,
    resourceId: folderId,
    resourceType: "folder",
    action,
    details,
  });
};

// Static method to log user activity
ActivitySchema.statics.logUserActivity = async function (
  userId,
  targetUserId,
  action,
  details = {}
) {
  return await this.create({
    userId,
    resourceId: targetUserId,
    resourceType: "user",
    action,
    details,
  });
};

// Static method to log alert activity
ActivitySchema.statics.logAlertActivity = async function (
  userId,
  alertId,
  action,
  details = {}
) {
  return await this.create({
    userId,
    resourceId: alertId,
    resourceType: "alert",
    action,
    details,
  });
};

// Static method to log authentication activity
ActivitySchema.statics.logAuthActivity = async function (
  userId,
  action,
  details = {},
  req = null
) {
  const activityData = {
    userId,
    resourceId: userId,
    resourceType: "user",
    action,
    details,
  };

  // Add IP address and user agent if request object is provided
  if (req) {
    activityData.ipAddress = req.ip || req.connection.remoteAddress;
    activityData.userAgent = req.headers["user-agent"];
  }

  return await this.create(activityData);
};

// Static method to get recent activity for a user
ActivitySchema.statics.getRecentActivity = async function (userId, limit = 10) {
  return await this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "name")
    .lean();
};

// Static method to get activity for a specific resource
ActivitySchema.statics.getResourceActivity = async function (
  resourceId,
  resourceType,
  limit = 50
) {
  return await this.find({ resourceId, resourceType })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "name")
    .lean();
};

module.exports = mongoose.model("Activity", ActivitySchema);
