const crypto = require("crypto");
const RateLimit = require("../models/RateLimit");
const { HttpError } = require("./http");

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

// Emails/IPs are hashed so the counters collection holds no personal data.
const hashKey = (value) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);

/**
 * Allows `limit` hits per `windowSeconds` for this key, otherwise throws 429.
 *   await rateLimit("forgot:ip", clientIp(req), 10, 15 * 60);
 */
async function rateLimit(name, value, limit, windowSeconds, message) {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const key = `${name}:${hashKey(String(value))}:${windowStart}`;

  let doc;
  try {
    doc = await RateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs) } },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Two requests racing to create the same counter: retry once as a plain update.
    if (err && err.code === 11000) {
      doc = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
    } else {
      throw err;
    }
  }

  if (doc && doc.count > limit) {
    throw new HttpError(429, message || "Too many requests. Please try again later.");
  }
}

module.exports = { rateLimit, clientIp };
