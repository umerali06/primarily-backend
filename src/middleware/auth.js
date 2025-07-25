const jwt = require("jsonwebtoken");
const { UnauthorizedError, ForbiddenError } = require("../utils/customError");
const config = require("../config");
const User = require("../models/user.model");
const Activity = require("../models/activity.model");

/**
 * Middleware to protect routes that require authentication
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];
    }
    // Check if token exists in cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
      return next(new UnauthorizedError("Not authorized to access this route"));
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Get user from the token
      const user = await User.findById(decoded.id);

      // Check if user exists
      if (!user) {
        return next(new UnauthorizedError("User not found"));
      }

      // Check if user is active
      if (user.status !== "active") {
        return next(new UnauthorizedError("Your account has been deactivated"));
      }

      // Add user to request object
      req.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError") {
        return next(new UnauthorizedError("Invalid token"));
      } else if (error.name === "TokenExpiredError") {
        return next(new UnauthorizedError("Token expired"));
      } else {
        return next(
          new UnauthorizedError("Not authorized to access this route")
        );
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to restrict access to specific roles
 * @param {...string} roles - Roles allowed to access the route
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new UnauthorizedError("Not authorized to access this route"));
    }

    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempt
      Activity.logAuthActivity(
        req.user.id,
        "unauthorized_access",
        {
          route: req.originalUrl,
          method: req.method,
          requiredRoles: roles,
          userRole: req.user.role,
        },
        req
      ).catch((err) => console.error("Error logging activity:", err));

      return next(
        new ForbiddenError("You do not have permission to perform this action")
      );
    }

    next();
  };
};

/**
 * Middleware to log authentication activity
 */
const logAuthActivity = async (req, res, next) => {
  try {
    // Only log if user is authenticated
    if (req.user && req.user.id) {
      await Activity.logAuthActivity(
        req.user.id,
        "access",
        {
          route: req.originalUrl,
          method: req.method,
        },
        req
      );
    }
    next();
  } catch (error) {
    // Don't block the request if logging fails
    console.error("Error logging auth activity:", error);
    next();
  }
};

/**
 * Middleware to refresh token if it's about to expire
 */
const refreshToken = async (req, res, next) => {
  try {
    // Only proceed if user is authenticated
    if (!req.user || !req.user.id) {
      return next();
    }

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return next();
    }

    // Decode token without verification to check expiry
    const decoded = jwt.decode(token);
    if (!decoded) {
      return next();
    }

    // Check if token is about to expire (less than 15 minutes remaining)
    const expiryTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeRemaining = expiryTime - currentTime;
    const fifteenMinutes = 15 * 60 * 1000;

    if (timeRemaining < fifteenMinutes && timeRemaining > 0) {
      // Token is about to expire, generate a new one
      const user = await User.findById(req.user.id);
      if (!user) {
        return next();
      }

      // Generate new token
      const newToken = user.generateAuthToken();

      // Set new token in response header
      res.setHeader("X-New-Token", newToken);
    }

    next();
  } catch (error) {
    // Don't block the request if token refresh fails
    console.error("Error refreshing token:", error);
    next();
  }
};

module.exports = {
  protect,
  authorize,
  logAuthActivity,
  refreshToken,
};
