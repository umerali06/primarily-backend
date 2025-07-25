/**
 * Script to test database connection
 * Run with: node src/scripts/testDbConnection.js
 */

// Load environment variables
require("dotenv").config();

const mongoose = require("mongoose");
const {
  connectDB,
  closeConnection,
  isConnected,
} = require("../config/database");
const logger = require("../config/logger");

const testConnection = async () => {
  try {
    logger.info("Testing database connection...");

    // Connect to database
    await connectDB();

    // Check connection status
    if (isConnected()) {
      logger.info("✅ Database connection successful!");
      logger.info("Connection details:");
      logger.info(`- Database name: ${mongoose.connection.name}`);
      logger.info(`- Host: ${mongoose.connection.host}`);
      logger.info(`- Port: ${mongoose.connection.port}`);
    } else {
      logger.error("❌ Database connection failed!");
      process.exit(1);
    }

    // Close connection
    await closeConnection();
    logger.info("Connection closed.");
    process.exit(0);
  } catch (error) {
    logger.error(`❌ Database connection test failed: ${error.message}`);
    process.exit(1);
  }
};

// Run the test
testConnection();
