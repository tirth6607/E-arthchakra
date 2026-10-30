const mongoose = require("mongoose");

const STATUSES = ["Pending", "Assigned", "In Progress", "Completed", "Cancelled"];
// gps: device fix · gps-adjusted: fix, then pin moved by the customer · manual: pin placed on the map by hand
const LOCATION_SOURCES = ["gps", "gps-adjusted", "manual"];

const pickupSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // "EF-1735689000123" – what the UI shows as `id`
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerName: { type: String, trim: true, default: "" },
    businessName: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    city: { type: String, trim: true, default: "" },
    businessType: { type: String, trim: true, default: "" },
    waste: { type: [String], validate: [(v) => v.length > 0, "Select at least one waste category"] },
    quantity: { type: String, default: "0" },
    frequency: { type: String, default: "One-time" },
    message: { type: String, default: "", maxlength: 2000 },
    // Exact pickup spot from the customer's GPS. Optional in the schema so older pickups stay valid;
    // the API requires it for new requests. GeoJSON coordinates are [longitude, latitude].
    location: { type: { type: String, enum: ["Point"], default: undefined }, coordinates: { type: [Number], default: undefined } },
    latitude: { type: Number, min: -90, max: 90, default: null },
    longitude: { type: Number, min: -180, max: 180, default: null },
    locationAccuracy: { type: Number, default: null },      // metres
    locationTimestamp: { type: Date, default: null },       // when the GPS fix was taken
    locationSource: { type: String, enum: [null, ...LOCATION_SOURCES], default: null },
    status: { type: String, enum: STATUSES, default: "Pending", index: true },
    partner: { type: String, default: null, index: true },
    scheduledDate: { type: String, default: null },
    scheduledTime: { type: String, default: null }
  },
  { timestamps: true }
);

pickupSchema.index({ location: "2dsphere" });

pickupSchema.statics.STATUSES = STATUSES;
pickupSchema.statics.LOCATION_SOURCES = LOCATION_SOURCES;

// Keep the exact field names the existing pages read.
pickupSchema.methods.toClient = function () {
  return {
    id: this.code,
    userId: String(this.user),
    customerName: this.customerName,
    businessName: this.businessName,
    name: this.name,
    phone: this.phone,
    email: this.email,
    city: this.city,
    businessType: this.businessType,
    waste: this.waste,
    wasteTypes: this.waste,
    quantity: this.quantity,
    frequency: this.frequency,
    message: this.message,
    latitude: this.latitude,
    longitude: this.longitude,
    locationAccuracy: this.locationAccuracy,
    locationTimestamp: this.locationTimestamp,
    locationSource: this.locationSource,
    status: this.status,
    partner: this.partner,
    scheduledDate: this.scheduledDate,
    scheduledTime: this.scheduledTime,
    submittedAt: this.createdAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.models.Pickup || mongoose.model("Pickup", pickupSchema);
