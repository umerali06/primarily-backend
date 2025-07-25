const Alert = require('../models/alert.model');
const Activity = require('../models/activity.model');
const { EventEmitter } = require('events');

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Listen for item events
    this.on('item:created', this.handleItemCreated.bind(this));
    this.on('item:updated', this.handleItemUpdated.bind(this));
    this.on('item:deleted', this.handleItemDeleted.bind(this));
    this.on('item:quantity_changed', this.handleQuantityChanged.bind(this));
    
    // Listen for folder events
    this.on('folder:created', this.handleFolderCreated.bind(this));
    this.on('folder:updated', this.handleFolderUpdated.bind(this));
    this.on('folder:deleted', this.handleFolderDeleted.bind(this));
    
    // Listen for bulk operations
    this.on('bulk:operation', this.handleBulkOperation.bind(this));
    
    // Listen for system events
    this.on('system:alert', this.handleSystemAlert.bind(this));
  }

  async handleItemCreated(data) {
    const { item, userId } = data;
    
    try {
      // Create activity log
      await Activity.logItemActivity(userId, item._id, 'create', {
        name: item.name,
        folderId: item.folderId,
      });

      // Create notification alert
      await Alert.createItemActivityAlert(item, 'create', userId);

      // Check if item is already low stock
      if (item.quantity <= item.minLevel) {
        await Alert.createLowQuantityAlert(item);
      }

      console.log(`📝 Item created notification sent for: ${item.name}`);
    } catch (error) {
      console.error('Error handling item created notification:', error);
    }
  }

  async handleItemUpdated(data) {
    const { item, previousItem, userId, changes } = data;
    
    try {
      // Create activity log
      await Activity.logItemActivity(userId, item._id, 'update', { changes });

      // Create notification alert
      await Alert.createItemActivityAlert(item, 'update', userId, { changes });

      // Check for quantity changes
      if (changes.quantity) {
        await this.handleQuantityChanged({
          item,
          previousQuantity: changes.quantity.from,
          newQuantity: changes.quantity.to,
          userId
        });
      }

      console.log(`✏️ Item updated notification sent for: ${item.name}`);
    } catch (error) {
      console.error('Error handling item updated notification:', error);
    }
  }

  async handleItemDeleted(data) {
    const { item, userId } = data;
    
    try {
      // Create activity log
      await Activity.logItemActivity(userId, item._id, 'delete', {
        name: item.name,
        folderId: item.folderId,
      });

      // Create notification alert
      await Alert.createItemActivityAlert(item, 'delete', userId);

      // Resolve any existing alerts for this item
      await Alert.updateMany(
        { itemId: item._id, status: { $in: ['active', 'read'] } },
        { status: 'resolved', resolvedAt: new Date() }
      );

      console.log(`🗑️ Item deleted notification sent for: ${item.name}`);
    } catch (error) {
      console.error('Error handling item deleted notification:', error);
    }
  }

  async handleQuantityChanged(data) {
    const { item, previousQuantity, newQuantity, userId } = data;
    
    try {
      // Check if item went from above minLevel to below minLevel
      if (previousQuantity > item.minLevel && newQuantity <= item.minLevel) {
        await Alert.createLowQuantityAlert(item);
        console.log(`⚠️ Low stock alert created for: ${item.name}`);
      }
      
      // Check if item went from below minLevel to above minLevel
      else if (previousQuantity <= item.minLevel && newQuantity > item.minLevel) {
        await Alert.checkAndResolveAlerts(item);
        console.log(`✅ Low stock alert resolved for: ${item.name}`);
      }
      
      // Check if item went out of stock
      else if (previousQuantity > 0 && newQuantity === 0) {
        await Alert.createLowQuantityAlert(item);
        console.log(`🚨 Out of stock alert created for: ${item.name}`);
      }
    } catch (error) {
      console.error('Error handling quantity change notification:', error);
    }
  }

  async handleFolderCreated(data) {
    const { folder, userId } = data;
    
    try {
      // Create activity log
      await Activity.logFolderActivity(userId, folder._id, 'create', {
        name: folder.name,
      });

      // Create notification alert
      await Alert.createFolderActivityAlert(folder, 'create', userId);

      console.log(`📁 Folder created notification sent for: ${folder.name}`);
    } catch (error) {
      console.error('Error handling folder created notification:', error);
    }
  }

  async handleFolderUpdated(data) {
    const { folder, userId, changes } = data;
    
    try {
      // Create activity log
      await Activity.logFolderActivity(userId, folder._id, 'update', { changes });

      // Create notification alert
      await Alert.createFolderActivityAlert(folder, 'update', userId, { changes });

      console.log(`📝 Folder updated notification sent for: ${folder.name}`);
    } catch (error) {
      console.error('Error handling folder updated notification:', error);
    }
  }

  async handleFolderDeleted(data) {
    const { folder, userId } = data;
    
    try {
      // Create activity log
      await Activity.logFolderActivity(userId, folder._id, 'delete', {
        name: folder.name,
      });

      // Create notification alert
      await Alert.createFolderActivityAlert(folder, 'delete', userId);

      console.log(`🗑️ Folder deleted notification sent for: ${folder.name}`);
    } catch (error) {
      console.error('Error handling folder deleted notification:', error);
    }
  }

  async handleBulkOperation(data) {
    const { operation, count, userId, details } = data;
    
    try {
      // Create notification alert
      await Alert.createBulkOperationAlert(operation, count, userId, details);

      console.log(`📦 Bulk operation notification sent: ${operation} (${count} items)`);
    } catch (error) {
      console.error('Error handling bulk operation notification:', error);
    }
  }

  async handleSystemAlert(data) {
    const { title, message, priority, userId, details } = data;
    
    try {
      // Create system alert
      await Alert.createSystemAlert(title, message, priority, userId, details);

      console.log(`🔔 System alert sent: ${title}`);
    } catch (error) {
      console.error('Error handling system alert:', error);
    }
  }

  // Method to emit item events
  emitItemEvent(event, data) {
    this.emit(`item:${event}`, data);
  }

  // Method to emit folder events
  emitFolderEvent(event, data) {
    this.emit(`folder:${event}`, data);
  }

  // Method to emit bulk operation events
  emitBulkOperation(data) {
    this.emit('bulk:operation', data);
  }

  // Method to emit system alerts
  emitSystemAlert(data) {
    this.emit('system:alert', data);
  }

  // Method to get user notification counts
  async getUserNotificationCounts(userId) {
    const counts = await Alert.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const result = {
      active: 0,
      read: 0,
      resolved: 0,
      dismissed: 0,
      total: 0,
    };

    counts.forEach((item) => {
      result[item._id] = item.count;
      result.total += item.count;
    });

    return result;
  }

  // Method to clean up old notifications
  async cleanupOldNotifications() {
    try {
      const deletedCount = await Alert.cleanupExpiredAlerts();
      console.log(`🧹 Cleaned up ${deletedCount} expired notifications`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      return 0;
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;
