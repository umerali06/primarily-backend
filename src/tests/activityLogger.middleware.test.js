const {
  logActivity,
  logCustomActivity,
  logAuthActivity,
  extractResourceInfo,
  determineAction,
  extractDetails,
} = require("../middleware/activityLogger");
const Activity = require("../models/activity.model");

// Mock dependenc
