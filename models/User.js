const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 120 },
    businessName: { type: String, trim: true, maxlength: 160, default: "" },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200
    },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    businessType: { type: String, trim: true, maxlength: 60, default: "" },
    city: { type: String, trim: true, maxlength: 80, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin", "partner"], default: "customer" },
    // For role === "partner": the name admins assign pickups to (e.g. "Eco Collection 01")
    partnerName: { type: String, trim: true, default: "" },
    // For role === "partner": self-registered partners start "pending" until an admin approves them.
    // Defaults to "approved" so partner accounts created before self-registration keep working.
    partnerStatus: { type: String, enum: ["pending", "approved", "suspended"], default: "approved" },
    // Earned from waste reports once a pickup partner confirms them on site (api/reports/[id].js).
    points: { type: Number, default: 0, min: 0 },
    // Set on password reset; login cookies issued before this are rejected (lib/auth.js).
    passwordChangedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Shape the frontend already expects (same keys as the old localStorage user).
userSchema.methods.toClient = function () {
  return {
    id: String(this._id),
    name: this.name,
    businessName: this.businessName,
    email: this.email,
    phone: this.phone,
    businessType: this.businessType,
    city: this.city,
    role: this.role,
    partnerName: this.partnerName,
    partnerStatus: this.role === "partner" ? this.partnerStatus : undefined,
    points: this.points || 0,
    createdAt: this.createdAt,
    loggedIn: true
  };
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
