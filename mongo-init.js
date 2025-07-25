// MongoDB initialization script
db = db.getSiblingDB("inventory_management");

// Create collections with indexes
db.createCollection("users");
// Create indexes for better query performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ googleId: 1 }, { sparse: true });

db.createCollection("items");
// Items indexes
db.items.createIndex({ userId: 1, name: 1 });
db.items.createIndex({ userId: 1, folderId: 1 });
db.items.createIndex({ userId: 1, tags: 1 });

db.createCollection("folders");
// Folders indexes
db.folders.createIndex({ userId: 1, name: 1 });
db.folders.createIndex({ userId: 1, parentId: 1 });
db.folders.createIndex({ userId: 1, path: 1 });

db.createCollection("alerts");
// Alerts indexes
db.alerts.createIndex({ userId: 1, status: 1 });

db.createCollection("activities");
// Activities indexes
db.activities.createIndex({ userId: 1, createdAt: -1 });
db.activities.createIndex({ resourceId: 1, resourceType: 1, createdAt: -1 });
db.activities.createIndex({ createdAt: -1 });

db.createCollection("permissions");
// Permissions indexes
db.permissions.createIndex(
  { resourceId: 1, resourceType: 1, userId: 1 },
  { unique: true }
);
db.permissions.createIndex({ userId: 1, isActive: 1 });

console.log("Database initialized successfully");
