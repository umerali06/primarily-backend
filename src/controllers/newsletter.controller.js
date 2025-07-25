const Newsletter = require("../models/newsletter.model");
const { apiResponse } = require("../utils/apiResponse");
const { CustomError } = require("../utils/customError");

// Subscribe to newsletter
const subscribe = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new CustomError("Email is required", 400);
    }

    // Check if email already exists
    const existingSubscription = await Newsletter.findOne({ email });

    if (existingSubscription) {
      if (existingSubscription.status === "subscribed") {
        return res.json(
          apiResponse(true, "You are already subscribed to our newsletter", {
            status: "already_subscribed",
          })
        );
      } else {
        // Reactivate subscription
        existingSubscription.status = "subscribed";
        existingSubscription.subscriptionDate = new Date();
        existingSubscription.unsubscribeDate = undefined;
        await existingSubscription.save();

        return res.json(
          apiResponse(
            true,
            "Welcome back! Your newsletter subscription has been reactivated",
            {
              status: "reactivated",
            }
          )
        );
      }
    }

    // Create new subscription
    const subscription = new Newsletter({
      email,
      source: "website",
    });

    await subscription.save();

    // TODO: Send welcome email
    // TODO: Add to email marketing platform (Mailchimp, SendGrid, etc.)

    res.status(201).json(
      apiResponse(true, "Successfully subscribed to newsletter", {
        status: "subscribed",
        message:
          "Thank you for subscribing! You will receive our latest updates and tips.",
      })
    );
  } catch (error) {
    next(error);
  }
};

// Unsubscribe from newsletter
const unsubscribe = async (req, res, next) => {
  try {
    const { token, email } = req.query;

    let subscription;

    if (token) {
      subscription = await Newsletter.findOne({ unsubscribeToken: token });
    } else if (email) {
      subscription = await Newsletter.findOne({ email });
    } else {
      throw new CustomError("Token or email is required", 400);
    }

    if (!subscription) {
      throw new CustomError("Subscription not found", 404);
    }

    if (subscription.status === "unsubscribed") {
      return res.json(
        apiResponse(true, "You are already unsubscribed", {
          status: "already_unsubscribed",
        })
      );
    }

    subscription.status = "unsubscribed";
    subscription.unsubscribeDate = new Date();
    await subscription.save();

    // TODO: Remove from email marketing platform
    // TODO: Send confirmation email

    res.json(
      apiResponse(true, "Successfully unsubscribed from newsletter", {
        status: "unsubscribed",
        message: "You have been unsubscribed. We are sorry to see you go!",
      })
    );
  } catch (error) {
    next(error);
  }
};

// Update newsletter preferences
const updatePreferences = async (req, res, next) => {
  try {
    const { email, preferences } = req.body;

    if (!email) {
      throw new CustomError("Email is required", 400);
    }

    const subscription = await Newsletter.findOne({ email });
    if (!subscription) {
      throw new CustomError("Subscription not found", 404);
    }

    if (subscription.status !== "subscribed") {
      throw new CustomError("Subscription is not active", 400);
    }

    // Update preferences
    if (preferences) {
      subscription.preferences = {
        ...subscription.preferences,
        ...preferences,
      };
      await subscription.save();
    }

    res.json(
      apiResponse(true, "Newsletter preferences updated successfully", {
        preferences: subscription.preferences,
      })
    );
  } catch (error) {
    next(error);
  }
};

// Get all newsletter subscriptions (admin only)
const getSubscriptions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      sortBy = "subscriptionDate",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const subscriptions = await Newsletter.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-unsubscribeToken -__v");

    const total = await Newsletter.countDocuments(filter);

    res.json(
      apiResponse(true, "Newsletter subscriptions retrieved successfully", {
        subscriptions,
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

// Get newsletter statistics (admin only)
const getNewsletterStats = async (req, res, next) => {
  try {
    const stats = await Newsletter.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          subscribed: {
            $sum: { $cond: [{ $eq: ["$status", "subscribed"] }, 1, 0] },
          },
          unsubscribed: {
            $sum: { $cond: [{ $eq: ["$status", "unsubscribed"] }, 1, 0] },
          },
          bounced: { $sum: { $cond: [{ $eq: ["$status", "bounced"] }, 1, 0] } },
        },
      },
    ]);

    // Get subscription trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trends = await Newsletter.aggregate([
      {
        $match: {
          subscriptionDate: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$subscriptionDate" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(
      apiResponse(true, "Newsletter statistics retrieved successfully", {
        overview: stats[0] || {
          total: 0,
          subscribed: 0,
          unsubscribed: 0,
          bounced: 0,
        },
        trends,
      })
    );
  } catch (error) {
    next(error);
  }
};

// Export newsletter subscribers (admin only)
const exportSubscribers = async (req, res, next) => {
  try {
    const { status = "subscribed" } = req.query;

    const subscribers = await Newsletter.find({ status })
      .select("email subscriptionDate preferences -_id")
      .sort({ subscriptionDate: -1 });

    res.json(
      apiResponse(true, "Newsletter subscribers exported successfully", {
        subscribers,
        count: subscribers.length,
      })
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  updatePreferences,
  getSubscriptions,
  getNewsletterStats,
  exportSubscribers,
};
