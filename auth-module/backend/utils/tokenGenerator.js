const crypto = require("crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Calculate expiry time (1 hour from now)
const getTokenExpiry = () => {
  const expiry = new Date();
  expiry.setTime(expiry.getTime() + parseInt(process.env.RESET_TOKEN_EXPIRY));
  return expiry;
};

// Generate secure random token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Calculate expiry time (1 hour from now)
const getTokenExpiry = () => {
  const expiry = new Date();
  expiry.setTime(expiry.getTime() + parseInt(process.env.RESET_TOKEN_EXPIRY));
  return expiry;
};

module.exports = {
  generateResetToken,
  getTokenExpiry,
};
