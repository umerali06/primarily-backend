const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const AlertSchema = new Schema(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      required: function() {
        return this.type !== 'system' && this.type !== 'user_activity';
      },
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    type: {
      type: String,
      enum: [
        "low_quantity", 
        "out_of_stock", 
        "expiration", 
        "custom",
        "item_created",
        "item_updated", 
        "item_deleted",
        "folder_created",
        "folder_updated",
        "folder_deleted",
        "bulk_operation",
        "system",
        "user_activity",
        "export_complete",
        "import_complete",
        "backup_complete"
      ],
      default: "low_quantity",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    threshold: {
      type: Number,
      default: 0,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [500, "Message cannot be more than 500 characters"],
    },
    status: {
      type: String,
      enum: ["active", "read", "resolved", "dismissed"],
      default: "active",
    },
    actionUrl: {
      type: String,
      default: null,
    },
    actionText: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    dismissedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for efficient querying
AlertSchema.index({ userId: 1, status: 1, createdAt: -1 });
AlertSchema.index({ itemId: 1, type: 1 });
AlertSchema.index({ type: 1, priority: 1 });
AlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if alert is expired
AlertSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to mark alert as read
AlertSchema.methods.markAsRead = async function () {
  if (this.status === "active") {
    this.status = "read";
    this.readAt = Date.now();
    await this.save();
  }
  return this;
};

// Method to resolve alert
AlertSchema.methods.resolve = async function () {
  if (this.status !== "resolved") {
    this.status = "resolved";
    this.resolvedAt = Date.now();
    await this.save();
  }
  return this;
};

// Method to dismiss alert
AlertSchema.methods.dismiss = async function () {
  if (this.status !== "dismissed") {
    this.status = "dismissed";
    this.dismissedAt = Date.now();
    await this.save();
  }
  return this;
};

// Static method to create low quantity alert
AlertSchema.statics.createLowQuantityAlert = async function (item) {
  // Check if there's already an active alert for this item
  const existingAlert = await this.findOne({
    itemId: item._id,
    type: "low_quantity",
    status: { $in: ["active", "read"] },
  });

  if (existingAlert) {
    // Update existing alert
    existingAlert.threshold = item.minLevel;
    existingAlert.currentValue = item.quantity;
    existingAlert.status = "active";
    existingAlert.readAt = null;
    existingAlert.title = "Low Stock Alert";
    existingAlert.message = `${item.name} is running low (${item.quantity} remaining, minimum: ${item.minLevel})`;
    existingAlert.priority = item.quantity === 0 ? "critical" : "high";
    existingAlert.actionUrl = `/dashboard?tab=items&item=${item._id}`;
    existingAlert.actionText = "View Item";
    await existingAlert.save();
    return existingAlert;
  }

  // Create new alert
  return await this.create({
    itemId: item._id,
    folderId: item.folderId,
    userId: item.userId,
    type: item.quantity === 0 ? "out_of_stock" : "low_quantity",
    threshold: item.minLevel,
    currentValue: item.quantity,
    title: item.quantity === 0 ? "Out of Stock Alert" : "Low Stock Alert",
    message: item.quantity === 0 
      ? `${item.name} is out of stock`
      : `${item.name} is running low (${item.quantity} remaining, minimum: ${item.minLevel})`,
    priority: item.quantity === 0 ? "critical" : "high",
    actionUrl: `/dashboard?tab=items&item=${item._id}`,
    actionText: "View Item",
    metadata: {
      itemName: item.name,
      previousQuantity: item.quantity,
    }
  });
};

// Static method to create item activity alert
AlertSchema.statics.createItemActivityAlert = async function (item, action, userId, details = {}) {
  const actionTitles = {
    create: "New Item Created",
    update: "Item Updated", 
    delete: "Item Deleted",
  };

  const actionMessages = {
    create: `New item "${item.name}" has been created`,
    update: `Item "${item.name}" has been updated`,
    delete: `Item "${item.name}" has been deleted`,
  };

  return await this.create({
    itemId: action !== 'delete' ? item._id : null,
    folderId: item.folderId,
    userId: userId,
    type: `item_${action}`,
    title: actionTitles[action] || "Item Activity",
    message: actionMessages[action] || `Item "${item.name}" activity`,
    priority: action === 'delete' ? 'medium' : 'low',
    actionUrl: action !== 'delete' ? `/dashboard?tab=items&item=${item._id}` : '/dashboard?tab=items',
    actionText: action !== 'delete' ? "View Item" : "View Items",
    metadata: {
      itemName: item.name,
      action: action,
      ...details
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expire in 7 days
  });
};

// Static method to create folder activity alert
AlertSchema.statics.createFolderActivityAlert = async function (folder, action, userId, details = {}) {
  const actionTitles = {
    create: "New Folder Created",
    update: "Folder Updated",
    delete: "Folder Deleted",
  };

  const actionMessages = {
    create: `New folder "${folder.name}" has been created`,
    update: `Folder "${folder.name}" has been updated`,
    delete: `Folder "${folder.name}" has been deleted`,
  };

  return await this.create({
    folderId: action !== 'delete' ? folder._id : null,
    userId: userId,
    type: `folder_${action}`,
    title: actionTitles[action] || "Folder Activity",
    message: actionMessages[action] || `Folder "${folder.name}" activity`,
    priority: 'low',
    actionUrl: action !== 'delete' ? `/dashboard?tab=folders&folder=${folder._id}` : '/dashboard?tab=folders',
    actionText: action !== 'delete' ? "View Folder" : "View Folders",
    metadata: {
      folderName: folder.name,
      action: action,
      ...details
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expire in 7 days
  });
};

// Static method to create bulk operation alert
AlertSchema.statics.createBulkOperationAlert = async function (operation, count, userId, details = {}) {
  return await this.create({
    userId: userId,
    type: "bulk_operation",
    title: "Bulk Operation Complete",
    message: `Bulk ${operation} completed for ${count} items`,
    priority: 'medium',
    actionUrl: '/dashboard?tab=items',
    actionText: "View Items",
    metadata: {
      operation: operation,
      count: count,
      ...details
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expire in 24 hours
  });
};

// Static method to create system alert
AlertSchema.statics.createSystemAlert = async function (title, message, priority = 'medium', userId = null, details = {}) {
  const alertData = {
    type: "system",
    title: title,
    message: message,
    priority: priority,
    metadata: details,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expire in 24 hours
  };

  if (userId) {
    alertData.userId = userId;
    return await this.create(alertData);
  } else {
    // Create system alert for all users
    const User = require('./user.model');
    const users = await User.find({}, '_id');
    const alerts = [];
    
    for (const user of users) {
      alerts.push(await this.create({
        ...alertData,
        userId: user._id
      }));
    }
    
    return alerts;
  }
};

// Static method to check and resolve low quantity alerts
AlertSchema.statics.checkAndResolveAlerts = async function (item) {
  // If quantity is now above minLevel, resolve any active low quantity alerts
  if (item.quantity > item.minLevel) {
    const alerts = await this.find({
      itemId: item._id,
      type: { $in: ["low_quantity", "out_of_stock"] },
      status: { $in: ["active", "read"] },
    });

    for (const alert of alerts) {
      await alert.resolve();
    }
  }
};

// Static method to clean up expired alerts
AlertSchema.statics.cleanupExpiredAlerts = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

module.exports = mongoose.model("Alert", AlertSchema);
