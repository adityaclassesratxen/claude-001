const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const { authenticateToken } = require("../middleware/auth");

// Profile endpoints (protected)
router.get("/profile", authenticateToken, profileController.getProfile);
router.put("/profile", authenticateToken, profileController.updateProfile);
router.post(
  "/profile/avatar",
  authenticateToken,
  profileController.updateAvatar
);
router.post(
  "/profile/change-password",
  authenticateToken,
  profileController.changePassword
);
router.put(
  "/profile/preferences",
  authenticateToken,
  profileController.updatePreferences
);

// History, activity, sessions
router.get(
  "/profile/login-history",
  authenticateToken,
  profileController.getLoginHistory
);
router.get(
  "/profile/activity",
  authenticateToken,
  profileController.getActivityLog
);
router.get(
  "/profile/sessions",
  authenticateToken,
  profileController.getActiveSessions
);
router.delete(
  "/profile/sessions/:sessionId",
  authenticateToken,
  profileController.revokeSession
);

module.exports = router;
