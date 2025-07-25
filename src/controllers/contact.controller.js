const Contact = require("../models/contact.model");
const { apiResponse } = require("../utils/apiResponse");
const { CustomError } = require("../utils/customError");

// Create new contact inquiry
const createContact = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, company, reason, message } =
      req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !reason || !message) {
      throw new CustomError(
        "First name, last name, email, reason, and message are required",
        400
      );
    }

    // Validate reason
    const validReasons = [
      "general-inquiry",
      "technical-support",
      "billing-question",
      "feature-request",
      "partnership",
      "other",
    ];

    if (!validReasons.includes(reason)) {
      throw new CustomError("Invalid reason for contact", 400);
    }

    // Create new contact
    const contact = new Contact({
      firstName,
      lastName,
      email,
      phone,
      company,
      reason,
      message,
      source: "website",
    });

    await contact.save();

    // TODO: Send notification email to support team
    // TODO: Send auto-reply to customer
    // TODO: Create ticket in support system if integrated

    res.status(201).json(
      apiResponse(true, "Contact inquiry submitted successfully", {
        id: contact._id,
        message:
          "Thank you for contacting us! We will respond within 24 hours.",
        ticketNumber: `SORT-${contact._id.toString().slice(-8).toUpperCase()}`,
      })
    );
  } catch (error) {
    next(error);
  }
};

// Get all contact inquiries (admin only)
const getContacts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      reason,
      priority,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (reason) filter.reason = reason;
    if (priority) filter.priority = priority;

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const contacts = await Contact.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("assignedTo", "name email")
      .select("-__v");

    const total = await Contact.countDocuments(filter);

    res.json(
      apiResponse(true, "Contact inquiries retrieved successfully", {
        contacts,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// Update contact inquiry (admin only)
const updateContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, response } = req.body;

    const contact = await Contact.findById(id);
    if (!contact) {
      throw new CustomError("Contact inquiry not found", 404);
    }

    // Validate status
    if (status) {
      const validStatuses = ["new", "in-progress", "resolved", "closed"];
      if (!validStatuses.includes(status)) {
        throw new CustomError("Invalid status", 400);
      }
      contact.status = status;
    }

    // Validate priority
    if (priority) {
      const validPriorities = ["low", "medium", "high", "urgent"];
      if (!validPriorities.includes(priority)) {
        throw new CustomError("Invalid priority", 400);
      }
      contact.priority = priority;
    }

    if (assignedTo !== undefined) contact.assignedTo = assignedTo;

    if (response) {
      contact.response = response;
      contact.responseDate = new Date();
    }

    await contact.save();

    // TODO: Send notification email if status changed to resolved
    // TODO: Update support system if integrated

    res.json(
      apiResponse(true, "Contact inquiry updated successfully", contact)
    );
  } catch (error) {
    next(error);
  }
};

// Get contact inquiry by ID (admin only)
const getContactById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findById(id)
      .populate("assignedTo", "name email")
      .select("-__v");

    if (!contact) {
      throw new CustomError("Contact inquiry not found", 404);
    }

    res.json(
      apiResponse(true, "Contact inquiry retrieved successfully", contact)
    );
  } catch (error) {
    next(error);
  }
};

// Delete contact inquiry (admin only)
const deleteContact = async (req, res, next) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findById(id);
    if (!contact) {
      throw new CustomError("Contact inquiry not found", 404);
    }

    await Contact.findByIdAndDelete(id);

    res.json(apiResponse(true, "Contact inquiry deleted successfully"));
  } catch (error) {
    next(error);
  }
};

// Get contact statistics (admin only)
const getContactStats = async (req, res, next) => {
  try {
    const stats = await Contact.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          new: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] },
          },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
          closed: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },
        },
      },
    ]);

    const reasonStats = await Contact.aggregate([
      {
        $group: {
          _id: "$reason",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json(
      apiResponse(true, "Contact statistics retrieved successfully", {
        overview: stats[0] || {
          total: 0,
          new: 0,
          inProgress: 0,
          resolved: 0,
          closed: 0,
        },
        byReason: reasonStats,
      })
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createContact,
  getContacts,
  updateContact,
  getContactById,
  deleteContact,
  getContactStats,
};
