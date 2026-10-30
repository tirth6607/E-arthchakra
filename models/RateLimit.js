const mongoose = require("mongoose");

// Fixed-window counters. Stored in MongoDB because serverless instances don't share memory.
const rateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
});

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.RateLimit || mongoose.model("RateLimit", rateLimitSchema);
