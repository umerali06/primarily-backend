const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const crypto = require("crypto");
const User = require("../models/user.model");
const config = require("./index");
const logger = require("./logger");
const Activity = require("../models/activity.model");

/**
 * Configure Passport strategies
 */
const configurePassport = () => {
  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Configure Google Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackURL,
        scope: ["profile", "email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists by Google ID or email
          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email: profile.emails[0].value }],
          });

          if (user) {
            // Update Google ID if not set
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();

              // Log account linking
              await Activity.logUserActivity(user._id, user._id, "update", {
                action: "link_google_account",
                googleId: profile.id,
              });
            }

            // Log login activity
            await Activity.logAuthActivity(user._id, "login", {
              method: "google",
              googleId: profile.id,
            });

            // Update last login
            user.lastLogin = Date.now();
            await user.save();

            return done(null, user);
          }

          // Create new user if not exists
          const newUser = await User.create({
            name:
              profile.displayName ||
              `${profile.name.givenName} ${profile.name.familyName}`,
            email: profile.emails[0].value,
            googleId: profile.id,
            password: crypto.randomBytes(20).toString("hex"), // Random password
            status: "active",
          });

          // Log registration activity
          await Activity.logAuthActivity(newUser._id, "register", {
            method: "google",
            googleId: profile.id,
          });

          return done(null, newUser);
        } catch (error) {
          logger.error(`Google authentication error: ${error.message}`);
          return done(error, null);
        }
      }
    )
  );
};

module.exports = configurePassport;
