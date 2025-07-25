const EnterpriseLead = require("../models/enterpriseLead.model");
const { apiResponse } = require("../utils/apiResponse");
const { CustomError } = require("../utils/customError");

// Create new enterprise lead
const createEnterpriseLead = async (req, res, next) => {
  try {
    const { firstName, lastName, email, country, phone, users, agree } =
      req.body;

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !email ||
      !country ||
      !phone ||
      !users ||
      !agree
    ) {
      throw new CustomError("All fields are required", 400);
    }

    // Check if lead already exists
    const existingLead = await EnterpriseLead.findOne({ email });
    if (existingLead) {
      throw new CustomError("A lead with this email already exists", 409);
    }

    // Create new lead
    const lead = new EnterpriseLead({
      firstName,
      lastName,
      email,
      country,
      phone,
      users,
      agree,
      source: "website",
    });

    await lead.save();

    // TODO: Send notification email to sales team
    // TODO: Add to CRM system if integrated

    res.status(201).json(
      apiResponse(true, "Enterprise lead submitted successfully", {
        id: lead._id,
        message:
          "Thank you for your interest! Our enterprise team will contact you within 24 hours.",
      })
    );
  } catch (error) {
    next(error);
  }
};

// Get all enterprise leads (admin only)
const getEnterpriseLeads = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const leads = await EnterpriseLead.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-__v");

    const total = await EnterpriseLead.countDocuments(filter);

    res.json(
      apiResponse(true, "Enterprise leads retrieved successfully", {
        leads,
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

// Update enterprise lead status (admin only)
const updateEnterpriseLeadStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      "new",
      "contacted",
      "qualified",
      "converted",
      "closed",
    ];
    if (status && !validStatuses.includes(status)) {
      throw new CustomError("Invalid status", 400);
    }

    const lead = await EnterpriseLead.findById(id);
    if (!lead) {
      throw new CustomError("Enterprise lead not found", 404);
    }

    if (status) lead.status = status;
    if (notes !== undefined) lead.notes = notes;

    await lead.save();

    res.json(apiResponse(true, "Enterprise lead updated successfully", lead));
  } catch (error) {
    next(error);
  }
};

// Get enterprise lead by ID (admin only)
const getEnterpriseLeadById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lead = await EnterpriseLead.findById(id).select("-__v");
    if (!lead) {
      throw new CustomError("Enterprise lead not found", 404);
    }

    res.json(apiResponse(true, "Enterprise lead retrieved successfully", lead));
  } catch (error) {
    next(error);
  }
};

// Delete enterprise lead (admin only)
const deleteEnterpriseLead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lead = await EnterpriseLead.findById(id);
    if (!lead) {
      throw new CustomError("Enterprise lead not found", 404);
    }

    await EnterpriseLead.findByIdAndDelete(id);

    res.json(apiResponse(true, "Enterprise lead deleted successfully"));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEnterpriseLead,
  getEnterpriseLeads,
  updateEnterpriseLeadStatus,
  getEnterpriseLeadById,
  deleteEnterpriseLead,
};
