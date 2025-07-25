const Item = require("../models/item.model");
const Folder = require("../models/folder.model");
const Activity = require("../models/activity.model");
const ApiResponse = require("../utils/apiResponse");
const { BadRequestError } = require("../utils/customError");
const { Parser } = require("json2csv");
const mongoose = require("mongoose");

/**
 * @desc    Export items to CSV
 * @route   GET /api/export/items/csv
 * @access  Private
 */
exports.exportItemsCSV = async (req, res, next) => {
  try {
    console.log("=== CSV Export Request ===");
    console.log("Query parameters:", req.query);
    console.log("User ID:", req.user.id);

    const { folderId, tags, lowStock, itemIds } = req.query;

    // Build query
    const query = { userId: req.user.id };

    if (folderId) {
      query.folderId = folderId === "null" ? null : folderId;
    }

    if (tags) {
      const tagArray = tags.split(",");
      query.tags = { $in: tagArray };
    }

    if (lowStock === "true") {
      query.$expr = { $lte: ["$quantity", "$minLevel"] };
    }

    // If specific item IDs are provided, filter by those
    if (itemIds) {
      console.log("Processing itemIds:", itemIds);
      try {
        const itemIdArray = itemIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        console.log("Parsed item IDs:", itemIdArray);

        // Convert to MongoDB ObjectIds properly
        const objectIds = itemIdArray.map((id) => {
          if (mongoose.Types.ObjectId.isValid(id)) {
            return new mongoose.Types.ObjectId(id);
          }
          throw new Error(`Invalid ObjectId: ${id}`);
        });

        query._id = { $in: objectIds };
        console.log(
          "Final query with ObjectIds:",
          JSON.stringify(query, null, 2)
        );
      } catch (error) {
        console.error("Error processing itemIds:", error);
        return res.status(400).json({
          success: false,
          message: "Invalid item ID format provided",
          error: error.message,
        });
      }
    }

    console.log("Final query:", JSON.stringify(query, null, 2));

    // Get items
    const items = await Item.find(query)
      .populate("folderId", "name")
      .sort({ name: 1 });

    console.log(`Found ${items.length} items for export`);

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No items found to export",
      });
    }

    // Transform data for CSV
    const csvData = items.map((item) => ({
      name: item.name,
      description: item.description || "",
      quantity: item.quantity,
      unit: item.unit || "",
      minLevel: item.minLevel || 0,
      price: item.price || 0,
      totalValue: item.quantity * (item.price || 0),
      folder: item.folderId ? item.folderId.name : "No Folder",
      tags: item.tags.join(", "),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    // Define CSV fields
    const fields = [
      "name",
      "description",
      "quantity",
      "unit",
      "minLevel",
      "price",
      "totalValue",
      "folder",
      "tags",
      "createdAt",
      "updatedAt",
    ];

    // Generate CSV
    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);

    // Log export activity
    await Activity.create({
      userId: req.user.id,
      resourceId: req.user.id,
      resourceType: "user",
      action: "custom",
      details: {
        customAction: "export_items_csv",
        itemCount: items.length,
        filters: { folderId, tags, lowStock, itemIds },
      },
    });

    // Set headers for file download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="items-export-${Date.now()}.csv"`
    );

    console.log("=== CSV Export Success ===");
    console.log(`Exported ${items.length} items`);

    return res.send(csv);
  } catch (error) {
    console.error("=== CSV Export Error ===");
    console.error("Error details:", error);
    console.error("Stack trace:", error.stack);

    // Return proper error response
    if (error.message.includes("Invalid ObjectId")) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID format provided",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Export failed",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

/**
 * @desc    Export items to JSON
 * @route   GET /api/export/items/json
 * @access  Private
 */
exports.exportItemsJSON = async (req, res, next) => {
  try {
    console.log("=== JSON Export Request ===");
    console.log("Query parameters:", req.query);
    console.log("User ID:", req.user.id);

    const { folderId, tags, lowStock, itemIds } = req.query;

    // Build query
    const query = { userId: req.user.id };

    if (folderId) {
      query.folderId = folderId === "null" ? null : folderId;
    }

    if (tags) {
      const tagArray = tags.split(",");
      query.tags = { $in: tagArray };
    }

    if (lowStock === "true") {
      query.$expr = { $lte: ["$quantity", "$minLevel"] };
    }

    // If specific item IDs are provided, filter by those
    if (itemIds) {
      console.log("Processing itemIds:", itemIds);
      try {
        const itemIdArray = itemIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        console.log("Parsed item IDs:", itemIdArray);

        // Convert to MongoDB ObjectIds properly
        const objectIds = itemIdArray.map((id) => {
          if (mongoose.Types.ObjectId.isValid(id)) {
            return new mongoose.Types.ObjectId(id);
          }
          throw new Error(`Invalid ObjectId: ${id}`);
        });

        query._id = { $in: objectIds };
        console.log(
          "Final query with ObjectIds:",
          JSON.stringify(query, null, 2)
        );
      } catch (error) {
        console.error("Error processing itemIds:", error);
        return res.status(400).json({
          success: false,
          message: "Invalid item ID format provided",
          error: error.message,
        });
      }
    }

    console.log("Final query:", JSON.stringify(query, null, 2));

    // Get items
    const items = await Item.find(query)
      .populate("folderId", "name")
      .sort({ name: 1 });

    console.log(`Found ${items.length} items for export`);

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No items found to export",
      });
    }

    // Transform data for JSON
    const jsonData = {
      exportDate: new Date().toISOString(),
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
      filters: { folderId, tags, lowStock, itemIds },
      summary: {
        totalItems: items.length,
        totalValue: items.reduce(
          (sum, item) => sum + item.quantity * (item.price || 0),
          0
        ),
      },
      items: items.map((item) => ({
        id: item._id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        minLevel: item.minLevel,
        price: item.price,
        totalValue: item.quantity * (item.price || 0),
        folderId: item.folderId?._id,
        folderName: item.folderId?.name,
        tags: item.tags,
        images: item.images,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };

    // Log export activity
    await Activity.create({
      userId: req.user.id,
      resourceId: req.user.id,
      resourceType: "user",
      action: "custom",
      details: {
        customAction: "export_items_json",
        itemCount: items.length,
        filters: { folderId, tags, lowStock, itemIds },
      },
    });

    // Set headers for file download
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="items-export-${Date.now()}.json"`
    );

    console.log("=== JSON Export Success ===");
    console.log(`Exported ${items.length} items`);

    return res.json(jsonData);
  } catch (error) {
    console.error("=== JSON Export Error ===");
    console.error("Error details:", error);
    console.error("Stack trace:", error.stack);

    // Return proper error response
    if (error.message.includes("Invalid ObjectId")) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID format provided",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Export failed",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

/**
 * @desc    Export folders to CSV
 * @route   GET /api/export/folders/csv
 * @access  Private
 */
exports.exportFoldersCSV = async (req, res, next) => {
  try {
    // Get folders
    const folders = await Folder.find({ userId: req.user.id })
      .populate("parentId", "name")
      .sort({ path: 1, name: 1 });

    // Transform data for CSV
    const csvData = folders.map((folder) => ({
      name: folder.name,
      description: folder.description || "",
      parent: folder.parentId ? folder.parentId.name : "Root",
      level: folder.level,
      path: folder.path,
      tags: folder.tags.join(", "),
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    }));

    // Define CSV fields
    const fields = [
      "name",
      "description",
      "parent",
      "level",
      "path",
      "tags",
      "createdAt",
      "updatedAt",
    ];

    // Generate CSV
    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);

    // Log export activity
    await Activity.create({
      userId: req.user.id,
      resourceId: req.user.id,
      resourceType: "user",
      action: "custom",
      details: {
        customAction: "export_folders_csv",
        folderCount: folders.length,
      },
    });

    // Set headers for file download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="folders-export-${Date.now()}.csv"`
    );

    return res.send(csv);
  } catch (error) {
    console.error("=== Folders CSV Export Error ===");
    console.error("Error details:", error);
    console.error("Stack trace:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Export failed",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

/**
 * @desc    Export complete inventory (items + folders) to JSON
 * @route   GET /api/export/complete
 * @access  Private
 */
exports.exportCompleteInventory = async (req, res, next) => {
  try {
    // Get all folders
    const folders = await Folder.find({ userId: req.user.id }).sort({
      path: 1,
      name: 1,
    });

    // Get all items
    const items = await Item.find({ userId: req.user.id })
      .populate("folderId", "name")
      .sort({ name: 1 });

    // Create complete export data
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
      summary: {
        totalFolders: folders.length,
        totalItems: items.length,
        totalValue: items.reduce(
          (sum, item) => sum + item.quantity * (item.price || 0),
          0
        ),
      },
      folders: folders.map((folder) => ({
        id: folder._id,
        name: folder.name,
        description: folder.description,
        parentId: folder.parentId,
        level: folder.level,
        path: folder.path,
        tags: folder.tags,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      })),
      items: items.map((item) => ({
        id: item._id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        minLevel: item.minLevel,
        price: item.price,
        totalValue: item.quantity * (item.price || 0),
        folderId: item.folderId?._id,
        folderName: item.folderId?.name,
        tags: item.tags,
        images: item.images,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };

    // Log export activity
    await Activity.create({
      userId: req.user.id,
      resourceId: req.user.id,
      resourceType: "user",
      action: "custom",
      details: {
        customAction: "export_complete_inventory",
        folderCount: folders.length,
        itemCount: items.length,
        totalValue: exportData.summary.totalValue,
      },
    });

    // Set headers for file download
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="complete-inventory-${Date.now()}.json"`
    );

    return res.json(exportData);
  } catch (error) {
    console.error("=== Complete Export Error ===");
    console.error("Error details:", error);
    console.error("Stack trace:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Export failed",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};
