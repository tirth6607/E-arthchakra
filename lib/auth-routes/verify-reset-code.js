const crypto = require("crypto");
const PasswordReset = require("../../models/PasswordReset");
const { route, HttpError, str } = require("../../lib/http");
const { rateLimit, clientIp } = require("../../lib/rateLimit");
const { readEmail, hmac, safeEqual, MAX_ATTEMPTS, TOKEN_TTL_MS } = require("../../lib/passwordReset");

const INVALID = "Invalid verification code.";
const EXPIRED = "This verification code has expired. Please request a new code.";
const TOO_MANY = "Too many incorrect attempts. Please request a new code.";

module.exports = route({ methods: ["POST"] }, async (req, res) => {
  const email = readEmail(req.body);
  const code = str((req.body || {}).code, 10);

  await rateLimit("verify-ip", clientIp(req), 20, 15 * 60);

  if (!/^\d{6}$/.test(code)) throw new HttpError(400, "Please enter the 6-digit code.");

  // Count the attempt atomically BEFORE comparing, so parallel guesses can't exceed the limit.
  const reset = await PasswordReset.findOneAndUpdate(
    { email, verified: false, codeHash: { $ne: null } },
    { $inc: { attempts: 1 } },
    { new: true }
  );

  // Unknown email and no pending request look the same.
  if (!reset) throw new HttpError(400, INVALID);

  if (reset.codeExpiresAt.getTime() < Date.now()) {
    await reset.deleteOne();
    throw new HttpError(400, EXPIRED);
  }

  if (reset.attempts > MAX_ATTEMPTS) {
    await reset.deleteOne();
    throw new HttpError(429, TOO_MANY);
  }

  if (!safeEqual(hmac(code), reset.codeHash)) {
    if (reset.attempts >= MAX_ATTEMPTS) {
      await reset.deleteOne();
      throw new HttpError(429, TOO_MANY);
    }
    throw new HttpError(400, INVALID);
  }

  // Correct code: burn it and hand out a single-use, short-lived reset token.
  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenExpires = new Date(Date.now() + TOKEN_TTL_MS);

  const updated = await PasswordReset.findOneAndUpdate(
    { _id: reset._id, verified: false },
    {
      $set: {
        verified: true,
        codeHash: null,
        resetTokenHash: hmac(resetToken),
        resetTokenExpiresAt: tokenExpires,
        expiresAt: tokenExpires
      }
    }
  );
  if (!updated) throw new HttpError(400, INVALID); // a parallel request already used this code

  res.json({ ok: true, resetToken });
});
