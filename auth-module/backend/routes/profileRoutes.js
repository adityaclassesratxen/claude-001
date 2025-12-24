const express = require("express");
const router = express.Router();
const {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  updatePreferences,
  getLoginHistory,
  getActivityLog,
  getActiveSessions,
  revokeSession,
} = require("../controllers/profileController");
const { authenticateToken } = require("../middleware/auth");

// All profile routes require authentication
router.use(authenticateToken);

// Profile CRUD
router.get("/", getProfile);
router.put("/", updateProfile);
router.put("/avatar", updateAvatar);
router.put("/password", changePassword);
router.put("/preferences", updatePreferences);

// History & activity
router.get("/login-history", getLoginHistory);
router.get("/activity", getActivityLog);

// Sessions management
router.get("/sessions", getActiveSessions);
router.delete("/sessions/:sessionId", revokeSession);

module.exports = router;
