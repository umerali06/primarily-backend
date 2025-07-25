const logger = require("./logger");
const { connectDB, closeConnection } = require("./database");

/**
 * Initialize database with default data
 * This script can be run separately to set up initial data
 */
const initializeDatabase = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info("Starting database initialization...");

    // Load models
    const User = require("../models/user.model");
    const Folder = require("../models/folder.model");

    // Create admin user if none exists
    try {
      logger.info("Checking for admin user...");

      const adminExists = await User.findOne({ role: "admin" });
      if (!adminExists) {
        logger.info("Creating admin user...");
        await User.create({
          name: "Admin User",
          email: "admin@example.com",
          password: "admin123", // This will be hashed by the pre-save hook
          role: "admin",
        });
        logger.info("Admin user created successfully");
      } else {
        logger.info("Admin user already exists");
      }
    } catch (error) {
      logger.warn(`Skipping admin user creation: ${error.message}`);
    }

    // Create default folders if none exist
    try {
      logger.info("Checking for default folders...");

      // Get admin user
      const adminUser = await User.findOne({ role: "admin" });

      if (adminUser) {
        // Check if folders exist
        const folderCount = await Folder.countDocuments({
          userId: adminUser._id,
        });

        if (folderCount === 0) {
          logger.info("Creating default folders...");

          // Create root folders
          const officeSupplies = await Folder.create({
            name: "Office Supplies",
            description: "Office supplies and stationery",
            userId: adminUser._id,
          });

          const toolsEquipment = await Folder.create({
            name: "Tools & Equipment",
            description: "Tools and equipment for various tasks",
            userId: adminUser._id,
          });

          // Create subfolders
          await Folder.create({
            name: "Stationery",
            description: "Pens, pencils, notebooks, etc.",
            parentId: officeSupplies._id,
            userId: adminUser._id,
          });

          await Folder.create({
            name: "Electronics",
            description: "Electronic devices and accessories",
            parentId: officeSupplies._id,
            userId: adminUser._id,
          });

          await Folder.create({
            name: "Hand Tools",
            description: "Manual tools for various tasks",
            parentId: toolsEquipment._id,
            userId: adminUser._id,
          });

          await Folder.create({
            name: "Power Tools",
            description: "Electric and battery-powered tools",
            parentId: toolsEquipment._id,
            userId: adminUser._id,
          });

          logger.info("Default folders created successfully");
        } else {
          logger.info("Default folders already exist");
        }
      }
    } catch (error) {
      logger.warn(`Skipping default folder creation: ${error.message}`);
    }

    // Create default settings if none exist
    // Note: We'll implement this when we create the Settings model
    logger.info("Checking for default settings...");

    logger.info("Database initialization completed successfully");

    // Close connection if running as standalone script
    if (require.main === module) {
      await closeConnection();
      process.exit(0);
    }

    return true;
  } catch (error) {
    logger.error(`Database initialization failed: ${error.message}`);

    // Close connection if running as standalone script
    if (require.main === module) {
      await closeConnection();
      process.exit(1);
    }

    throw error;
  }
};

// Run as standalone script if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
