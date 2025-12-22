import React from "react";

function scorePassword(password) {
  let score = 0;
  if (!password) return score;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export default function PasswordStrength({ password }) {
  const score = scorePassword(password);
  const labels = ["Too weak", "Weak", "Okay", "Strong", "Very strong"];
  return <div style={{ marginTop: 6 }}>{labels[score] || labels[0]}</div>;
}
