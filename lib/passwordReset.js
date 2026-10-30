const crypto = require("crypto");
const User = require("../models/User");
const PasswordReset = require("../models/PasswordReset");
const { sendEmail } = require("./email");
const { rateLimit, clientIp } = require("./rateLimit");
const { HttpError, str } = require("./http");

const CODE_TTL_MS = 10 * 60 * 1000; // code valid for 10 minutes
const TOKEN_TTL_MS = 15 * 60 * 1000; // after verifying, 15 minutes to choose a new password
const MAX_ATTEMPTS = 5;
const MIN_RESPONSE_MS = 1200; // same response time whether or not the email exists

const GENERIC_MESSAGE = "If an account exists with this email, a verification code has been sent.";

// HMAC with the server secret: a leaked database can't be brute-forced back to 6-digit codes.
function hmac(value) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(value).digest("hex");
}

function safeEqual(a, b) {
  const ab = Buffer.from(a || "", "hex");
  const bb = Buffer.from(b || "", "hex");
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}

function readEmail(body) {
  const email = str((body || {}).email, 200).toLowerCase();
  if (!email) throw new HttpError(400, "Please enter your email address.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  return email;
}

function resetEmail(code) {
  const text = [
    "Hello,",
    "",
    "We received a request to reset your E-arthchakra account password.",
    "",
    "Your verification code is:",
    "",
    code,
    "",
    "This code expires in 10 minutes.",
    "",
    "If you did not request a password reset, you can safely ignore this email.",
    "",
    "Do not share this code with anyone.",
    "",
    "Regards,",
    "E-arthchakra Team"
  ].join("\n");

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2a24;line-height:1.55;max-width:480px">
  <p>Hello,</p>
  <p>We received a request to reset your E-arthchakra account password.</p>
  <p>Your verification code is:</p>
  <p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#0b4a32;margin:18px 0">${code}</p>
  <p>This code expires in 10 minutes.</p>
  <p>If you did not request a password reset, you can safely ignore this email.</p>
  <p><strong>Do not share this code with anyone.</strong></p>
  <p>Regards,<br>E-arthchakra Team</p>
</div>`;

  return { subject: "Your E-arthchakra Password Reset Code", text, html };
}

/**
 * Shared by /forgot-password and /resend-reset-code.
 * Limits are keyed by email (whether or not it exists) and IP, so responses look the same either way.
 */
async function requestResetCode(req, res) {
  const started = Date.now();
  const email = readEmail(req.body);
  const ip = clientIp(req);

  await rateLimit("reset-ip", ip, 10, 15 * 60);
  await rateLimit("reset-cooldown", email, 1, 60, "Please wait a minute before requesting another code.");
  await rateLimit("reset-email", email, 3, 15 * 60, "Too many code requests. Please try again in 15 minutes.");

  const user = await User.findOne({ email });
  if (user) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const now = Date.now();

    // A new code replaces any earlier request, so old codes stop working.
    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({
      userId: user._id,
      email,
      codeHash: hmac(code),
      codeExpiresAt: new Date(now + CODE_TTL_MS),
      expiresAt: new Date(now + CODE_TTL_MS)
    });

    try {
      await sendEmail({ to: user.email, ...resetEmail(code) });
    } catch (err) {
      console.error("Password reset email failed:", err.message);
    }
  }

  const wait = MIN_RESPONSE_MS - (Date.now() - started);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  res.json({ ok: true, message: GENERIC_MESSAGE });
}

module.exports = { requestResetCode, readEmail, hmac, safeEqual, MAX_ATTEMPTS, TOKEN_TTL_MS };
