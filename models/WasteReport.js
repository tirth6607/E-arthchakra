const mongoose = require("mongoose");

const WASTE_TYPES = ["Plastic", "Paper", "Cardboard", "Metal", "Glass", "E-waste", "Mixed", "Other"];
// NEW → VERIFIED → ASSIGNED → COLLECTING → COLLECTED → RECYCLED   (+ REJECTED from NEW/VERIFIED)
const STATUSES = ["NEW", "VERIFIED", "REJECTED", "ASSIGNED", "COLLECTING", "COLLECTED", "RECYCLED"];

const ACTIONS = {
  verify:     { from: ["NEW"],                       to: "VERIFIED" },
  reject:     { from: ["NEW", "VERIFIED"],           to: "REJECTED" },
  assign:     { from: ["VERIFIED", "ASSIGNED"],      to: "ASSIGNED", needsCollector: true },
  collecting: { from: ["ASSIGNED"],                  to: "COLLECTING" },
  collected:  { from: ["ASSIGNED", "COLLECTING"],    to: "COLLECTED" },
  recycled:   { from: ["COLLECTED"],                 to: "RECYCLED" }
};

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    photoUrl: { type: String, required: true },            // only the reference – never the image itself
    photoKey: { type: String, default: "" },
    photos: [{ _id: false, url: { type: String, required: true }, key: { type: String, required: true }, uploadedAt: { type: Date, default: Date.now } }],
    // GeoJSON: coordinates are [longitude, latitude]. No defaults, so old reports stay valid for the 2dsphere index.
    location: { type: { type: String, enum: ["Point"], default: undefined }, coordinates: { type: [Number], default: undefined } },                // storage path, used for cleanup
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    locationAccuracy: { type: Number, default: null },      // metres
    locationTimestamp: { type: Date, default: null },       // when the GPS fix was taken
    wasteType: { type: String, enum: WASTE_TYPES, required: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: STATUSES, default: "NEW", index: true },
    collector: { type: String, trim: true, maxlength: 120, default: "" },
    history: [{ status: String, by: String, at: { type: Date, default: Date.now }, _id: false }],
    // Reserved for the future AI classifier – nothing writes to this yet.
    ai: {
      label: { type: String, default: null },
      confidence: { type: Number, default: null },
      model: { type: String, default: null },
      classifiedAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

schema.index({ createdAt: -1 });
schema.index({ location: "2dsphere" });

schema.methods.toClient = function (admin = false) {
  const u = this.user && this.user.name ? this.user : null; // populated?
  return {
    id: String(this._id),
    photoUrl: this.photoUrl,
    photos: this.photos && this.photos.length ? this.photos.map((p) => ({ url: p.url })) : [{ url: this.photoUrl }],
    location: this.location && this.location.coordinates ? { type: "Point", coordinates: this.location.coordinates } : undefined,
    latitude: this.latitude,
    longitude: this.longitude,
    locationAccuracy: this.locationAccuracy,
    locationTimestamp: this.locationTimestamp,
    wasteType: this.wasteType,
    description: this.description,
    status: this.status,
    collector: this.collector,
    history: admin ? this.history : undefined,
    reporter: admin && u ? { id: String(u._id), name: u.name, businessName: u.businessName, email: u.email, phone: u.phone } : undefined,
    ai: this.ai,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const Model = mongoose.models.WasteReport || mongoose.model("WasteReport", schema);
Model.WASTE_TYPES = WASTE_TYPES;
Model.STATUSES = STATUSES;
Model.ACTIONS = ACTIONS;
module.exports = Model;
