const mongoose = require("mongoose");

// One active reset request per user. Codes and tokens are stored only as HMAC hashes.
const passwordResetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, default: null },
    codeExpiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    resetTokenHash: { type: String, default: null, index: true },
    resetTokenExpiresAt: { type: Date, default: null },
    // MongoDB deletes the document once this passes (TTL index below).
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.PasswordReset || mongoose.model("PasswordReset", passwordResetSchema);
