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
      try {
        const itemIdArray = itemIds.split(",");
        // Convert string IDs to MongoDB ObjectId
        const objectIdArray = itemIdArray.map((id) =>
          mongoose.Types.ObjectId(id)
        );
        query._id = { $in: objectIdArray };
      } catch (error) {
        return next(new BadRequestError("Invalid item ID format"));
      }
    }

    // Get items
    const items = await Item.find(query)
      .populate("folderId", "name")
      .sort({ name: 1 });

    // Transform data for CSV
    const csvData = items.map((item) => ({
      name: item.name,
      description: item.description || "",
      quantity: item.quantity,
      unit: item.unit || "",
      minLevel: item.minLevel,
      price: item.price || 0,
      totalValue: (item.quantity * (item.price || 0)).toFixed(2),
      folder: item.folderId ? item.folderId.name : "Root",
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
      action: "export_items_csv",
      details: {
        itemCount: items.length,
        filters: { folderId, tags, lowStock },
      },
    });

    // Set headers for file download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="items-export-${Date.now()}.csv"`
    );

    return res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export items to JSON
 * @route   GET /api/export/items/json
 * @access  Private
 */
exports.exportItemsJSON = async (req, res, next) => {
  try {
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
      try {
        const itemIdArray = itemIds.split(",");
        // Convert string IDs to MongoDB ObjectId
        const objectIdArray = itemIdArray.map((id) =>
          mongoose.Types.ObjectId(id)
        );
        query._id = { $in: objectIdArray };
      } catch (error) {
        return next(new BadRequestError("Invalid item ID format"));
      }
    }

    // Get items
    const items = await Item.find(query)
      .populate("folderId", "name")
      .sort({ name: 1 });

    // Transform data for JSON export
    const exportData = {
      exportDate: new Date().toISOString(),
      itemCount: items.length,
      filters: { folderId, tags, lowStock },
      items: items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        minLevel: item.minLevel,
        price: item.price,
        totalValue: item.quantity * (item.price || 0),
        folder: item.folderId ? item.folderId.name : null,
        tags: item.tags,
        images: item.images,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };

    // Log export activity
    await Activity.create({
      userId: req.user.id,
      action: "export_items_json",
      details: {
        itemCount: items.length,
        filters: { folderId, tags, lowStock },
      },
    });

    // Set headers for file download
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="items-export-${Date.now()}.json"`
    );

    return res.json(exportData);
  } catch (error) {
    next(error);
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
      action: "export_folders_csv",
      details: {
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
    next(error);
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
      action: "export_complete_inventory",
      details: {
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
    next(error);
  }
};
