const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const PasswordReset = require("../../models/PasswordReset");
const { clearAuthCookie } = require("../../lib/auth");
const { route, HttpError } = require("../../lib/http");
const { rateLimit, clientIp } = require("../../lib/rateLimit");
const { hmac } = require("../../lib/passwordReset");

const EXPIRED_SESSION = "This password reset session has expired. Please start again.";

module.exports = route({ methods: ["POST"] }, async (req, res) => {
  const body = req.body || {};
  const resetToken = typeof body.resetToken === "string" ? body.resetToken : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  await rateLimit("reset-password-ip", clientIp(req), 10, 15 * 60);

  if (!/^[a-f0-9]{64}$/.test(resetToken)) throw new HttpError(400, EXPIRED_SESSION);

  // Same rule as registration (lib/auth-routes/register.js).
  if (newPassword.length < 8) {
    throw new HttpError(400, "Password does not meet the required security requirements. Use at least 8 characters.");
  }

  // Delete-on-read makes the token single-use, even with parallel requests.
  const reset = await PasswordReset.findOneAndDelete({
    resetTokenHash: hmac(resetToken),
    verified: true
  });
  if (!reset || !reset.resetTokenExpiresAt || reset.resetTokenExpiresAt.getTime() < Date.now()) {
    throw new HttpError(400, EXPIRED_SESSION);
  }

  const user = await User.findById(reset.userId);
  if (!user) throw new HttpError(400, EXPIRED_SESSION);

  // Same hashing as registration. passwordChangedAt signs out every older session (see lib/auth.js).
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await bcrypt.hash(newPassword, 10), passwordChangedAt: new Date() } }
  );
  await PasswordReset.deleteMany({ userId: user._id });

  clearAuthCookie(res);
  res.json({ ok: true, message: "Your password has been changed successfully." });
});
