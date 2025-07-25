const mongoose = require("mongoose");
const logger = require("./logger");
const config = require("./index");

/**
 * Connect to MongoDB database
 * @returns {Promise<mongoose.Connection>} Mongoose connection
 */
const connectDB = async () => {
  try {
    // Set mongoose options
    mongoose.set("strictQuery", false);

    // Connect to MongoDB
    const conn = await mongoose.connect(config.mongoURI, {
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      connectTimeoutMS: 30000, // Connection timeout
      maxPoolSize: 10, // Maximum number of connections in the pool
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Set up connection error handlers
    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    // Handle process termination
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed due to app termination");
      process.exit(0);
    });

    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    // Exit with failure
    process.exit(1);
  }
};

/**
 * Close database connection
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");
  } catch (error) {
    logger.error(`Error closing MongoDB connection: ${error.message}`);
    throw error;
  }
};

/**
 * Check database connection status
 * @returns {boolean} Connection status
 */
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectDB,
  closeConnection,
  isConnected,
};
