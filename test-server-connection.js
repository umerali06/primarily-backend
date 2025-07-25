const axios = require("axios");

async function testServerConnection() {
  const ports = [5000, 5001, 5002, 5003, 5004, 5005];

  console.log("Testing server connection...");

  for (const port of ports) {
    try {
      console.log(`Testing port ${port}...`);
      const response = await axios.get(`http://localhost:${port}/health`, {
        timeout: 2000,
      });

      if (response.status === 200) {
        console.log(`✅ Server is running on port ${port}`);
        console.log("Response:", response.data);
        return port;
      }
    } catch (error) {
      console.log(`❌ Port ${port} not accessible:`, error.message);
    }
  }

  console.log("❌ No server found on any tested ports");
  return null;
}

testServerConnection()
  .then((port) => {
    if (port) {
      console.log(`\n🎉 Server is accessible on port ${port}`);
      console.log(
        `Update your client API URL to: http://localhost:${port}/api`
      );
    } else {
      console.log("\n🚨 Please start the server first:");
      console.log("cd server && npm run dev");
    }
  })
  .catch(console.error);
