const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory Management API",
      version: "1.0.0",
      description: "A comprehensive inventory management system API",
      contact: {
        name: "API Support",
        email: "support@inventoryapi.com",
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? "https://api.inventory.com"
            : "http://localhost:5000",
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "60d5ecb74b24c72b8c8e4b5a" },
            name: { type: "string", example: "John Doe" },
            email: { type: "string", example: "john@example.com" },
            role: { type: "string", enum: ["user", "admin"], example: "user" },
            status: {
              type: "string",
              enum: ["active", "inactive"],
              example: "active",
            },
            lastLogin: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Item: {
          type: "object",
          properties: {
            id: { type: "string", example: "60d5ecb74b24c72b8c8e4b5a" },
            name: { type: "string", example: "Laptop Computer" },
            description: { type: "string", example: "Dell XPS 13 Laptop" },
            quantity: { type: "number", example: 10 },
            unit: { type: "string", example: "pcs" },
            minLevel: { type: "number", example: 5 },
            price: { type: "number", example: 999.99 },
            totalValue: { type: "number", example: 9999.9 },
            folderId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5b" },
            tags: {
              type: "array",
              items: { type: "string" },
              example: ["electronics", "computers"],
            },
            images: {
              type: "array",
              items: { type: "string" },
              example: ["image1.jpg"],
            },
            userId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5c" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Folder: {
          type: "object",
          properties: {
            id: { type: "string", example: "60d5ecb74b24c72b8c8e4b5a" },
            name: { type: "string", example: "Electronics" },
            description: {
              type: "string",
              example: "Electronic devices and components",
            },
            parentId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5b" },
            level: { type: "number", example: 1 },
            path: { type: "string", example: "/Electronics" },
            tags: {
              type: "array",
              items: { type: "string" },
              example: ["category"],
            },
            userId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5c" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Alert: {
          type: "object",
          properties: {
            id: { type: "string", example: "60d5ecb74b24c72b8c8e4b5a" },
            itemId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5b" },
            userId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5c" },
            type: {
              type: "string",
              enum: ["low_quantity", "expiration", "custom"],
              example: "low_quantity",
            },
            threshold: { type: "number", example: 5 },
            currentValue: { type: "number", example: 2 },
            message: {
              type: "string",
              example: "Item quantity is below minimum level",
            },
            status: {
              type: "string",
              enum: ["active", "read", "resolved"],
              example: "active",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Activity: {
          type: "object",
          properties: {
            id: { type: "string", example: "60d5ecb74b24c72b8c8e4b5a" },
            userId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5b" },
            resourceId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5c" },
            resourceType: { type: "string", example: "Item" },
            action: { type: "string", example: "create" },
            details: { type: "object", example: { name: "New Item" } },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Permission: {
          type: "object",
          properties: {
            id: { type: "string", example: "60d5ecb74b24c72b8c8e4b5a" },
            resourceId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5b" },
            resourceType: {
              type: "string",
              enum: ["Item", "Folder"],
              example: "Item",
            },
            userId: { type: "string", example: "60d5ecb74b24c72b8c8e4b5c" },
            accessLevel: {
              type: "string",
              enum: ["view", "edit", "admin"],
              example: "edit",
            },
            grantedBy: { type: "string", example: "60d5ecb74b24c72b8c8e4b5d" },
            isActive: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            status: { type: "number", example: 400 },
            message: { type: "string", example: "Bad Request" },
            code: { type: "string", example: "BAD_REQUEST" },
          },
        },
        Success: {
          type: "object",
          properties: {
            status: { type: "number", example: 200 },
            message: { type: "string", example: "Success" },
            data: { type: "object" },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js", "./src/controllers/*.js"], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
};
