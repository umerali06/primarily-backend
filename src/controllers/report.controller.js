const Item = require("../models/item.model");
const Folder = require("../models/folder.model");
const Activity = require("../models/activity.model");
const Alert = require("../models/alert.model");
const ApiResponse = require("../utils/apiResponse");
const { CustomError } = require("../utils/customError");

// Get inventory summary report
const getInventorySummary = async (req, res, next) => {
  try {
    const {
      folderId,
      tags,
      minPrice,
      maxPrice,
      lowStock,
      search,
      page = 1,
      limit = 50,
      dateRange,
    } = req.query;

    const query = { userId: req.user.id };

    // Apply filters
    if (folderId && folderId !== "all") {
      query.folderId = folderId;
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (lowStock === "true") {
      query.$expr = { $lt: ["$quantity", "$minLevel"] };
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Date range filter for created items
    if (dateRange) {
      const { start, end } = JSON.parse(dateRange);
      if (start || end) {
        query.createdAt = {};
        if (start) query.createdAt.$gte = new Date(start);
        if (end) query.createdAt.$lte = new Date(end);
      }
    }

    const items = await Item.find(query)
      .populate("folderId", "name path")
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Item.countDocuments(query);

    // Enhanced summary statistics with trends
    const summary = await Item.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$quantity", "$price"] } },
          avgPrice: { $avg: "$price" },
          maxPrice: { $max: "$price" },
          minPrice: { $min: "$price" },
          lowStockItems: {
            $sum: {
              $cond: [{ $lt: ["$quantity", "$minLevel"] }, 1, 0],
            },
          },
          outOfStockItems: {
            $sum: {
              $cond: [{ $eq: ["$quantity", 0] }, 1, 0],
            },
          },
          highValueItems: {
            $sum: {
              $cond: [
                { $gt: [{ $multiply: ["$quantity", "$price"] }, 1000] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Get folder-wise breakdown
    const folderBreakdown = await Item.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "folders",
          localField: "folderId",
          foreignField: "_id",
          as: "folder",
        },
      },
      {
        $group: {
          _id: "$folderId",
          folderName: { $first: { $arrayElemAt: ["$folder.name", 0] } },
          itemCount: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$quantity", "$price"] } },
          avgPrice: { $avg: "$price" },
        },
      },
      { $sort: { totalValue: -1 } },
      { $limit: 10 },
    ]);

    // Get tag-wise breakdown
    const tagBreakdown = await Item.aggregate([
      { $match: query },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          itemCount: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$quantity", "$price"] } },
        },
      },
      { $sort: { totalValue: -1 } },
      { $limit: 10 },
    ]);

    const stats = summary[0] || {
      totalItems: 0,
      totalQuantity: 0,
      totalValue: 0,
      avgPrice: 0,
      maxPrice: 0,
      minPrice: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      highValueItems: 0,
    };

    return ApiResponse.success(
      res,
      "Inventory summary retrieved successfully",
      {
        items,
        summary: stats,
        folderBreakdown,
        tagBreakdown,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        generatedAt: new Date(),
      }
    );
  } catch (error) {
    next(error);
  }
};

// Get transactions report
const getTransactions = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      itemId,
      transactionType,
      page = 1,
      limit = 50,
    } = req.query;

    const query = { userId: req.user.id };

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Item filter
    if (itemId) {
      query.resourceId = itemId;
      query.resourceType = "item";
    }

    // Transaction type filter
    if (transactionType) {
      query.action = transactionType;
    }

    const activities = await Activity.find(query)
      .populate("resourceId", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Activity.countDocuments(query);

    return ApiResponse.success(res, "Transactions retrieved successfully", {
      transactions: activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get activity history report
const getActivityHistory = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      resourceId,
      resourceType,
      action,
      page = 1,
      limit = 50,
    } = req.query;

    const query = { userId: req.user.id };

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Resource filters
    if (resourceId) query.resourceId = resourceId;
    if (resourceType) query.resourceType = resourceType;
    if (action) query.action = action;

    const activities = await Activity.find(query)
      .populate("resourceId", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Activity.countDocuments(query);

    // Get activity statistics
    const stats = await Activity.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
        },
      },
    ]);

    return ApiResponse.success(res, "Activity history retrieved successfully", {
      activities,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get item flow report (Premium feature)
const getItemFlow = async (req, res, next) => {
  try {
    // This would be a premium feature
    throw new CustomError("This feature requires a premium subscription", 403);
  } catch (error) {
    next(error);
  }
};

// Get move summary report (Premium feature)
const getMoveSummary = async (req, res, next) => {
  try {
    // This would be a premium feature
    throw new CustomError("This feature requires a premium subscription", 403);
  } catch (error) {
    next(error);
  }
};

// Get user activity summary report (Premium feature)
const getUserActivitySummary = async (req, res, next) => {
  try {
    // This would be a premium feature
    throw new CustomError("This feature requires a premium subscription", 403);
  } catch (error) {
    next(error);
  }
};

// Export report
const exportReport = async (req, res, next) => {
  try {
    const { reportType, format, ...params } = req.body;

    let data;
    switch (reportType) {
      case "inventory-summary":
        // Get data without pagination for export
        const inventoryQuery = { userId: req.user.id };
        if (params.folderId && params.folderId !== "all") {
          inventoryQuery.folderId = params.folderId;
        }
        data = await Item.find(inventoryQuery)
          .populate("folderId", "name path")
          .sort({ name: 1 })
          .lean();
        break;

      case "transactions":
        const transactionQuery = { userId: req.user.id };
        if (params.startDate || params.endDate) {
          transactionQuery.createdAt = {};
          if (params.startDate)
            transactionQuery.createdAt.$gte = new Date(params.startDate);
          if (params.endDate)
            transactionQuery.createdAt.$lte = new Date(params.endDate);
        }
        data = await Activity.find(transactionQuery)
          .populate("resourceId", "name")
          .sort({ createdAt: -1 })
          .lean();
        break;

      default:
        throw new CustomError("Invalid report type", 400);
    }

    // For now, return the data as JSON
    // In a real implementation, you would generate CSV/PDF/Excel files
    return ApiResponse.success(res, "Report exported successfully", {
      reportType,
      format,
      data,
      exportedAt: new Date(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventorySummary,
  getTransactions,
  getActivityHistory,
  getItemFlow,
  getMoveSummary,
  getUserActivitySummary,
  exportReport,
};
