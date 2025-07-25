const mongoose = require("mongoose");
const config = require("./src/config");

async function testConnection() {
  try {
    console.log("Testing MongoDB connection...");
    console.log("MongoDB URI:", config.mongoURI ? "Set" : "Not set");

    if (!config.mongoURI) {
      console.error("MongoDB URI is not set. Please check your .env file.");
      process.exit(1);
    }

    const conn = await mongoose.connect(config.mongoURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });

    console.log("✅ MongoDB Connected Successfully!");
    console.log("Host:", conn.connection.host);
    console.log("Database:", conn.connection.name);

    await mongoose.connection.close();
    console.log("Connection closed.");
    process.exit(0);
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:");
    console.error("Error:", error.message);
    console.error("\nPossible solutions:");
    console.error("1. Make sure MongoDB is running");
    console.error("2. Check your MONGODB_URI in .env file");
    console.error("3. Verify the connection string format");
    process.exit(1);
  }
}

testConnection();
