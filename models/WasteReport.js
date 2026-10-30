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

// Anti-fraud verdict at submit time (lib/fraud.js). Separate from the workflow status above.
const FRAUD_STATUSES = ["auto-approved", "needs-review", "rejected"];
// Points a reporter earns once the pickup partner confirms the waste on site.
const REPORT_POINTS = 10;

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    photoUrl: { type: String, required: true },            // only the reference – never the image itself
    photoKey: { type: String, default: "" },
    photos: [{
      _id: false,
      url: { type: String, required: true },
      key: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      // Live-capture signals (null on reports from before anti-fraud checks)
      capturedAt: { type: Date, default: null },
      gps: { lat: Number, lng: Number, accuracy: Number },
      phash: { type: String, default: null, index: true }, // 64-bit dHash, hex
      aiScore: { type: Number, default: null }             // Sightengine: 0–1, likely AI-generated
    }],
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
    fraud: {
      status: { type: String, enum: FRAUD_STATUSES, default: undefined, index: true },
      riskScore: { type: Number, default: null },
      reasons: [{ _id: false, code: String, text: String }],
      gps: { lat: Number, lng: Number, accuracy: Number },   // where the (first) photo was taken
      claimed: { lat: Number, lng: Number },                 // where the reporter says the waste is
      distanceM: { type: Number, default: null },            // furthest photo from the claimed point
      aiScore: { type: Number, default: null },              // highest score across photos
      duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "WasteReport", default: null },
      checkedAt: { type: Date, default: null },
      reviewedBy: { type: String, default: "" },
      reviewedAt: { type: Date, default: null }
    },
    // Set by the assigned pickup partner on site; only then are points awarded.
    siteVerifiedAt: { type: Date, default: null },
    siteVerifiedBy: { type: String, default: "" },
    rewardPoints: { type: Number, default: 0 },
    rewardedAt: { type: Date, default: null },
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
    photos: this.photos && this.photos.length
      ? this.photos.map((p) => (admin ? { url: p.url, capturedAt: p.capturedAt, gps: p.gps, aiScore: p.aiScore } : { url: p.url }))
      : [{ url: this.photoUrl }],
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
    fraud: admin ? this.fraud : this.fraud && this.fraud.status ? { status: this.fraud.status } : undefined,
    siteVerifiedAt: this.siteVerifiedAt,
    siteVerifiedBy: admin ? this.siteVerifiedBy : undefined,
    rewardPoints: this.rewardPoints,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const Model = mongoose.models.WasteReport || mongoose.model("WasteReport", schema);
Model.WASTE_TYPES = WASTE_TYPES;
Model.STATUSES = STATUSES;
Model.ACTIONS = ACTIONS;
Model.FRAUD_STATUSES = FRAUD_STATUSES;
Model.REPORT_POINTS = REPORT_POINTS;
module.exports = Model;
