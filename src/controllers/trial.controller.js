const TrialSubscription = require("../models/trial.model");
const ApiResponse = require("../utils/apiResponse");
const CustomError = require("../utils/customError");

// Start free trial
const startTrial = async (req, res, next) => {
  try {
    const { billingInfo, trialDays = 14 } = req.body;

    // Check if user already has a trial
    const existingTrial = await TrialSubscription.findOne({
      userId: req.user.id,
    });

    if (existingTrial) {
      throw new CustomError("Trial already exists for this user", 400);
    }

    // Create new trial
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + trialDays);

    const trial = new TrialSubscription({
      userId: req.user.id,
      endDate,
      features: ["basic-inventory", "advanced-reports", "bulk-operations"],
      billingInfo: billingInfo || {},
    });

    await trial.save();

    res.status(201).json(
      new ApiResponse(201, "Trial started successfully", {
        trial: {
          ...trial.toObject(),
          daysRemaining: trial.daysRemaining,
          progress: trial.progress,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// Get trial status
const getTrialStatus = async (req, res, next) => {
  try {
    const trial = await TrialSubscription.findOne({ userId: req.user.id });

    if (!trial) {
      return res.json(
        new ApiResponse(200, "No trial found", {
          hasTrial: false,
          trial: null,
        })
      );
    }

    // Update status if expired
    if (trial.isExpired() && trial.status === "active") {
      trial.status = "expired";
      await trial.save();
    }

    res.json(
      new ApiResponse(200, "Trial status retrieved successfully", {
        hasTrial: true,
        trial: {
          ...trial.toObject(),
          daysRemaining: trial.daysRemaining,
          progress: trial.progress,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// Update trial information
const updateTrial = async (req, res, next) => {
  try {
    const { billingInfo } = req.body;

    const trial = await TrialSubscription.findOne({ userId: req.user.id });

    if (!trial) {
      throw new CustomError("Trial not found", 404);
    }

    if (billingInfo) {
      trial.billingInfo = { ...trial.billingInfo, ...billingInfo };
    }

    await trial.save();

    res.json(
      new ApiResponse(200, "Trial updated successfully", {
        trial: {
          ...trial.toObject(),
          daysRemaining: trial.daysRemaining,
          progress: trial.progress,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// Extend trial
const extendTrial = async (req, res, next) => {
  try {
    const { days, reason } = req.body;

    const trial = await TrialSubscription.findOne({ userId: req.user.id });

    if (!trial) {
      throw new CustomError("Trial not found", 404);
    }

    if (trial.status !== "active") {
      throw new CustomError("Cannot extend inactive trial", 400);
    }

    await trial.extend(days, reason);

    res.json(
      new ApiResponse(200, "Trial extended successfully", {
        trial: {
          ...trial.toObject(),
          daysRemaining: trial.daysRemaining,
          progress: trial.progress,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// Convert trial to paid plan
const convertTrial = async (req, res, next) => {
  try {
    const { planSelected, conversionSource } = req.body;

    const trial = await TrialSubscription.findOne({ userId: req.user.id });

    if (!trial) {
      throw new CustomError("Trial not found", 404);
    }

    await trial.convert(planSelected, conversionSource);

    res.json(
      new ApiResponse(200, "Trial converted successfully", {
        trial: {
          ...trial.toObject(),
          daysRemaining: trial.daysRemaining,
          progress: trial.progress,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// Update trial usage
const updateUsage = async (req, res, next) => {
  try {
    const { usageType, increment = 1 } = req.body;

    const trial = await TrialSubscription.findOne({ userId: req.user.id });

    if (!trial) {
      throw new CustomError("Trial not found", 404);
    }

    await trial.updateUsage(usageType, increment);

    res.json(
      new ApiResponse(200, "Usage updated successfully", {
        usage: trial.usage,
      })
    );
  } catch (error) {
    next(error);
  }
};

// Cancel trial
const cancelTrial = async (req, res, next) => {
  try {
    const trial = await TrialSubscription.findOne({ userId: req.user.id });

    if (!trial) {
      throw new CustomError("Trial not found", 404);
    }

    trial.status = "cancelled";
    await trial.save();

    res.json(
      new ApiResponse(200, "Trial cancelled successfully", {
        trial: {
          ...trial.toObject(),
          daysRemaining: trial.daysRemaining,
          progress: trial.progress,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startTrial,
  getTrialStatus,
  updateTrial,
  extendTrial,
  convertTrial,
  updateUsage,
  cancelTrial,
};
